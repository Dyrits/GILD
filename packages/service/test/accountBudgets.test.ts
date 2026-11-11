import { describe, expect, it } from "@effect/vitest";
import {
  AccountBudget,
  type AccountId,
  type BackupCompanion,
  type BudgetLimits,
  type MissionDetail,
  type MissionId,
} from "@gild/contracts";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { afterEach } from "vitest";
import { call, fixture, read, send, settle, start } from "./fixtures/service.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});
const withService = <A, E, R>(body: Effect.Effect<A, E, R>) => {
  const value = fixture();
  fixtures.push(value);
  return body.pipe(Effect.provide(value.layer));
};

/** Adds an account named Work to Claude Code and gives its id. */
const addWork = Effect.gen(function* () {
  const added = yield* call({ _tag: "AddAccount", harness: "claude", label: "Work" });
  return added.harnesses.find((harness) => harness.name === "claude")?.accounts[1]?.id as AccountId;
});

const startOn = (accountId: AccountId, text: string) =>
  call({
    _tag: "StartMission",
    accountId,
    effort: "default",
    harness: "claude",
    model: "default",
    requestId: crypto.randomUUID(),
    text,
    workspacePath: null,
  });

const setBudget = (
  accountId: AccountId | null,
  limits: BudgetLimits,
  period: "Day" | "Week" | "Month" | null = "Month",
  since: number | null = null,
) => call({ _tag: "SetAccountBudget", accountId, harness: "claude", limits, period, since });

const tokens = (count: number): BudgetLimits => ({ cost: null, tokens: count });
const isIdle = (detail: MissionDetail) => detail.thread.state === "Idle";
const isHeld = (detail: MissionDetail) => detail.thread.state === "Attention" && detail.thread.blocker === "Budget";
const accountOf = (accountId: AccountId | null) =>
  Effect.gen(function* () {
    const budgets = yield* call({ _tag: "ReadAccountBudgets" });
    return budgets.find((budget) => budget.harness === "claude" && budget.accountId === accountId);
  });

const startRunning = (accountId: AccountId | null) =>
  Effect.gen(function* () {
    const started = accountId === null ? yield* start("wait 60000") : yield* startOn(accountId, "wait 60000");
    yield* settle(started.missionId, (detail) => detail.thread.state === "Running");
    return started;
  });

describe("an account's budget", () => {
  it.live("stops the threads on the account across quests, and no others", () =>
    withService(
      Effect.gen(function* () {
        const work = yield* addWork;
        const other = yield* startRunning(work);
        const elsewhere = yield* startRunning(null);
        yield* setBudget(work, tokens(1000));
        const reaching = yield* startOn(work, "spend 2000");
        const held = yield* settle(reaching.missionId, isHeld);
        expect(held.budgetStop).toMatchObject({
          accountLabel: "Claude Code · Work",
          missionId: null,
          scope: "Account",
        });
        expect(isHeld(yield* settle(other.missionId, isHeld))).toBe(true);
        expect((yield* read(elsewhere.missionId)).thread.state).toBe("Running");
      }),
    ),
  );

  it.live("is raised by the owner, and the stopped threads carry on", () =>
    withService(
      Effect.gen(function* () {
        const work = yield* addWork;
        const other = yield* startRunning(work);
        yield* setBudget(work, tokens(1000));
        const reaching = yield* startOn(work, "spend 2000");
        yield* settle(reaching.missionId, isHeld);
        yield* settle(other.missionId, isHeld);
        yield* setBudget(work, tokens(5000));
        yield* settle(reaching.missionId, isIdle);
        // Its interrupted message runs again, so the other thread is at work once more, no longer held.
        yield* settle(other.missionId, (detail) => detail.thread.state === "Running");
      }),
    ),
  );

  it.live("leaves its threads stopped when the owner answers Stop", () =>
    withService(
      Effect.gen(function* () {
        const work = yield* addWork;
        const other = yield* startRunning(work);
        yield* setBudget(work, tokens(1000));
        const reaching = yield* startOn(work, "spend 2000");
        const held = yield* settle(reaching.missionId, isHeld);
        yield* call({ _tag: "StopAtBudget", stopId: held.budgetStop?.id as never });
        yield* settle(reaching.missionId, (detail) => detail.thread.state === "Stopped");
        yield* settle(other.missionId, (detail) => detail.thread.state === "Stopped");
      }),
    ),
  );

  it.live("refuses a quest started on an account at its budget, with the reason", () =>
    withService(
      Effect.gen(function* () {
        const work = yield* addWork;
        yield* setBudget(work, tokens(1000));
        const reaching = yield* startOn(work, "spend 2000");
        yield* settle(reaching.missionId, isHeld);
        const refusal = yield* startOn(work, "Hello").pipe(Effect.flip);
        expect(refusal.message).toContain("account");
        expect(refusal.message).toContain("budget");
      }),
    ),
  );

  it.live("counts only what the account's own turns used since it began counting", () =>
    withService(
      Effect.gen(function* () {
        const work = yield* addWork;
        // Counting begins in two days, so what the turn uses now is not counted.
        yield* setBudget(work, tokens(1000), null, Date.now() + 2 * 86_400_000);
        const started = yield* startOn(work, "spend 2000");
        yield* settle(started.missionId, isIdle);
        expect((yield* accountOf(work))?.spent).toEqual({ cost: 0, tokens: 0 });
      }),
    ),
  );

  it.live("tells each thread how much of the account's budget is used", () =>
    withService(
      Effect.gen(function* () {
        const work = yield* addWork;
        yield* setBudget(work, tokens(10_000));
        const started = yield* startOn(work, "spend 2000");
        yield* settle(started.missionId, isIdle);
        yield* send(started.threadId, "context");
        const detail = yield* settle(
          started.missionId,
          (d) => d.messages.filter((m) => m.sender === "agent").length === 2,
        );
        expect(detail.messages.at(-1)?.text).toContain("account Work: 20% of this month's tokens");
      }),
    ),
  );

  it.live("records a line in each stopped quest", () =>
    withService(
      Effect.gen(function* () {
        const work = yield* addWork;
        const other = yield* startRunning(work);
        yield* setBudget(work, tokens(1000));
        const reaching = yield* startOn(work, "spend 2000");
        yield* settle(reaching.missionId, isHeld);
        yield* settle(other.missionId, isHeld);
        for (const missionId of [reaching.missionId, other.missionId])
          expect((yield* read(missionId)).budgetEvents.map((event) => event.text)).toEqual(
            expect.arrayContaining([expect.stringMatching(/^Account Claude Code · Work reached its budget/)]),
          );
      }),
    ),
  );
});

