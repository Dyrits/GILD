import { join } from "node:path";
import type { PlanLimitReading } from "@iskios/contracts";
import { Clock, Context, Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { Changes, Harness } from "../core/index.ts";
import { type AccountRef, accountKeyOf } from "./budgetScopes.ts";
import { AccountsRoot } from "./threads.ts";
import { afterFailure, afterRead, type GateState, isReadDue, noReadYet } from "./usageReadGate.ts";

// What each subscription's harness reports of its plan's limits (budget-control, Plan limits): the last reading kept in
// the database, and a read started in the background, never more often than the pacing gate allows.

/** A window's name from its length in minutes, for example "5-hour" or "Weekly". */
export const windowLabelOf = (minutes: number) =>
  minutes === 10080
    ? "Weekly"
    : minutes === 1440
      ? "Daily"
      : minutes % 60 === 0
        ? `${minutes / 60}-hour`
        : `${minutes}-minute`;

/** The plan limits of provider accounts. */
export class PlanLimits extends Context.Service<
  PlanLimits,
  {
    /**
     * The account's last reading, or null when its harness reports none. Starts a read in the background when one is due
     * and none runs; the change feed announces the new reading.
     */
    readonly latest: (account: AccountRef) => Effect.Effect<PlanLimitReading | null>;
  }
>()("iskios/PlanLimits") {}

const decodeWindows = Schema.decodeUnknownSync(
  Schema.Array(
    Schema.Struct({
      label: Schema.String,
      resetsAt: Schema.Number,
      usedPercent: Schema.Number,
    }),
  ),
);

/** The plan limits over the service's database, the harnesses, and the change feed. */
export const planLimitsLayer = Layer.effect(
  PlanLimits,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const harness = yield* Harness;
    const changes = yield* Changes;
    const accountsRoot = yield* AccountsRoot;
    const scope = yield* Effect.scope;
    const gates = new Map<string, GateState>();
    const running = new Set<string>();

    const stored = (key: string) =>
      Effect.gen(function* () {
        const [row] = yield* sql<{ readAt: number; windows: string }>`
          SELECT windows, read_at AS readAt FROM plan_limits WHERE account_key = ${key}`;
        return row === undefined
          ? null
          : ({ readAt: row.readAt, windows: decodeWindows(JSON.parse(row.windows)) } satisfies PlanLimitReading);
      }).pipe(Effect.orDie);

    /** Reads the account's limits now and keeps them; a harness that reports none leaves no reading. */
    const read = (account: AccountRef, key: string) =>
      Effect.gen(function* () {
        const configDirectory = account.accountId === null ? null : join(accountsRoot, account.accountId);
        const report = yield* harness.readPlanLimits(account.harness, configDirectory);
        const now = yield* Clock.currentTimeMillis;
        const gate = gates.get(key) ?? noReadYet;
        if (report === null || report.windows.length === 0) {
          // A harness that reports nothing has not failed: it is asked again after the reading's time.
          gates.set(key, afterRead(gate, now));
          return;
        }
        const windows = report.windows.map((window) => ({
          label: windowLabelOf(window.windowMinutes),
          resetsAt: window.resetsAtSeconds * 1000,
          usedPercent: window.usedPercent,
        }));
        yield* sql`INSERT INTO plan_limits (account_key, windows, read_at) VALUES (${key}, ${JSON.stringify(windows)}, ${now})
          ON CONFLICT (account_key) DO UPDATE SET windows = excluded.windows, read_at = excluded.read_at`.pipe(
          Effect.orDie,
        );
        gates.set(key, afterRead(gate, now));
        yield* changes.publish;
      }).pipe(
        Effect.onError(() =>
          Clock.currentTimeMillis.pipe(
            Effect.map((now) => gates.set(key, afterFailure(gates.get(key) ?? noReadYet, now))),
          ),
        ),
        Effect.ensuring(Effect.sync(() => running.delete(key))),
        Effect.ignore,
      );

    const latest = (account: AccountRef) =>
      Effect.gen(function* () {
        const key = accountKeyOf(account);
        const now = yield* Clock.currentTimeMillis;
        if (!running.has(key) && isReadDue(gates.get(key) ?? noReadYet, now)) {
          running.add(key);
          yield* Effect.forkIn(read(account, key), scope);
        }
        return yield* stored(key);
      });

    return PlanLimits.of({ latest });
  }),
);
