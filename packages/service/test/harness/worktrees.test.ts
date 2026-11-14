import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { workspaceWorktreesOf } from "../../src/harness/index.ts";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

const git = (folder: string, ...args: string[]) =>
  execFileSync("git", ["-C", folder, "-c", "user.name=Test", "-c", "user.email=test@example.com", ...args], {
    stdio: "ignore",
  });

/** A real folder holding one repository with one commit, and the real path of the folder around it. */
const repository = (name = "workspace") => {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "iskios-worktrees-")));
  directories.push(base);
  const folder = join(base, name);
  mkdirSync(folder);
  git(folder, "init", "-q", "-b", "main");
  writeFileSync(join(folder, "a.txt"), "a");
  git(folder, "add", ".");
  git(folder, "commit", "-q", "-m", "first");
  return { base, folder };
};

describe("a workspace's own git worktrees", () => {
  it("lists the linked worktrees git knows for the workspace folder, by their real paths", () => {
    const { base, folder } = repository();
    git(folder, "worktree", "add", "-q", "-b", "side", join(base, "workspace-side"));
    git(folder, "worktree", "add", "-q", "-b", "inner", join(folder, ".worktrees", "inner"));
    expect([...workspaceWorktreesOf(folder)].sort()).toEqual(
      [join(base, "workspace-side"), join(folder, ".worktrees", "inner")].sort(),
    );
  });

  it("lists none for a folder that is not a git repository", () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), "iskios-worktrees-")));
    directories.push(base);
    expect(workspaceWorktreesOf(base)).toEqual([]);
  });

  it("leaves out a worktree whose folder is gone", () => {
    const { base, folder } = repository();
    git(folder, "worktree", "add", "-q", "-b", "gone", join(base, "workspace-gone"));
    rmSync(join(base, "workspace-gone"), { recursive: true });
    expect(workspaceWorktreesOf(folder)).toEqual([]);
  });

  it("leaves out a worktree whose folder was replaced by a link elsewhere", () => {
    const { base, folder } = repository();
    git(folder, "worktree", "add", "-q", "-b", "moved", join(base, "workspace-moved"));
    renameSync(join(base, "workspace-moved"), join(base, "elsewhere"));
    symlinkSync(join(base, "elsewhere"), join(base, "workspace-moved"));
    expect(workspaceWorktreesOf(folder)).toEqual([]);
  });

  it("lists none when the thread's folder is itself a linked worktree, so an own copy stays apart", () => {
    const { base, folder } = repository();
    const linked = join(base, "workspace-own-copy");
    git(folder, "worktree", "add", "-q", "-b", "own-copy", linked);
    git(folder, "worktree", "add", "-q", "-b", "other", join(base, "workspace-other"));
    expect(workspaceWorktreesOf(linked)).toEqual([]);
  });

  it("lists none when the folder only lies inside a repository, not at its top", () => {
    const { base, folder } = repository();
    git(folder, "worktree", "add", "-q", "-b", "side", join(base, "workspace-side"));
    mkdirSync(join(folder, "sub"));
    expect(workspaceWorktreesOf(join(folder, "sub"))).toEqual([]);
  });

  it("does not list the worktrees of another repository", () => {
    const mine = repository("mine");
    const other = repository("other");
    git(other.folder, "worktree", "add", "-q", "-b", "side", join(other.base, "other-side"));
    expect(workspaceWorktreesOf(mine.folder)).toEqual([]);
  });
});
