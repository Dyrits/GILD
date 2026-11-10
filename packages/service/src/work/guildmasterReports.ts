import { Effect, Layer, PubSub } from "effect";
import { Changes } from "../core/index.ts";
import { Commands } from "./commands.ts";
import { reportToGuildmaster } from "./guildmaster.ts";

/**
 * Hearing back (quest coordination): after every committed change, tells the Guildmaster of each quest it opened that
 * now reports a result, needs the owner, or failed. A sweep with nothing to tell announces nothing, so it cannot loop.
 */
export const guildmasterReportsLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const commands = yield* Commands;
    const changes = yield* Changes;
    const subscription = yield* PubSub.subscribe(changes.pubsub);
    const watch = PubSub.take(subscription).pipe(
      Effect.andThen(commands.run(reportToGuildmaster).pipe(Effect.ignore)),
      Effect.forever,
    );
    yield* Effect.forkScoped(watch);
  }),
);
