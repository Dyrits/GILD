import type { BillingKind, TokenUsage } from "@gild/contracts";
import { Deferred, type Duration, Effect, Layer } from "effect";
import { fieldOf, Harness, HarnessFailure, type ImageAttachment, type TurnRequest } from "../core/index.ts";

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
// the echo; `wait <millis>` keeps the turn running; `fail <harness> <reason>` fails the turn on that harness; `cwd`, `context`, and `runner` report the working folder, the
// starting context, and the harness, model, effort, and session; `spend <tokens> [cost]` reports spending at the turn's end,
// `usage <input> <output> <cacheRead> <cacheWrite>` reports tokens by kind, `callusage <input> <output> <cacheRead> <cacheWrite>` gives the reply's own call its usage, and `billing <Subscription|ApiKey|Unknown>` names how the turn was billed (a turn that reports a cost and names none is API-key, as before).
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
  const call = /^callusage (\d+) (\d+) (\d+) (\d+)$/.exec(line);
  if (call !== null) {
    return Effect.sync(() => {
      turn.spent.callUsage = {
        cacheCreation: Number(call[4]),
        cacheRead: Number(call[3]),
        input: Number(call[1]),
        output: Number(call[2]),
      };
      return "call used tokens";
    });
  }
  const kinds = /^usage (\d+) (\d+) (\d+) (\d+)$/.exec(line);
  if (kinds !== null) {
    return Effect.sync(() => {
      turn.spent.kinds = {
        cacheCreation: Number(kinds[4]),
        cacheRead: Number(kinds[3]),
        input: Number(kinds[1]),
        output: Number(kinds[2]),
      };
      turn.spent.isReported = true;
      return "used tokens";
    });
  }
  const billing = /^billing (Subscription|ApiKey|Unknown)$/.exec(line);
  if (billing !== null) {
    return Effect.sync(() => {
      turn.spent.billing = billing[1] as BillingKind;
      return `billed ${billing[1]}`;
    });
  }
  // `fail <harness> <reason>` ends the turn as a failure when it runs on that harness, as one that cannot run does.
  const failure = /^fail (\S+) (.*)$/.exec(line);
  if (failure !== null && failure[1] === request.harness)
    return Effect.fail(new HarnessFailure({ reason: failure[2] ?? "" }));
  if (line === "cwd") return Effect.succeed(request.cwd);
  // What the turn runs on, and whether it continues a harness session or starts one.
  if (line === "runner")
    return Effect.succeed(
      `${request.harness}/${request.model}/${request.effort}/${request.sessionId === null ? "session none" : `session ${request.sessionId}`}`,
    );
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

/** What the echo says of the images a message carries, so checks see that they reached the harness. */
const imagesNoteOf = (images: ReadonlyArray<ImageAttachment>) =>
  images.length === 0 ? "" : ` [images: ${images.map((image) => image.name).join(", ")}]`;

/** A fake turn in progress: the messages steered into it, and its interrupt signal. */
interface FakeTurn {
  readonly interrupted: Deferred.Deferred<void>;
  readonly onEvent: TurnRequest["onEvent"];
  /** What the turn's `spend` lines reported. */
  readonly spent: {
    tokens: number;
    cost: number | null;
    isReported: boolean;
    billing: BillingKind | null;
    kinds: TokenUsage | null;
    callUsage: TokenUsage | null;
  };
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
        let echo = (yield* echoOf(request.text)) + imagesNoteOf(request.images);
        // Steered messages are acted on too, including those steered in while one is acted on.
        for (let index = 0; index < turn.steered.length; index++) {
          echo += ` + ${yield* echoOf(turn.steered[index] ?? "")}`;
        }
        running.delete(request.threadId);
        yield* request.onEvent({ _tag: "Reply", text: `Echo: ${echo}`, usage: turn.spent.callUsage });
        return false;
      });
    return {
      interrupt: (threadId) =>
        Effect.suspend(() => {
          const turn = running.get(threadId);
          return turn === undefined ? Effect.succeed(false) : Deferred.succeed(turn.interrupted, void 0);
        }),
      readPlanLimits: () => Effect.succeed(null),
      runTurn: (request) =>
        Effect.gen(function* () {
          const turn: FakeTurn = {
            interrupted: yield* Deferred.make<void>(),
            onEvent: request.onEvent,
            spent: { billing: null, callUsage: null, cost: null, isReported: false, kinds: null, tokens: 0 },
            steered: [],
          };
          running.set(request.threadId, turn);
          const isInterrupted = yield* Effect.raceFirst(
            script(request, turn),
            Deferred.await(turn.interrupted).pipe(Effect.as(true)),
          ).pipe(Effect.ensuring(Effect.sync(() => running.delete(request.threadId))));
          const { billing, cost, isReported, kinds, tokens } = turn.spent;
          return {
            billing: billing ?? (cost === null ? "Subscription" : "ApiKey"),
            // The fake's context is what it was told to spend: its latest call's whole prompt.
            context: isReported
              ? kinds === null
                ? tokens
                : kinds.input + kinds.cacheRead + kinds.cacheCreation + kinds.output
              : null,
            cost: isReported ? cost : null,
            isInterrupted,
            sessionId: request.sessionId ?? `fake-${request.threadId}`,
            usage: isReported ? (kinds ?? { cacheCreation: 0, cacheRead: 0, input: tokens, output: 0 }) : null,
          };
        }),
      steer: (threadId, message) =>
        Effect.suspend(() => {
          const turn = running.get(threadId);
          if (turn === undefined) return Effect.succeed(false);
          turn.steered.push(message.text + imagesNoteOf(message.images));
          return turn.onEvent({ _tag: "Delivered", messageId: message.id }).pipe(Effect.as(true));
        }),
    };
  });
