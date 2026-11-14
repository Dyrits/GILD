import type { Activity } from "@iskios/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { textFieldOf } from "../core/index.ts";
import { plainActionOf, reasonOf } from "../policy/patterns.ts";

// The tool calls a harness reports as they start, shown with a thread's actions as the steps of its turn
// (action-approval, What a working thread is doing).

const detailLength = 120;

/** The first line of a target, cut to a short line; a call's output and a file's content are never kept. */
const shortOf = (text: string) => {
  const [first = ""] = text.trim().split("\n");
  return first.length > detailLength || first !== text.trim() ? `${first.slice(0, detailLength).trimEnd()}…` : first;
};

/** Iskios's own tools, which the thread calls through its tool server, as the harness lists them. */
const iskiosPrefix = "mcp__iskios__";

/** Calls that already have a line of their own, or are the harness's own machinery. */
const leftOut = new Set([`${iskiosPrefix}request_approval`, `${iskiosPrefix}answer_prompt`]);

const kinds: Record<string, string> = {
  Glob: "List files",
  Grep: "Search files",
  TodoWrite: "Update its plan",
  ToolSearch: "Look up tools",
};

/** The target a call is about: its file, pattern, address, query, or what the harness says of a command. */
const detailOf = (toolName: string, input: unknown) => {
  if (toolName === "Bash") return shortOf(textFieldOf(input, "command") ?? "");
  const subject =
    textFieldOf(input, "file_path") ??
    textFieldOf(input, "notebook_path") ??
    textFieldOf(input, "pattern") ??
    textFieldOf(input, "url") ??
    textFieldOf(input, "query") ??
    "";
  return shortOf(subject);
};

/**
 * A harness tool call in plain words and a short target, or null for one left out. A command says what it is for when
 * the harness gives its reason, else it is "Run a command" with the command's first line.
 */
export const describedCall = (toolName: string, input: unknown): Pick<Activity, "detail" | "summary"> | null => {
  if (leftOut.has(toolName)) return null;
  if (toolName.startsWith(iskiosPrefix))
    return { detail: toolName.slice(iskiosPrefix.length).replaceAll("_", " "), summary: "Use an Iskios tool" };
  const kind = Object.hasOwn(kinds, toolName) ? kinds[toolName] : undefined;
  const summary = toolName === "Bash" ? (reasonOf(input) ?? "Run a command") : (kind ?? plainActionOf(toolName));
  return { detail: detailOf(toolName, input), summary };
};

/** A thread's tool calls that were not asked about as actions, oldest first. */
export const listThreadActivities = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    return yield* sql<Activity>`
      SELECT id, at, summary, detail FROM thread_activities
      WHERE thread_id = ${threadId} AND is_prompted = 0 ORDER BY at, rowid`;
  });

/**
 * Marks a call as having reached the permission prompt, whichever of the two arrives first, so it shows once, as its
 * action. A prompt for a call the harness never reported leaves a hidden row.
 */
export const markPrompted = (threadId: string, toolUseId: string, at: number) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`INSERT INTO thread_activities (id, thread_id, at, summary, detail, is_prompted)
      VALUES (${toolUseId}, ${threadId}, ${at}, '', '', 1)
      ON CONFLICT (thread_id, id) DO UPDATE SET is_prompted = 1`;
  });
