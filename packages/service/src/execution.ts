import type { ApprovalLevel, EffortChoice, ModelChoice, TokenUsage } from "@openmission/contracts";
import { Context, Deferred, type Duration, Effect, Layer, Schema } from "effect";

export type HarnessEvent =
  /** A complete assistant message, to be saved. */
  | { readonly _tag: "Reply"; readonly text: string }
  /** The assistant message written so far, never saved. */
  | { readonly _tag: "Draft"; readonly text: string }
  /** A message steered into the running turn was taken in by it (CHG-0039). */
  | { readonly _tag: "Delivered"; readonly messageId: string };

/** A message to steer into a thread's running turn, by its identifier. */
export interface SteeredMessage {
  readonly id: string;
  readonly text: string;
}

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
  /**
   * The turn's API-key cost when the harness reports one; null counts the turn's tokens as subscription
   * spending (budget-control, Budgets; provisional, work-in-progress Batch 11).
   */
  readonly cost: number | null;
  /** Whether the turn ended because it was interrupted (thread-messaging, Interruptions). */
  readonly isInterrupted: boolean;
  readonly sessionId: string;
  /** Null when the harness reported no usage; shown as unknown, never guessed. */
  readonly usage: TokenUsage | null;
}

export class HarnessFailure extends Schema.TaggedError<HarnessFailure>()("HarnessFailure", { reason: Schema.String }) {}

/** The harness seam: runs one turn of a thread, reports its events, and lets it be steered and interrupted. */
export class Harness extends Context.Service<
  Harness,
  {
    readonly runTurn: (request: TurnRequest) => Effect.Effect<TurnOutcome, HarnessFailure>;
    /**
     * Writes a message into the thread's running turn; false when no turn runs. Its `Delivered` event
     * follows once the turn takes it in; one not taken in by the turn's end is left for the next turn.
     */
    readonly steer: (threadId: string, message: SteeredMessage) => Effect.Effect<boolean>;
    /** Ends the thread's running turn, whose `runTurn` then returns as interrupted; false when none runs. */
    readonly interrupt: (threadId: string) => Effect.Effect<boolean>;
  }
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
// report the working folder and the starting context; `spend <tokens> [cost]` reports spending at the turn's end.
const scriptedCall = (request: TurnRequest, line: string, turn: FakeTurn) => {
  const access = request.access;
  const spend = /^spend (\d+)(?: (\d+(?:\.\d+)?))?$/.exec(line);
  if (spend !== null) {
    return Effect.sync(() => {
      turn.spent.tokens += Number(spend[1]);
      if (spend[2] !== undefined) turn.spent.cost = (turn.spent.cost ?? 0) + Number(spend[2]);
      turn.spent.isReported = true;
      return `spent ${spend[1]}`;
    });
  }
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

/** A fake turn in progress: the messages steered into it, and its interrupt signal. */
interface FakeTurn {
  readonly interrupted: Deferred.Deferred<void>;
  readonly onEvent: TurnRequest["onEvent"];
  /** What the turn's `spend` lines reported. */
  readonly spent: { tokens: number; cost: number | null; isReported: boolean };
  readonly steered: Array<string>;
}

/**
 * A deterministic harness for checks: it runs scripted tool calls, then echoes after a delay. Messages
 * steered in while it runs are taken in at once, run the same way, and appended to the echo after " + ".
 */
export const fakeHarnessLayer = (replyDelay: Duration.Input) =>
  Layer.sync(Harness, () => {
    const running = new Map<string, FakeTurn>();
    const script = (request: TurnRequest, turn: FakeTurn) =>
      Effect.gen(function* () {
        yield* Effect.sleep(replyDelay);
        const echoOf = (text: string) =>
          Effect.gen(function* () {
            const results: Array<string> = [];
            for (const line of text.split("\n")) {
              const call = scriptedCall(request, line.trim(), turn);
              if (call !== null) results.push(yield* call);
            }
            return results.length === 0 ? text : results.join(" | ");
          });
        let echo = yield* echoOf(request.text);
        // Steered messages are acted on too, including those steered in while one is acted on.
        for (let index = 0; index < turn.steered.length; index++) {
          echo += ` + ${yield* echoOf(turn.steered[index] ?? "")}`;
        }
        running.delete(request.threadId);
        yield* request.onEvent({ _tag: "Reply", text: `Echo: ${echo}` });
        return false;
      });
    return {
      interrupt: (threadId) =>
        Effect.suspend(() => {
          const turn = running.get(threadId);
          return turn === undefined ? Effect.succeed(false) : Deferred.succeed(turn.interrupted, void 0);
        }),
      runTurn: (request) =>
        Effect.gen(function* () {
          const turn: FakeTurn = {
            interrupted: yield* Deferred.make<void>(),
            onEvent: request.onEvent,
            spent: { cost: null, isReported: false, tokens: 0 },
            steered: [],
          };
          running.set(request.threadId, turn);
          const isInterrupted = yield* Effect.raceFirst(
            script(request, turn),
            Deferred.await(turn.interrupted).pipe(Effect.as(true)),
          ).pipe(Effect.ensuring(Effect.sync(() => running.delete(request.threadId))));
          const { cost, isReported, tokens } = turn.spent;
          return {
            cost: isReported ? cost : null,
            isInterrupted,
            sessionId: request.sessionId ?? `fake-${request.threadId}`,
            usage: isReported ? { cacheCreation: 0, cacheRead: 0, input: tokens, output: 0 } : null,
          };
        }),
      steer: (threadId, message) =>
        Effect.suspend(() => {
          const turn = running.get(threadId);
          if (turn === undefined) return Effect.succeed(false);
          turn.steered.push(message.text);
          return turn.onEvent({ _tag: "Delivered", messageId: message.id }).pipe(Effect.as(true));
        }),
    };
  });
