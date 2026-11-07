import { Context, Effect, Layer, PubSub, Ref } from "effect";

export interface DraftUpdate {
  /** The reply written so far; empty when the draft ends. */
  readonly text: string;
  readonly threadId: string;
}

/** Announces committed changes with an increasing sequence, and unsaved reply drafts. */
export class Changes extends Context.Service<
  Changes,
  {
    readonly publish: Effect.Effect<void>;
    readonly pubsub: PubSub.PubSub<number>;
    readonly drafts: PubSub.PubSub<DraftUpdate>;
  }
>()("canopy/Changes") {}

export const changesLayer = Layer.effect(
  Changes,
  Effect.gen(function* () {
    const pubsub = yield* PubSub.unbounded<number>();
    const drafts = yield* PubSub.unbounded<DraftUpdate>();
    const sequence = yield* Ref.make(0);
    const publish = Ref.updateAndGet(sequence, (n) => n + 1).pipe(
      Effect.flatMap((n) => PubSub.publish(pubsub, n)),
      Effect.asVoid,
    );
    return { drafts, publish, pubsub };
  }),
);