describe("credits on an account", () => {
  const day = () => Date.now() - 1000;

  it.live("count the account's API-key spending since the day entered, and show what is left", () =>
    withService(
      Effect.gen(function* () {
        const work = yield* addWork;
        yield* setBudget(work, { cost: 50, tokens: null }, null, day());
        const started = yield* startOn(work, "billing ApiKey\nspend 100 12.5");
        yield* settle(started.missionId, isIdle);
        expect(yield* accountOf(work)).toMatchObject({
          limits: { cost: 50 },
          period: null,
          remaining: { cost: 37.5 },
          spent: { cost: 12.5 },
        });
      }),
    ),
  );

  it.live("grow with Add credit, and stop the account at zero", () =>
    withService(
      Effect.gen(function* () {
        const work = yield* addWork;
        yield* setBudget(work, { cost: 5, tokens: null }, null, day());
        yield* call({ _tag: "AddCredit", accountId: work, amount: 10, harness: "claude" });
        expect((yield* accountOf(work))?.limits.cost).toBe(15);
        const started = yield* startOn(work, "billing ApiKey\nspend 100 15");
        yield* settle(started.missionId, isHeld);
        // The app decodes what the service answers: an account with nothing left must still decode.
        const exhausted = yield* accountOf(work);
        expect(exhausted?.remaining.cost).toBe(0);
        expect(() => Schema.decodeUnknownSync(AccountBudget)(exhausted)).not.toThrow();
      }),
    ),
  );

  it.live("go with the account when it is removed", () =>
    withService(
      Effect.gen(function* () {
        const work = yield* addWork;
        yield* setBudget(work, tokens(1000));
        yield* call({ _tag: "RemoveAccount", accountId: work });
        const sql = yield* SqlClient.SqlClient;
        expect(yield* sql`SELECT * FROM account_budgets`).toEqual([]);
      }),
    ),
  );
});

describe("switching to a backup Companion at an account's budget", () => {
  const codex: BackupCompanion = { accountId: null, effort: "default", harness: "codex", model: "gpt-5" };

  it.live("hands the held thread to its next backup, which carries on", () =>
    withService(
      Effect.gen(function* () {
        const work = yield* addWork;
        yield* setBudget(work, tokens(1000));
        const started = yield* startOn(work, "Hello");
        yield* settle(started.missionId, isIdle);
        yield* call({ _tag: "SetThreadBackups", backups: [codex], threadId: started.threadId });
        yield* send(started.threadId, "spend 2000");
        const held = yield* settle(started.missionId, isHeld);
        yield* call({ _tag: "SwitchAtBudget", stopId: held.budgetStop?.id as never });
        const after = yield* settle(started.missionId, (detail) => isIdle(detail) && detail.thread.harness === "codex");
        expect(after.handovers.map((handover) => handover.text)).toEqual([
          expect.stringMatching(/Account Claude Code · Work reached its budget/),
        ]);
      }),
    ),
  );

  it.live("refuses when the thread has no backup to switch to", () =>
    withService(
      Effect.gen(function* () {
        const work = yield* addWork;
        yield* setBudget(work, tokens(1000));
        const started = yield* startOn(work, "spend 2000");
        const held = yield* settle(started.missionId, isHeld);
        const refusal = yield* call({ _tag: "SwitchAtBudget", stopId: held.budgetStop?.id as never }).pipe(Effect.flip);
        expect(refusal.message).toContain("backup");
      }),
    ),
  );
});

export type { MissionId };
