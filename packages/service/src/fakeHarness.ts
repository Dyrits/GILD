import { Deferred, type Duration, Effect, Layer } from "effect";
import { Harness, type TurnRequest } from "./execution.ts";
import { fieldOf } from "./lineProcess.ts";

/** Calls one tool on a thread's MCP endpoint and returns its text, as a harness would; for the fake and checks. */
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
    const content = fieldOf(fieldOf(JSON.parse(data), "result"), "content");
    return Array.isArray(content) ? content.map((block) => String(fieldOf(block, "text") ?? "")).join("") : "";
  });

// The fake's script: a line `ask <json>` calls request_approval, `prompt <tool> <json input>` asks the
// owner about a harness action, and `call <tool> <json>` calls any thread tool, each answered before
// the echo; `wait <millis>` keeps the turn running; `cwd` and `context` report the working folder and
// the starting context; `spend <tokens> [cost]` reports spending at the turn's end.
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
  if (line === "context")
    return Effect.succeed([request.context, request.note].filter((part) => part !== null).join("\n\n"));
  const wait = /^wait (\d+)$/.exec(line);
  if (wait !== null) return Effect.sleep(Number(wait[1])).pipe(Effect.as(`waited ${wait[1]}`));
  const tool = /^call (\S+) (.*)$/.exec(line);
  if (tool !== null) return callThreadTool(access.mcpUrl, tool[1] ?? "", JSON.parse(tool[2] ?? "{}"));
  if (line.startsWith("ask ")) return callThreadTool(access.mcpUrl, "request_approval", JSON.parse(line.slice(4)));
  const prompt = /^prompt (\S+) (.*)$/.exec(line);
  if (prompt !== null) {
    return request
      .askOwner({ input: JSON.parse(prompt[2] ?? "{}"), toolName: prompt[1] ?? "" })
      .pipe(Effect.map((answer) => (answer.isAllowed ? "prompt allowed" : `prompt denied: ${answer.text}`)));
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
