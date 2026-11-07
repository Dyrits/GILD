import type { EffortChoice, HarnessName, ModelChoice } from "@openmission/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid } from "./errors.ts";
import { harnessLabels } from "./harnessCatalog.ts";

// What a thread runs on: its harness, the provider account it signs in with, its model, and its effort
// (provider-accounts).

/** A thread's harness, account (null for the computer's own sign-in), model, and effort. */
export interface Runner {
  readonly accountId: string | null;
  readonly effort: EffortChoice;
  readonly harness: HarnessName;
  readonly model: ModelChoice;
}

/** What an opener chose; an omitted part (undefined, from a request) or a null one is worked out from a base. */
export interface RunnerChoice {
  readonly accountId?: string | null | undefined;
  readonly effort?: EffortChoice | null | undefined;
  readonly harness?: HarnessName | null | undefined;
  readonly model?: ModelChoice | null | undefined;
}

/**
 * The runner a new thread gets from its base, the parent's or the Settings defaults. On the base's harness it
 * keeps the base's account and model unless chosen; on another harness it takes that harness's own sign-in and
 * default model, since neither carries over. An account chosen as null is the computer's own sign-in.
 */
export const runnerOf = (base: Runner, choice: RunnerChoice): Runner => {
  const harness = choice.harness ?? base.harness;
  const isSameHarness = harness === base.harness;
  return {
    accountId: choice.accountId !== undefined ? choice.accountId : isSameHarness ? base.accountId : null,
    effort: choice.effort ?? base.effort,
    harness,
    model: choice.model ?? (isSameHarness ? base.model : "default"),
  };
};

/** Refuses an account that does not exist or belongs to another harness. */
export const checkAccount = (runner: Runner) =>
  Effect.gen(function* () {
    if (runner.accountId === null) return runner;
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<{ id: string }>`
      SELECT id FROM accounts WHERE id = ${runner.accountId} AND harness = ${runner.harness}`;
    if (rows.length === 0) return yield* invalid(`No such ${harnessLabels[runner.harness]} account.`);
    return runner;
  });
