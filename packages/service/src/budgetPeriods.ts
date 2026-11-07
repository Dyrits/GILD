import { Clock, Effect, Layer } from "effect";
import { releaseBudgets } from "./budgets.ts";
import { Commands, changed, unchanged } from "./commands.ts";
import { readGlobalBudget } from "./spending.ts";

const hourMillis = 60 * 60 * 1000;

/**
 * Releases threads held at the global limit once a new period starts and the spending counted since is
 * under it (budget-control, Global budget). It wakes at each period start, and at least hourly, since
 * the owner can change the period at any time.
 */
export const budgetPeriodsLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const commands = yield* Commands;
    const release = commands.run(
      Effect.map(releaseBudgets, (released) =>
        released.length === 0 ? unchanged(null) : changed(null, { threadsToWake: released }),
      ),
    );
    const untilNextCheck = Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const { nextStart } = yield* readGlobalBudget;
      yield* Effect.sleep(Math.max(1, Math.min(nextStart - now, hourMillis)));
    });
    yield* Effect.forkScoped(untilNextCheck.pipe(Effect.andThen(release), Effect.forever, Effect.orDie));
  }),
);
