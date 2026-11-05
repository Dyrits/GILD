#!/usr/bin/env python3
"""Decide whether a shell command is a guarded git command that needs a human's confirmation.

Usage: guard-git.py --level {1,2,3} [--protected main,master] [--format text|ask-json] [--cwd DIR] < command
Input: the command on stdin, as plain text or as a JSON hook payload with tool_input.command (and cwd).
Output: no output and exit 0 when the command passes. When it is guarded, `text` prints the reason to stderr and
exits 2; `ask-json` prints a PreToolUse "ask" decision to stdout and exits 0. An internal failure counts as guarded.
Needs: Python 3 standard library; git for the branch checks.

Levels: 1 shared history; 2 adds local work loss; 3 adds history rewrites and every push.
Limits: git aliases, scripts that run git, and `eval` are not followed.
"""

import argparse
import json
import re
import shlex
import subprocess
import sys

SEPARATORS = set(";&|\n()")
WRAPPERS = {"sudo", "doas", "command", "builtin", "exec", "env", "nohup", "time", "xargs", "nice", "ionice",
            "stdbuf", "timeout", "setsid", "if", "then", "do", "else", "while", "until", "!"}
WRAPPER_VALUE_OPTIONS = {"-u", "-g"}  # sudo -u root git ...
SHELLS = {"sh", "bash", "zsh", "dash", "ksh"}
SUBSHELL = re.compile(r"\$\(([^()]*)\)|`([^`]*)`")


class Guarded(Exception):
    pass


def split_segments(text):
    """Split on unquoted shell separators; text inside $(...) and backticks becomes extra segments."""
    segments, current, quote, escaped = [], [], None, False
    for char in text:
        if escaped:
            current.append(char)
            escaped = False
        elif char == "\\" and quote != "'":
            current.append(char)
            escaped = True
        elif quote:
            current.append(char)
            if char == quote:
                quote = None
        elif char in "'\"":
            current.append(char)
            quote = char
        elif char in SEPARATORS:
            segments.append("".join(current))
            current = []
        else:
            current.append(char)
    segments.append("".join(current))
    for match in SUBSHELL.finditer(text):
        segments.extend(split_segments(match.group(1) or match.group(2)))
    return [segment for segment in segments if segment.strip()]


def words_of(segment):
    try:
        return shlex.split(segment)
    except ValueError:
        return segment.split()


def strip_wrappers(words):
    while words:
        word = words[0]
        if "=" in word and not word.startswith("-"):
            words = words[1:]
        elif word.rsplit("/", 1)[-1] in WRAPPERS:
            words = words[1:]
            while words and words[0].startswith("-"):
                skip = 2 if words[0] in WRAPPER_VALUE_OPTIONS else 1
                words = words[skip:]
        else:
            break
    return words


def commands(text):
    """Yield the word list of every command in the text, following shells run with -c."""
    for segment in split_segments(text):
        words = strip_wrappers(words_of(segment))
        if not words:
            continue
        name = words[0].rsplit("/", 1)[-1]
        if name in SHELLS:
            for index, word in enumerate(words[1:], 1):
                if re.fullmatch(r"-[a-z]*c[a-z]*", word) and index + 1 < len(words):
                    yield from commands(words[index + 1])
                    break
        elif name == "git":
            yield words


def git_output(directory, *arguments):
    result = subprocess.run(["git", "-C", directory, *arguments], capture_output=True, text=True)
    return result.stdout.strip() if result.returncode == 0 else ""


