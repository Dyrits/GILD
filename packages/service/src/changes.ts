import { Context, Effect, Layer, PubSub, Ref } from "effect";

/** Announces each committed change with an increasing sequence. */
export class Changes extends Context.Service<
  Changes,
  { readonly publish: Effect.Effect<void>; readonly pubsub: PubSub.PubSub<number> }
>()("openmission/Changes") {}

export const changesLayer = Layer.effect(
  Changes,
  Effect.gen(function* () {
    const pubsub = yield* PubSub.unbounded<number>();
    const sequence = yield* Ref.make(0);
    const publish = Ref.updateAndGet(sequence, (n) => n + 1).pipe(
      Effect.flatMap((n) => PubSub.publish(pubsub, n)),
      Effect.asVoid,
    );
    return { publish, pubsub };
  }),
);
