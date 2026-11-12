import type { ServerFrame, ThreadId } from "@iskios/contracts";
import { Context, Effect, Layer, PubSub } from "effect";
import { Changes } from "./changes.ts";

/** Where one connected screen's frames go: the owner's window, or a paired device. */
export type SessionSend = (frame: ServerFrame) => void;

/**
 * The screens connected to this service. Every committed change and every reply being written is announced to all
 * of them, whichever way they connected (the loopback socket or a paired device through the relay).
 */
export class Sessions extends Context.Service<
  Sessions,
  {
    /** Registers a screen; the returned function removes it. */
    readonly add: (send: SessionSend) => () => void;
  }
>()("iskios/Sessions") {}

/** The registry, and the two fibers that carry changes and drafts to it. */
export const sessionsLayer = Layer.effect(
  Sessions,
  Effect.gen(function* () {
    const changes = yield* Changes;
    const sinks = new Set<SessionSend>();
    const broadcast = (frame: ServerFrame) => {
      for (const send of sinks) send(frame);
    };

    const subscription = yield* PubSub.subscribe(changes.pubsub);
    yield* PubSub.take(subscription).pipe(
      Effect.tap((sequence) => Effect.sync(() => broadcast({ _tag: "Changed", sequence }))),
      Effect.forever,
      Effect.forkScoped,
    );
    const drafts = yield* PubSub.subscribe(changes.drafts);
    yield* PubSub.take(drafts).pipe(
      Effect.tap(({ threadId, text }) =>
        Effect.sync(() => broadcast({ _tag: "Draft", text, threadId: threadId as ThreadId })),
      ),
      Effect.forever,
      Effect.forkScoped,
    );

    return {
      add: (send: SessionSend) => {
        sinks.add(send);
        return () => void sinks.delete(send);
      },
    };
  }),
);