class Checker:
    def __init__(self, level, protected, cwd):
        self.level = level
        self.protected = set(protected)
        self.cwd = cwd

    def ask(self, reason):
        raise Guarded(reason)

    def check(self, words):
        directory, index = self.cwd, 1
        while index < len(words):
            word = words[index]
            if word == "-C" and index + 1 < len(words):
                directory, index = words[index + 1], index + 2
            elif word in ("-c", "--namespace", "--git-dir", "--work-tree", "--exec-path") and index + 1 < len(words):
                index += 2
            elif word.startswith("-"):
                index += 1
            else:
                break
        if index >= len(words):
            return
        subcommand, args = words[index], words[index + 1:]
        handler = getattr(self, "git_" + subcommand.replace("-", "_"), None)
        if handler:
            handler(args, directory)

    def is_protected(self, branch, directory):
        default = git_output(directory, "symbolic-ref", "--short", "refs/remotes/origin/HEAD").removeprefix("origin/")
        return branch in self.protected or (default and branch == default)

    def git_push(self, args, directory):
        if "--no-verify" in args:
            self.ask("`git push --no-verify` skips the pre-push hook.")
        dry, forced, remote, refspecs = False, False, None, []
        for arg in args:
            if arg in ("--dry-run", "-n"):
                dry = True
            elif arg == "--force" or (re.fullmatch(r"-[a-zA-Z]+", arg) and "f" in arg):
                forced = True
            elif arg in ("--delete", "--mirror", "--all", "--prune") or re.fullmatch(r"-[a-zA-Z]*d[a-zA-Z]*", arg):
                self.ask(f"`git push {arg}` can delete or overwrite remote branches.")
            elif arg.startswith("-"):
                continue
            elif remote is None:
                remote = arg
            else:
                refspecs.append(arg)
        if dry:
            return
        if self.level >= 3:
            self.ask("Level 3 asks before every push.")
        for refspec in refspecs or ["HEAD"]:
            if refspec.startswith("+"):
                forced, refspec = True, refspec[1:]
            if refspec.startswith(":"):
                self.ask(f"`git push {remote} {refspec}` deletes a remote ref.")
            destination = refspec.split(":", 1)[-1].removeprefix("refs/heads/")
            if destination == "HEAD":
                destination = git_output(directory, "rev-parse", "--abbrev-ref", "HEAD")
            if self.is_protected(destination, directory):
                self.ask(f"This pushes to the protected branch `{destination}`.")
        if forced:
            self.ask("A plain force push overwrites remote history; `--force-with-lease` passes.")

    def git_reset(self, args, directory):
        if self.level >= 2 and "--hard" in args:
            self.ask("`git reset --hard` discards uncommitted changes.")
        if self.level >= 3:
            self.ask("Level 3 asks before `git reset` in any form.")

    def git_clean(self, args, directory):
        flags = "".join(arg[1:] for arg in args if re.fullmatch(r"-[a-zA-Z]+", arg))
        force = "--force" in args or "f" in flags
        dry = "--dry-run" in args or "n" in flags
        if self.level >= 2 and force and not dry:
            self.ask("`git clean` deletes untracked files.")

    def git_branch(self, args, directory):
        flags = "".join(arg[1:] for arg in args if re.fullmatch(r"-[a-zA-Z]+", arg))
        delete = "--delete" in args or "d" in flags or "D" in flags
        force = "--force" in args or "f" in flags or "D" in flags
        if self.level >= 2 and delete and force:
            self.ask("`git branch -D` deletes a branch even when it is unmerged.")
        if self.level >= 3 and delete:
            self.ask("Level 3 asks before deleting any branch.")

    def git_checkout(self, args, directory):
        flags = "".join(arg[1:] for arg in args if re.fullmatch(r"-[a-zA-Z]+", arg))
        if self.level >= 2 and ("--force" in args or "f" in flags or "." in args or "--" in args):
            self.ask("`git checkout` here discards uncommitted changes.")

    def git_switch(self, args, directory):
        flags = "".join(arg[1:] for arg in args if re.fullmatch(r"-[a-zA-Z]+", arg))
        if self.level >= 2 and ("--discard-changes" in args or "--force" in args or "f" in flags):
            self.ask("`git switch` here discards uncommitted changes.")

    def git_restore(self, args, directory):
        staged = any(arg in ("--staged", "-S") for arg in args)
        worktree = any(arg in ("--worktree", "-W") for arg in args)
        if self.level >= 2 and (not staged or worktree):
            self.ask("`git restore` discards uncommitted changes in the working tree.")

    def git_stash(self, args, directory):
        if self.level >= 2 and args[:1] in (["drop"], ["clear"]):
            self.ask(f"`git stash {args[0]}` deletes saved work.")

    def git_worktree(self, args, directory):
        if self.level >= 2 and args[:1] == ["remove"] and ("--force" in args or "-f" in args):
            self.ask("`git worktree remove --force` deletes a worktree with uncommitted work.")

    def git_reflog(self, args, directory):
        if self.level >= 2 and args[:1] in (["expire"], ["delete"]):
            self.ask(f"`git reflog {args[0]}` removes the history that recovers lost commits.")

    def git_gc(self, args, directory):
        if self.level >= 2 and any(arg.startswith("--prune") for arg in args):
            self.ask("`git gc --prune` deletes unreachable commits for good.")

    def git_prune(self, args, directory):
        if self.level >= 2:
            self.ask("`git prune` deletes unreachable commits for good.")

    def git_rebase(self, args, directory):
        if self.level >= 3:
            self.ask("Level 3 asks before every rebase.")

    def git_commit(self, args, directory):
        if self.level >= 3 and "--amend" in args:
            self.ask("Level 3 asks before amending a commit.")

    def git_tag(self, args, directory):
        if self.level >= 3 and any(arg in ("-d", "--delete", "-f", "--force") for arg in args):
            self.ask("Level 3 asks before deleting or moving a tag.")

    def _rewrite(self, args, directory):
        if self.level >= 3:
            self.ask("Level 3 asks before commands that rewrite history.")

    git_filter_branch = git_filter_repo = git_update_ref = _rewrite


def payload(raw):
    """The command and working directory from a JSON hook payload, or the raw text as the command."""
    try:
        data = json.loads(raw)
        command = data["tool_input"]["command"]
    except (ValueError, KeyError, TypeError):
        return raw, None
    if isinstance(command, list):  # some harnesses pass argv: ["bash", "-lc", "git ..."]
        command = shlex.join(command)
    return command, data.get("cwd")


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--level", type=int, choices=(1, 2, 3), required=True)
    parser.add_argument("--protected", default="main,master")
    parser.add_argument("--format", choices=("text", "ask-json"), default="text")
    parser.add_argument("--cwd", default=None)
    options = parser.parse_args()

    try:
        command, payload_cwd = payload(sys.stdin.read())
        checker = Checker(options.level, [b for b in options.protected.split(",") if b], options.cwd or payload_cwd or ".")
        for words in commands(command):
            checker.check(words)
        return 0
    except Guarded as guarded:
        reason = str(guarded)
    except Exception as error:  # fail closed: a guard that cannot read the command asks
        reason = f"The guard could not analyze this command ({type(error).__name__}), so it asks."
    if options.format == "ask-json":
        print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "ask",
                                                  "permissionDecisionReason": reason}}))
        return 0
    print(reason, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
