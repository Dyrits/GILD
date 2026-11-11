import { Clock, Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";
import { nextStartOf, readGlobalBudget } from "../core/index.ts";
import { releaseBudgets } from "./budgets.ts";
import { Commands, changed, unchanged } from "./commands.ts";

const hourMillis = 60 * 60 * 1000;

/**
 * Releases threads held at the global limit, or an account's, once a new period starts and the spending counted since is
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
    const sql = yield* SqlClient.SqlClient;
    const untilNextCheck = Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const { nextStart } = yield* readGlobalBudget;
      // An account's period starting over releases its threads the same way (budget-control, Account budgets).
      const accounts = yield* sql<{ period: "Day" | "Week" | "Month" }>`
        SELECT period FROM account_budgets WHERE period IS NOT NULL`;
      const next = Math.min(nextStart, ...accounts.map((account) => nextStartOf(now, account.period)));
      yield* Effect.sleep(Math.max(1, Math.min(next - now, hourMillis)));
    });
    yield* Effect.forkScoped(untilNextCheck.pipe(Effect.andThen(release), Effect.forever, Effect.orDie));
  }),
);
