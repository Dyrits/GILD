import { Context, Effect, Layer, Ref } from "effect";

/** What the Threads service does for the tool server: start a thread's next turn, or interrupt its turn. */
export interface WakerHandlers {
  readonly interrupt: (threadId: string) => Effect.Effect<boolean>;
  readonly wake: (threadId: string) => Effect.Effect<void>;
}

/**
 * Starts a thread's next turn, or interrupts its running one, on behalf of the tool server. Threads
 * depends on the tool server for its endpoints, so the Threads layer registers its own handlers here once built.
 */
export class Waker extends Context.Service<
  Waker,
  {
    readonly register: (handlers: WakerHandlers) => Effect.Effect<void>;
    readonly interrupt: (threadId: string) => Effect.Effect<boolean>;
    readonly wake: (threadId: string) => Effect.Effect<void>;
  }
>()("openmission/Waker") {}

export const wakerLayer = Layer.effect(
  Waker,
  Effect.gen(function* () {
    const registered = yield* Ref.make<WakerHandlers>({
      interrupt: () => Effect.succeed(false),
      wake: () => Effect.void,
    });
    return {
      interrupt: (threadId) => Ref.get(registered).pipe(Effect.flatMap((handlers) => handlers.interrupt(threadId))),
      register: (handlers) => Ref.set(registered, handlers),
      wake: (threadId) => Ref.get(registered).pipe(Effect.flatMap((handlers) => handlers.wake(threadId))),
    };
  }),
);
