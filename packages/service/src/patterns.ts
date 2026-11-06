import { Predicate } from "effect";

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

const stringField = (input: unknown, key: string) =>
  Predicate.isObject(input) && Predicate.hasProperty(input, key) && Predicate.isString(input[key]) ? input[key] : null;

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
  const reason = stringField(input, "description")?.trim().replace(/\.$/, "") ?? "";
  return reason === "" ? null : reason;
};

/** The kind of a harness tool call in plain words, such as "Run a command". */
export const plainActionOf = (toolName: string) =>
  Object.hasOwn(plainActions, toolName) ? (plainActions[toolName] ?? toolName) : `Use ${toolName}`;

/** The exact target of a harness tool call: the command for Bash, else the tool and its file, address, or input. */
export const targetOf = (toolName: string, input: unknown) => {
  if (toolName === "Bash") return stringField(input, "command") ?? "";
  const subject =
    stringField(input, "file_path") ??
    stringField(input, "notebook_path") ??
    stringField(input, "url") ??
    stringField(input, "query") ??
    JSON.stringify(input);
  return `${toolName} ${subject}`;
};

/** A sensitive action: the kind Always allow saves, and what it affects, in plain words (CHG-0035). */
export interface Sensitivity {
  readonly consequence: string;
  readonly permission: string;
}

// Where a command word may begin: the start, or after a shell operator, a
// substitution, or a wrapper such as `bunx`, `npx`, or `xargs`.
const commandStart = /(?:^|[;&|({\n`]|\$\(|\bbunx\s+|\bnpx\s+|\bxargs\s+)\s*/.source;
const command = (body: string) => new RegExp(`${commandStart}${body}`);
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
    },
  ],
  [
    command(
      String.raw`(?:(?:npm|bun|yarn|pnpm|cargo|poetry|gem)\s+(?:publish|push)\b|twine\s+upload\b|docker\s+push\b|gh\s+release\s+(?:create|upload|edit|delete)\b)`,
    ),
    {
      consequence: "This makes a package or release public, and a published version usually cannot be taken back.",
      permission: "Publish",
    },
  ],
  [
    command(
      String.raw`(?:wrangler\s+(?:deploy|publish|pages\s+deploy)\b|vercel\b|netlify\s+deploy\b|fly(?:ctl)?\s+deploy\b|firebase\s+deploy\b|terraform\s+(?:apply|destroy)\b|pulumi\s+(?:up|destroy)\b|kubectl\s+(?:apply|delete|create|replace|rollout|scale)\b|serverless\s+deploy\b|heroku\b|cf\s+deploy\b)`,
    ),
    { consequence: "This changes a live service that other people may be using.", permission: "Deploy" },
  ],
  [
    command(
      String.raw`gh\s+(?:(?:pr|issue)\s+(?:create|comment|merge|close|reopen|edit|review|delete)\b|repo\s+(?:create|delete|edit|rename|archive)\b|api\b.*\s(?:-X\s*(?:POST|PUT|PATCH|DELETE)|--method\s+(?:POST|PUT|PATCH|DELETE)|-[fF]\s))`,
    ),
    {
      consequence: "This writes something under your GitHub account that other people can see.",
      permission: "Post on GitHub",
    },
  ],
  [
    command(String.raw`(?:mail|mailx|sendmail|mutt|osascript)\b`),
    { consequence: "This sends a message or controls another app in your name.", permission: "Send a message" },
  ],
  [
    command(
      String.raw`(?:curl\b.*\s(?:-X\s*(?:POST|PUT|PATCH|DELETE)|--request\s+(?:POST|PUT|PATCH|DELETE)|-d\b|--data\S*|-F\b|--form\b|-T\b|--upload-file\b)|wget\b.*--post)`,
    ),
    {
      consequence: "This submits information to a server outside this computer.",
      permission: "Send data to a website",
    },
  ],
  [
    command(String.raw`(?:ssh|scp|sftp)\b|rsync\b.*\S:`),
    {
      consequence: "This runs commands on, or copies files to, another machine.",
      permission: "Connect to another computer",
    },
  ],
  [
    git(
      String.raw`(?:reset\s+.*--hard|reset\s+--hard|clean\s+-\w*f|checkout\s+(?:-f\b|.*\s--\s)|checkout\s+--\s|restore\b|stash\s+(?:drop|clear)\b|branch\s+.*-D\b|branch\s+-D\b|switch\s+(?:.*\s)?(?:-f\b|--force|--discard-changes))`,
    ),
    {
      consequence: "Changes that were never committed, or a branch, are deleted and cannot be recovered.",
      permission: "Discard work",
    },
  ],
  [
    command(String.raw`rm\s+(?:-\w+\s+)*(?:\S+\s+)*\.git(?:\s|/|$)`),
    {
      consequence: "Changes that were never committed, or a branch, are deleted and cannot be recovered.",
      permission: "Discard work",
    },
  ],
  [
    command(String.raw`rm\s+(?:-\w+\s+)*(?:\S+\s+)*(?:\/|~|\$HOME|\.\.(?:\/|\s|$))`),
    {
      consequence: "They do not go to the Trash and cannot be recovered.",
      permission: "Delete files outside the workspace",
    },
  ],
  [
    command(
      String.raw`(?:sudo|doas|su)\b|(?:launchctl|systemctl|crontab|shutdown|reboot|halt|diskutil|mkfs\S*|scutil|networksetup|csrutil|chsh)\b|defaults\s+(?:write|delete)\b|dd\s+\S*of=|(?:brew|apt|apt-get|dnf|yum|pacman|port)\s+(?:install|uninstall|remove|upgrade|reinstall)\b|(?:npm|pnpm|yarn)\s+(?:install|i|add|uninstall|remove)\s+(?:.*\s)?(?:-g|--global)\b|bun\s+(?:add|install|i|remove)\s+(?:.*\s)?(?:-g|--global)\b|yarn\s+global\b`,
    ),
    {
      consequence: "This alters settings or software outside the workspace, for every program on this computer.",
      permission: "Change this computer's system",
    },
  ],
];

const secrets: Sensitivity = {
  consequence: "This opens credentials that give access to your accounts.",
  permission: "Read passwords or keys",
};
const secretCommand = command(String.raw`(?:security\s+(?:find|dump|export)-|gh\s+auth\s+token\b)`);

// Claude Code's file tools raise a prompt only outside the working folder at the default level.
const fileWritingTools = ["Write", "Edit", "MultiEdit", "NotebookEdit"];

/**
 * The sensitive action a harness tool call is, or null for ordinary work that runs without a
 * question (CHG-0035). A best-effort list: the thread flags what it misses through `request_approval`.
 */
export const sensitivityOf = (toolName: string, input: unknown): Sensitivity | null => {
  if (toolName === "Bash") {
    const text = (stringField(input, "command") ?? "").trim();
    if (secretPath.test(text) || secretCommand.test(text)) return secrets;
    return sensitiveCommands.find(([pattern]) => pattern.test(text))?.[1] ?? null;
  }
  const path = stringField(input, "file_path") ?? stringField(input, "notebook_path") ?? stringField(input, "path");
  if (path !== null && secretPath.test(path)) return secrets;
  if (fileWritingTools.includes(toolName)) {
    return {
      consequence: "This changes a file that other programs on this computer may rely on.",
      permission: "Change a file outside the workspace",
    };
  }
  return null;
};
