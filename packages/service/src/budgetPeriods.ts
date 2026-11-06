import { Clock, Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";
import { releaseBudgets } from "./budgets.ts";
import { Changes } from "./changes.ts";
import { readGlobalBudget } from "./spending.ts";
import { Threads } from "./threads.ts";

const hourMillis = 60 * 60 * 1000;

/**
 * Releases threads held at the global limit once a new period starts and the spending counted since is
 * under it (budget-control, Global budget). It wakes at each period start, and at least hourly, since
 * the owner can change the period at any time.
 */
export const budgetPeriodsLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const changes = yield* Changes;
    const threads = yield* Threads;
    const release = Effect.gen(function* () {
      const released = yield* sql.withTransaction(releaseBudgets);
      if (released.length === 0) return;
      yield* changes.publish;
      for (const id of released) yield* threads.wake(id);
    });
    const untilNextCheck = Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const { nextStart } = yield* readGlobalBudget;
      yield* Effect.sleep(Math.max(1, Math.min(nextStart - now, hourMillis)));
    });
    yield* Effect.forkScoped(untilNextCheck.pipe(Effect.andThen(release), Effect.forever, Effect.orDie));
  }),
);
