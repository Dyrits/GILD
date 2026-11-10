import { textFieldOf } from "./records.ts";

// A wildcard never spans a shell operator, so `git push *` cannot also cover
// `git push && rm -rf ~` (CHG-0031, standing permissions).
const wildcard = "[^;&|`$<>(){}\\n\\r]*";

const escapeRegExp = (text: string) => text.replace(/[.+?^${}()|[\]\\]/g, "\\$&");

/** Whether a pattern is narrow enough to save: it must begin with at least two literal characters. */
export const isSavablePattern = (pattern: string) => /^[^*]{2,}/.test(pattern.trim());

/** Whether a target, such as a command, is covered by a pattern where `*` stands for any text. */
export const matchesPattern = (pattern: string, target: string) => {
  const trimmed = pattern.trim();
  if (!isSavablePattern(trimmed)) return false;
  const source = trimmed.split("*").map(escapeRegExp).join(wildcard);
  return new RegExp(`^${source}$`).test(target.trim());
};

/** The pattern Always allow saves: the proposed one when savable, else the exact target. */
export const savedPatternOf = (proposed: string | null, target: string) =>
  proposed !== null && isSavablePattern(proposed) && matchesPattern(proposed, target) ? proposed.trim() : target.trim();

const plainActions: Record<string, string> = {
  Bash: "Run a command",
  Edit: "Change a file",
  MultiEdit: "Change a file",
  NotebookEdit: "Change a notebook",
  Read: "Read a file",
  WebFetch: "Open a web page",
  WebSearch: "Search the web",
  Write: "Write a file",
};

/** Claude Code's own reason for a tool call, without its final period, or null when it gives none. */
export const reasonOf = (input: unknown) => {
  const reason = textFieldOf(input, "description")?.trim().replace(/\.$/, "") ?? "";
  return reason === "" ? null : reason;
};

/** The kind of a harness tool call in plain words, such as "Run a command". */
export const plainActionOf = (toolName: string) =>
  Object.hasOwn(plainActions, toolName) ? (plainActions[toolName] ?? toolName) : `Use ${toolName}`;

// A whole command that is one shell's `-c` script in one pair of quotes, as Codex escalates it
// (`/bin/zsh -lc 'git push origin main'`, probed live on 2026-11-08). A quote inside the script does not match,
// so nothing chained after the closing quote is dropped.
const shellScript = /^(?:\S*\/)?(?:ba|z|da|k|fi)?sh\s+(?:-\w+\s+)*-\w*c\w*\s+(?:'([^']*)'|"([^"\\$`]*)")$/;

/** A command without the shell script wrapper around it, so an allowance or pattern for the command applies. */
const unwrappedOf = (command: string) => {
  const match = shellScript.exec(command.trim());
  return match === null ? command : (match[1] ?? match[2] ?? command);
};

/**
 * The exact target of a harness tool call: the command for Bash, unwrapped from a shell's `-c` script, else the
 * tool and its file, address, or input.
 */
export const targetOf = (toolName: string, input: unknown) => {
  if (toolName === "Bash") return unwrappedOf(textFieldOf(input, "command") ?? "");
  const subject =
    textFieldOf(input, "file_path") ??
    textFieldOf(input, "notebook_path") ??
    textFieldOf(input, "url") ??
    textFieldOf(input, "query") ??
    JSON.stringify(input);
  return `${toolName} ${subject}`;
};

/** A sensitive action: the kind Always allow saves, and what it affects, in plain words (CHG-0035). */
export interface Sensitivity {
  readonly consequence: string;
  readonly permission: string;
  /** Words that name this kind of action in the owner's message, such as "push" (quotes.ts). */
  readonly verbs: ReadonlyArray<string>;
}

