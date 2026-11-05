import type { EffortChoice, ModelChoice, TokenUsage } from "@openmission/contracts";
import { Context, Data, type Duration, Effect, Layer } from "effect";

export type HarnessEvent =
  /** A complete assistant message, to be saved. */
  | { readonly _tag: "Reply"; readonly text: string }
  /** The assistant message written so far, never saved. */
  | { readonly _tag: "Draft"; readonly text: string };

export interface TurnRequest {
  readonly threadId: string;
  /** The harness session to continue, or null for the thread's first turn. */
  readonly sessionId: string | null;
  readonly model: ModelChoice;
  readonly effort: EffortChoice;
  readonly cwd: string;
  readonly text: string;
  readonly onEvent: (event: HarnessEvent) => Effect.Effect<void>;
}

export interface TurnOutcome {
  readonly sessionId: string;
  /** Null when the harness reported no usage; shown as unknown, never guessed. */
  readonly usage: TokenUsage | null;
}

export class HarnessFailure extends Data.TaggedError("HarnessFailure")<{ readonly reason: string }> {}

/** The harness seam: runs one turn of a thread and reports its events. */
export class Harness extends Context.Service<
  Harness,
  { readonly runTurn: (request: TurnRequest) => Effect.Effect<TurnOutcome, HarnessFailure> }
>()("openmission/Harness") {}

/** A deterministic harness for checks: it echoes after a delay. */
export const fakeHarnessLayer = (replyDelay: Duration.Input) =>
  Layer.succeed(Harness, {
    runTurn: (request) =>
      Effect.sleep(replyDelay).pipe(
        Effect.andThen(request.onEvent({ _tag: "Reply", text: `Echo: ${request.text}` })),
        Effect.as({ sessionId: request.sessionId ?? `fake-${request.threadId}`, usage: null }),
      ),
  });
