import { Context, Effect, Layer, Ref } from "effect";

/**
 * Starts a thread's next turn on behalf of the tool server. Threads depends on the tool server for its
 * endpoints, so the Threads layer registers its own wake here once built.
 */
export class Waker extends Context.Service<
  Waker,
  {
    readonly register: (wake: (threadId: string) => Effect.Effect<void>) => Effect.Effect<void>;
    readonly wake: (threadId: string) => Effect.Effect<void>;
  }
>()("openmission/Waker") {}

export const wakerLayer = Layer.effect(
  Waker,
  Effect.gen(function* () {
    const registered = yield* Ref.make<(threadId: string) => Effect.Effect<void>>(() => Effect.void);
    return {
      register: (wake) => Ref.set(registered, wake),
      wake: (threadId) => Ref.get(registered).pipe(Effect.flatMap((wake) => wake(threadId))),
    };
  }),
);