// Where a command word may begin: the start, or after a shell operator, a
// substitution, or a wrapper. Wrappers include `bunx`, `npx`, `xargs`, a shell's
// `-c` script (Codex sends `bash -lc '…'`), `eval`, `env` and variable
// assignments, and launchers such as `time` or `nohup` (CHG-0063).
const commandStart = [
  /^|[;&|({\n`]|\$\(/.source,
  String.raw`\b(?:bunx|npx|xargs|command|builtin|time|nohup|exec|caffeinate)\s+(?:-\w+\s+)*`,
  String.raw`\bnice\s+(?:-n\s*-?\d+\s+|-\d+\s+)?`,
  String.raw`\btimeout\s+(?:-\S+\s+)*\S+\s+`,
  String.raw`\b(?:ba|z|da|k|fi)?sh\s+(?:-\w+\s+)*-\w*c\w*\s+['"]?`,
  String.raw`\beval\s+['"]?`,
  String.raw`\benv\s+(?:-\S+\s+)*`,
  String.raw`(?:^|\s)[A-Za-z_]\w*=\S*\s+`,
]
  .map((start) => `(?:${start})`)
  .join("|");
// A command word may carry its folder, as in `/usr/bin/git`.
const command = (body: string) => new RegExp(`(?:${commandStart})\\s*(?:[\\w.~-]*/)*${body}`);
// A git subcommand, after any global options such as `-c key=value` or `-C path`.
const git = (body: string) => command(String.raw`git(?:\s+-[cC]\s+\S+|\s+--?[\w-]+(?:=\S+)?)*\s+${body}`);
const secretPath =
  /(?:^|[\s'"=/])(?:~|\$HOME|\/Users\/[^/\s]+|\/home\/[^/\s]+)?\/?\.(?:ssh|aws|gnupg|netrc|docker\/config\.json|config\/gh|kube)\b/;

const sensitiveCommands: ReadonlyArray<readonly [RegExp, Sensitivity]> = [
  [
    git(String.raw`push\b`),
    {
      consequence:
        "This sends your commits off this computer, where everyone with access to the repository can see them.",
      permission: "Push code",
      verbs: ["push"],
    },
  ],
  [
    command(
      String.raw`(?:(?:npm|bun|yarn|pnpm|cargo|poetry|gem)\s+(?:publish|push)\b|twine\s+upload\b|docker\s+push\b|gh\s+release\s+(?:create|upload|edit|delete)\b)`,
    ),
    {
      consequence: "This makes a package or release public, and a published version usually cannot be taken back.",
      permission: "Publish",
      verbs: ["publish", "release"],
    },
  ],
  [
    command(
      String.raw`(?:wrangler\s+(?:deploy|publish|pages\s+deploy)\b|vercel\b|netlify\s+deploy\b|fly(?:ctl)?\s+deploy\b|firebase\s+deploy\b|terraform\s+(?:apply|destroy)\b|pulumi\s+(?:up|destroy)\b|kubectl\s+(?:apply|delete|create|replace|rollout|scale)\b|serverless\s+deploy\b|heroku\b|cf\s+deploy\b)`,
    ),
    {
      consequence: "This changes a live service that other people may be using.",
      permission: "Deploy",
      verbs: ["deploy", "ship", "release", "launch", "apply", "destroy"],
    },
  ],
  [
    command(
      String.raw`gh\s+(?:(?:pr|issue)\s+(?:create|comment|merge|close|reopen|edit|review|delete)\b|repo\s+(?:create|delete|edit|rename|archive)\b|api\b.*\s(?:-X\s*(?:POST|PUT|PATCH|DELETE)|--method\s+(?:POST|PUT|PATCH|DELETE)|-[fF]\s))`,
    ),
    {
      consequence: "This writes something under your GitHub account that other people can see.",
      permission: "Post on GitHub",
      verbs: [
        "post",
        "open",
        "create",
        "comment",
        "merge",
        "close",
        "reopen",
        "review",
        "file",
        "delete",
        "archive",
        "rename",
      ],
    },
  ],
  [
    command(String.raw`(?:mail|mailx|sendmail|mutt|osascript)\b`),
    {
      consequence: "This sends a message or controls another app in your name.",
      permission: "Send a message",
      verbs: ["send", "mail", "email", "message", "text", "tell"],
    },
  ],
  [
    command(
      String.raw`(?:curl\b.*\s(?:-X\s*(?:POST|PUT|PATCH|DELETE)|--request\s+(?:POST|PUT|PATCH|DELETE)|-d\b|--data\S*|-F\b|--form\b|-T\b|--upload-file\b)|wget\b.*--post)`,
    ),
    {
      consequence: "This submits information to a server outside this computer.",
      permission: "Send data to a website",
      verbs: ["send", "post", "submit", "upload"],
    },
  ],
  [
    command(String.raw`(?:ssh|scp|sftp)\b|rsync\b.*\S:`),
    {
      consequence: "This runs commands on, or copies files to, another machine.",
      permission: "Connect to another computer",
      verbs: ["connect", "ssh", "copy", "upload", "sync"],
    },
  ],
  [
    git(
      String.raw`(?:reset\s+.*--hard|reset\s+--hard|clean\s+-\w*f|checkout\s+(?:-f\b|.*\s--\s)|checkout\s+--\s|restore\b|stash\s+(?:drop|clear)\b|branch\s+.*-D\b|branch\s+-D\b|switch\s+(?:.*\s)?(?:-f\b|--force|--discard-changes))`,
    ),
    {
      consequence: "Changes that were never committed, or a branch, are deleted and cannot be recovered.",
      permission: "Discard work",
      verbs: ["discard", "reset", "clean", "drop", "delete", "remove", "restore", "revert", "wipe", "throw"],
    },
  ],
  [
    command(String.raw`rm\s+(?:-\w+\s+)*(?:\S+\s+)*\.git(?:\s|/|$)`),
    {
      consequence: "Changes that were never committed, or a branch, are deleted and cannot be recovered.",
      permission: "Discard work",
      verbs: ["discard", "reset", "clean", "drop", "delete", "remove", "restore", "revert", "wipe", "throw"],
    },
  ],
  [
    command(String.raw`rm\s+(?:-\w+\s+)*(?:\S+\s+)*(?:\/|~|\$HOME|\.\.(?:\/|\s|$))`),
    {
      consequence: "They do not go to the Trash and cannot be recovered.",
      permission: "Delete files outside the workspace",
      verbs: ["delete", "remove", "erase", "wipe", "clean"],
    },
  ],
  [
    command(
      String.raw`(?:sudo|doas|su)\b|(?:launchctl|systemctl|crontab|shutdown|reboot|halt|diskutil|mkfs\S*|scutil|networksetup|csrutil|chsh)\b|defaults\s+(?:write|delete)\b|dd\s+\S*of=|(?:brew|apt|apt-get|dnf|yum|pacman|port)\s+(?:install|uninstall|remove|upgrade|reinstall)\b|(?:npm|pnpm|yarn)\s+(?:install|i|add|uninstall|remove)\s+(?:.*\s)?(?:-g|--global)\b|bun\s+(?:add|install|i|remove)\s+(?:.*\s)?(?:-g|--global)\b|yarn\s+global\b`,
    ),
    {
      consequence: "This alters settings or software outside the workspace, for every program on this computer.",
      permission: "Change this computer's system",
      verbs: [
        "install",
        "uninstall",
        "remove",
        "upgrade",
        "update",
        "change",
        "set",
        "configure",
        "enable",
        "disable",
        "schedule",
        "restart",
        "reboot",
      ],
    },
  ],
];

const secrets: Sensitivity = {
  consequence: "This opens credentials that give access to your accounts.",
  permission: "Read passwords or keys",
  verbs: ["read", "show", "get", "print", "use", "token", "key", "password", "credential"],
};
const secretCommand = command(String.raw`(?:security\s+(?:find|dump|export)-|gh\s+auth\s+token\b)`);

// Claude Code's file tools raise a prompt only outside the working folder at the default level.
const fileWritingTools = ["Write", "Edit", "MultiEdit", "NotebookEdit"];
const fileChange: Sensitivity = {
  consequence: "This changes a file that other programs on this computer may rely on.",
  permission: "Change a file outside the workspace",
  verbs: ["change", "edit", "write", "update", "modify"],
};

const sensitiveKinds = new Set([
  ...sensitiveCommands.map(([, sensitivity]) => sensitivity.permission),
  secrets.permission,
  fileChange.permission,
]);

/**
 * The sensitive kind a standing permission's sentence names, such as "Push code", or null for an ordinary
 * action: a permission covers only actions of its own kind, so a broad pattern cannot reach another kind.
 */
export const kindOfPermission = (sentence: string) => (sensitiveKinds.has(sentence) ? sentence : null);

/**
 * The sensitive action a harness tool call is, or null for ordinary work that runs without a
 * question (CHG-0035). A best-effort list: the thread flags what it misses through `request_approval`.
 */
export const sensitivityOf = (toolName: string, input: unknown): Sensitivity | null => {
  if (toolName === "Bash") {
    const text = (textFieldOf(input, "command") ?? "").trim();
    if (secretPath.test(text) || secretCommand.test(text)) return secrets;
    return sensitiveCommands.find(([pattern]) => pattern.test(text))?.[1] ?? null;
  }
  const path = pathFieldOf(input);
  if (path !== null && secretPath.test(path)) return secrets;
  return fileWritingTools.includes(toolName) ? fileChange : null;
};

const pathFieldOf = (input: unknown) =>
  textFieldOf(input, "file_path") ?? textFieldOf(input, "notebook_path") ?? textFieldOf(input, "path");

/** Whether a sensitivity is a file change, which Approvals clears when every changed file is inside the thread's folder. */
export const isFileChange = (sensitivity: Sensitivity | null) => sensitivity === fileChange;

/**
 * The files a file-writing call names. Codex lists several in one field joined by ", " (codex.ts), so the field is
 * split: a path holding ", " itself splits into parts that are each checked, which can only make it ask.
 */
export const changedFilesOf = (input: unknown) =>
  (pathFieldOf(input) ?? "")
    .split(", ")
    .map((path) => path.trim())
    .filter((path) => path !== "");
