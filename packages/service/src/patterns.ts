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

/** The question's sentence for a harness tool call, with Claude Code's own reason when it gives one. */
export const summaryOf = (toolName: string, input: unknown) => {
  const reason = stringField(input, "description")?.trim().replace(/\.$/, "") ?? "";
  return reason === "" ? `Claude Code asks to use ${toolName}.` : `Claude Code asks to use ${toolName}: ${reason}.`;
};

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

/**
 * Splits a command into `&&`-joined segments of words, removing quotes. Returns
 * null for anything this reading cannot vouch for: other shell operators,
 * redirections, substitutions, escapes, or unbalanced quotes.
 */
const segmentsOf = (command: string): Array<Array<string>> | null => {
  const segments: Array<Array<string>> = [[]];
  let word: string | null = null;
  let quote: "'" | '"' | null = null;
  const endWord = () => {
    if (word !== null) segments.at(-1)?.push(word);
    word = null;
  };
  for (let index = 0; index < command.length; index++) {
    const char = command[index] ?? "";
    if (quote !== null) {
      if (char === quote) quote = null;
      else if (quote === '"' && /[$`\\]/.test(char)) return null;
      else word = (word ?? "") + char;
    } else if (char === "'" || char === '"') {
      quote = char;
      word = word ?? "";
    } else if (char === " " || char === "\t") {
      endWord();
    } else if (char === "&" && command[index + 1] === "&") {
      endWord();
      segments.push([]);
      index++;
    } else if (/[;&|<>()`$\\\n\r]/.test(char)) {
      return null;
    } else {
      word = (word ?? "") + char;
    }
  }
  if (quote !== null) return null;
  endWord();
  return segments.every((segment) => segment.length > 0) ? segments : null;
};

const isInsideWorkspace = (path: string) =>
  path !== "" && !path.startsWith("/") && !path.startsWith("~") && !path.split("/").includes("..");

const forbids =
  (...options: ReadonlyArray<string>) =>
  (args: ReadonlyArray<string>) =>
    !args.some((arg) => options.includes(arg) || options.some((option) => arg.startsWith(`${option}=`)));

const isReading = (args: ReadonlyArray<string>) => !args.some((arg) => arg.startsWith("--output"));

const isLocalInit = (args: ReadonlyArray<string>) => {
  for (let index = 0; index < args.length; index++) {
    const arg = args[index] ?? "";
    if (arg === "-b" || arg === "--initial-branch") index++;
    else if (arg.startsWith("--initial-branch=") || ["--bare", "-q", "--quiet"].includes(arg)) continue;
    else if (arg.startsWith("-") || !isInsideWorkspace(arg)) return false;
  }
  return true;
};

const deletesOrForces = (arg: string) => /^-[a-zA-Z]*[dDf]/.test(arg) && !arg.startsWith("--");

// Local git that only changes the workspace's own repository (CHG-0032). Each
// entry refuses the options that delete, force, or write elsewhere.
const localGitCommands: Record<string, (args: ReadonlyArray<string>) => boolean> = {
  add: () => true,
  branch: (args) => !args.some(deletesOrForces) && forbids("--delete", "--force")(args),
  commit: () => true,
  diff: isReading,
  init: isLocalInit,
  log: isReading,
  "rev-parse": () => true,
  show: isReading,
  status: () => true,
  switch: forbids("-f", "--force", "--discard-changes", "-C", "--force-create"),
  tag: (args) => !args.some(deletesOrForces) && forbids("--delete", "--force")(args),
};

const isLocalGitSegment = (words: ReadonlyArray<string>) => {
  if (words[0] !== "git") return false;
  let index = 1;
  // Only an author name or address may be set inline; other settings can run code.
  while (words[index] === "-c") {
    const setting = words[index + 1] ?? "";
    if (!setting.startsWith("user.name=") && !setting.startsWith("user.email=")) return false;
    index += 2;
  }
  const command = words[index] ?? "";
  return Object.hasOwn(localGitCommands, command) && (localGitCommands[command]?.(words.slice(index + 1)) ?? false);
};

/** Whether a command is only local git on the workspace's repository, answered without a question at the default level. */
export const isLocalGit = (command: string) => {
  const segments = segmentsOf(command.trim());
  return segments?.every(isLocalGitSegment) ?? false;
};
