import { textFieldOf } from "../core/index.ts";

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

// Sandbox-first autonomy (CHG-0208): no command is judged by its words. What asks is decided by where an action runs:
// leaving an active sandbox, or running where none protects the computer. These capabilities name what such a
// question allows, and a standing permission of one covers only actions needing that same capability.

/** What a harness action needs beyond its sandbox, as its question names it and Always allow saves it. */
export const capabilities = {
  /** A file change outside the thread's folder made by the harness itself, which no sandbox confines. */
  fileOutsideWorkspace: "Change a file outside the workspace",
  /** A command that leaves its harness's active sandbox (Claude Code's `dangerouslyDisableSandbox`, Codex's escalation). */
  outsideSandbox: "Run outside the sandbox",
  /** Any action of a harness that runs with no enforced sandbox here. */
  unsandboxed: "Run without a sandbox",
  /** Codex's request to widen its sandbox for the turn. */
  widenSandbox: "Widen the sandbox",
} as const;

/** The name of one capability a harness prompt may need. */
export type Capability = (typeof capabilities)[keyof typeof capabilities];

/** What each capability lets an action do, in plain words, after its reason in the question. */
export const consequences = {
  [capabilities.outsideSandbox]:
    "This runs outside the sandbox, with your full access to this computer's files and programs.",
  [capabilities.fileOutsideWorkspace]:
    "This changes a file outside the workspace that other programs on this computer may rely on.",
  [capabilities.widenSandbox]: "This widens what the sandbox allows for the rest of the turn.",
  [capabilities.unsandboxed]: "No sandbox protects this computer here, so this runs with your full access.",
} as const satisfies Record<Capability, string>;

const capabilityNames = new Set<string>(Object.values(capabilities));

/**
 * The capability a standing permission's sentence names, or null for an ordinary action: a permission covers only
 * actions needing its own capability, so one saved for an ordinary command never covers that command's escape.
 */
export const kindOfPermission = (sentence: string) => (capabilityNames.has(sentence) ? sentence : null);

// The harness tools that change files themselves, outside any command sandbox.
const fileWritingTools = ["Write", "Edit", "MultiEdit", "NotebookEdit"];

/** Whether a harness tool call changes files with the harness's own tool rather than a command. */
export const isFileWriting = (toolName: string) => fileWritingTools.includes(toolName);

const pathFieldOf = (input: unknown) =>
  textFieldOf(input, "file_path") ?? textFieldOf(input, "notebook_path") ?? textFieldOf(input, "path");

/**
 * The files a file-writing call names. Codex lists several in one field joined by ", " (codex.ts), so the field is
 * split: a path holding ", " itself splits into parts that are each checked, which can only make it ask.
 */
export const changedFilesOf = (input: unknown) =>
  (pathFieldOf(input) ?? "")
    .split(", ")
    .map((path) => path.trim())
    .filter((path) => path !== "");
