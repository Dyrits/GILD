import { Context, type Duration, Effect, Layer } from "effect";

/** The harness seam: one turn answers the messages delivered to it. */
export class Harness extends Context.Service<
  Harness,
  {
    readonly runTurn: (input: {
      readonly messages: ReadonlyArray<string>;
    }) => Effect.Effect<{ readonly reply: string }>;
  }
>()("openmission/Harness") {}

/** A deterministic harness for checks and the first batch: it echoes after a delay. */
export const fakeHarnessLayer = (replyDelay: Duration.Input) =>
  Layer.succeed(Harness, {
    runTurn: ({ messages }) => Effect.sleep(replyDelay).pipe(Effect.as({ reply: `Echo: ${messages.join("\n\n")}` })),
  });
