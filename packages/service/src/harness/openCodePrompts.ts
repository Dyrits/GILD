import { Effect } from "effect";
import {
  fieldOf,
  type HarnessPrompt,
  isInsideFolder,
  type PromptAnswer,
  type TurnRequest,
  textFieldOf,
} from "../core/index.ts";

/** The paths listed under a field holding an array of objects with a `path`, such as `locations` or `content`. */
const listedPathsOf = (toolCall: unknown, key: string) => {
  const items = fieldOf(toolCall, key);
  return Array.isArray(items) ? items.map((item) => textFieldOf(item, "path")) : [];
};

/**
 * Every file an edit names. OpenCode 2.2.0, probed live on 2026-11-08, sends `locations` and `content` diffs
 * with absolute paths and `rawInput.path` as the model wrote it; `filePath` is kept for older versions.
 */
export const editedPathsOf = (toolCall: unknown) => {
  const input = fieldOf(toolCall, "rawInput");
  const paths = [
    ...listedPathsOf(toolCall, "locations"),
    ...listedPathsOf(toolCall, "content"),
    textFieldOf(input, "path"),
    textFieldOf(input, "filePath"),
  ].filter((path) => path !== null);
  return [...new Set(paths)];
};

/** The harness tool and input the owner is asked about for one of OpenCode's permission requests. */
export const promptOf = (toolCall: unknown, firstOutside: string | null = null) => {
  const kind = textFieldOf(toolCall, "kind");
  const title = textFieldOf(toolCall, "title") ?? "a tool";
  const input = fieldOf(toolCall, "rawInput");
  if (kind === "execute") return { input: { command: textFieldOf(input, "command") ?? title }, toolName: "Bash" };
  // The owner is asked about the first file outside the folder, or the first file when none is, and sees every file
  // the edit names (audit SA-09): OpenCode resolves the locations, while its input keeps the model's own path.
  if (kind === "edit") {
    const paths = editedPathsOf(toolCall);
    return {
      input: { file_path: firstOutside ?? paths[0] ?? title, ...(paths.length > 1 ? { file_paths: paths } : {}) },
      toolName: "Edit",
    };
  }
  return { input: input ?? { query: title }, toolName: textFieldOf(toolCall, "name") ?? title };
};

/** The first file an edit names that lies outside the thread's folder, or null when every one is inside. */
export const firstOutsideOf = Effect.fnUntraced(function* (request: TurnRequest, toolCall: unknown) {
  for (const path of editedPathsOf(toolCall)) if (!(yield* isInsideFolder(request.cwd, path))) return path;
  return null;
});

/**
 * Whether an edit runs without asking: at the default level, editing inside the thread's folder does, as Claude
 * Code and Codex allow it in their sandbox; editing outside it asks (workspace-attachment). An edit naming no file
 * asks.
 */
export const isUnaskedEdit = Effect.fnUntraced(function* (request: TurnRequest, toolCall: unknown) {
  if (request.access.approvalLevel !== "RiskyOnly" || textFieldOf(toolCall, "kind") !== "edit") return false;
  const paths = editedPathsOf(toolCall);
  if (paths.length === 0) return false;
  for (const path of paths) if (!(yield* isInsideFolder(request.cwd, path))) return false;
  return true;
});

/** The refused action, named for the model: the command, the file, or the tool. */
const refusedActionOf = (prompt: HarnessPrompt) => {
  const command = textFieldOf(prompt.input, "command");
  if (prompt.toolName === "Bash" && command !== null) return `the command \`${command}\``;
  const path = textFieldOf(prompt.input, "file_path");
  if (prompt.toolName === "Edit" && path !== null) return `the change to \`${path}\``;
  return `the tool ${prompt.toolName}`;
};

/** What the next prompt tells OpenCode about one refused action: what was refused and the owner's answer. */
export const refusalOf = (prompt: HarnessPrompt, answer: PromptAnswer) =>
  `Iskios refused ${refusedActionOf(prompt)}. ${answer.text}`;
