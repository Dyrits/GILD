import type { ApprovalLevel, EffortChoice, ModelChoice, TokenUsage } from "@openmission/contracts";
import { Context, type Duration, Effect, Layer, Schema } from "effect";

export type HarnessEvent =
  /** A complete assistant message, to be saved. */
  | { readonly _tag: "Reply"; readonly text: string }
  /** The assistant message written so far, never saved. */
  | { readonly _tag: "Draft"; readonly text: string };

/** What a thread may use in a turn, and how its actions are approved (CHG-0031). */
export interface ThreadAccess {
  readonly approvalLevel: ApprovalLevel;
  /** Whether the thread works in a workspace, whose sandbox may fetch dependencies (CHG-0034). */
  readonly isInWorkspace: boolean;
  /** The thread's own MCP endpoint serving `request_approval` and the permission prompt tool. */
  readonly mcpUrl: string;
  /** The sentences of the standing permissions that apply to the thread. */
  readonly permissions: ReadonlyArray<string>;
}

export interface TurnRequest {
  readonly access: ThreadAccess;
  /** The starting context: the thread's workspace, or its scratch folder, with the folder's own instructions. */
  readonly context: string;
  readonly cwd: string;
  readonly effort: EffortChoice;
  readonly model: ModelChoice;
  readonly onEvent: (event: HarnessEvent) => Effect.Effect<void>;
  /** The harness session to continue, or null for the thread's first turn. */
  readonly sessionId: string | null;
  readonly text: string;
  readonly threadId: string;
}

export interface TurnOutcome {
  readonly sessionId: string;
  /** Null when the harness reported no usage; shown as unknown, never guessed. */
  readonly usage: TokenUsage | null;
}

export class HarnessFailure extends Schema.TaggedError<HarnessFailure>()("HarnessFailure", { reason: Schema.String }) {}

/** The harness seam: runs one turn of a thread and reports its events. */
export class Harness extends Context.Service<
  Harness,
  { readonly runTurn: (request: TurnRequest) => Effect.Effect<TurnOutcome, HarnessFailure> }
>()("openmission/Harness") {}

/** Calls one tool on a thread's MCP endpoint and returns its text, as Claude Code would. */
export const callThreadTool = (mcpUrl: string, name: string, args: unknown) =>
  Effect.promise(async () => {
    const response = await fetch(mcpUrl, {
      body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "tools/call", params: { arguments: args, name } }),
      headers: { accept: "application/json, text/event-stream", "content-type": "application/json" },
      method: "POST",
    });
    const body = await response.text();
    const data = body
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => line.slice("data: ".length))
      .join("");
    const parsed = JSON.parse(data) as { result: { content: Array<{ text: string }> } };
    return parsed.result.content.map((block) => block.text).join("");
  });

// The fake's script: a line `ask <json>` calls request_approval, `prompt <tool> <json input>`
// raises a harness permission prompt, and `call <tool> <json>` calls any thread tool, each
// answered before the echo; `wait <millis>` keeps the turn running; `cwd` and `context`
// report the working folder and the starting context.
const scriptedCall = (request: TurnRequest, line: string) => {
  const access = request.access;
  if (line === "cwd") return Effect.succeed(request.cwd);
  if (line === "context") return Effect.succeed(request.context);
  const wait = /^wait (\d+)$/.exec(line);
  if (wait !== null) return Effect.sleep(Number(wait[1])).pipe(Effect.as(`waited ${wait[1]}`));
  const tool = /^call (\S+) (.*)$/.exec(line);
  if (tool !== null) return callThreadTool(access.mcpUrl, tool[1] ?? "", JSON.parse(tool[2] ?? "{}"));
  if (line.startsWith("ask ")) return callThreadTool(access.mcpUrl, "request_approval", JSON.parse(line.slice(4)));
  const prompt = /^prompt (\S+) (.*)$/.exec(line);
  if (prompt !== null) {
    return callThreadTool(access.mcpUrl, "answer_prompt", {
      input: JSON.parse(prompt[2] ?? "{}"),
      tool_name: prompt[1] ?? "",
    });
  }
  return null;
};

/** A deterministic harness for checks: it runs scripted tool calls, then echoes after a delay. */
export const fakeHarnessLayer = (replyDelay: Duration.Input) =>
  Layer.succeed(Harness, {
    runTurn: (request) =>
      Effect.gen(function* () {
        yield* Effect.sleep(replyDelay);
        const results: Array<string> = [];
        for (const line of request.text.split("\n")) {
          const call = scriptedCall(request, line.trim());
          if (call !== null) results.push(yield* call);
        }
        const text = results.length === 0 ? `Echo: ${request.text}` : `Echo: ${results.join(" | ")}`;
        yield* request.onEvent({ _tag: "Reply", text });
        return { sessionId: request.sessionId ?? `fake-${request.threadId}`, usage: null };
      }),
  });
