import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { afterEach } from "vitest";
import { computerNameOf } from "../../src/remote/config.ts";
import { call, fixture, settle, start } from "../fixtures/service.ts";
import { dayAt, dayText, isIdle, quests, seed, standard, usage } from "../fixtures/usage.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});
const withService = <A, E, R>(body: Effect.Effect<A, E, R>) => {
  const value = fixture();
  fixtures.push(value);
  return body.pipe(Effect.provide(value.layer));
};

describe("reading the usage page", () => {
  it.live("reads an empty period without inventing a cost or a token", () =>
    withService(
      Effect.gen(function* () {
        const report = yield* usage();
        expect(report.amounts).toMatchObject({
          estimated: 0,
          pricedTurns: 0,
          reported: 0,
          tokens: { cacheCreation: 0, cacheRead: 0, input: 0, output: 0 },
          turns: 0,
        });
        expect(report.startedAt).toBeNull();
        expect(report.updatedAt).toBeNull();
        expect(report.days).toHaveLength(30);
        expect(report.days.every((day) => day.byHarness.length === 0)).toBe(true);
        expect(report.breakdowns.map((breakdown) => breakdown.dimension)).toEqual([
          "Harness",
          "Model",
          "Realm",
          "Quest",
          "Account",
          "Day",
        ]);
        expect(report.breakdowns.every((breakdown) => breakdown.rows.length === 0)).toBe(true);
        expect(report.records).toEqual({ hiddenCount: 0, rows: [] });
      }),
    ),
  );

  it.live("adds up the period, keeping reported and estimated cost apart and leaving the other periods out", () =>
    withService(
      Effect.gen(function* () {
        yield* standard;
        const { amounts, gaps, quests: questCount, threads } = yield* usage();
        expect(amounts.turns).toBe(6);
        expect(amounts.reported).toBe(2);
        expect(amounts.estimated).toBe(1.5);
        expect(amounts.pricedTurns).toBe(4);
        expect(amounts.tokens).toEqual({
          cacheCreation: 20,
          cacheRead: 1000,
          input: 100 + 10 + 10 + 10 + 5 + 2,
          output: 30 + 10 + 5 + 5 + 5 + 1,
        });
        expect(questCount).toBe(3);
        expect(threads).toBe(3);
        expect(gaps).toMatchObject({ earlierTurns: 1, unpricedTurns: 1 });
      }),
    ),
  );

  it.live("divides the same usage by harness, with an unpriced harness unavailable rather than zero", () =>
    withService(
      Effect.gen(function* () {
        yield* standard;
        const { breakdowns } = yield* usage();
        const rows = breakdowns.find((breakdown) => breakdown.dimension === "Harness")?.rows ?? [];
        const byKey = Object.fromEntries(rows.map((row) => [row.key, row.amounts]));
        expect(byKey.claude).toMatchObject({ estimated: 1, pricedTurns: 2, reported: 2, turns: 2 });
        expect(byKey.codex).toMatchObject({ estimated: 0.5, pricedTurns: 2, turns: 2 });
        // Known cost, not a guess: OpenCode's one turn has tokens and no price.
        expect(byKey.opencode).toMatchObject({ estimated: 0, pricedTurns: 0, reported: 0, turns: 1 });
        expect(byKey.opencode?.tokens.input).toBe(5);
        // The turn recorded before harnesses were: its own row, with the empty key.
        expect(byKey[""]).toMatchObject({ earlierTurns: 1, pricedTurns: 0, turns: 1 });
        expect(rows.map((row) => row.key)).toEqual(["claude", "codex", "opencode", ""]);
      }),
    ),
  );

  it.live("divides it by model, naming the harness a model ran on only when it ran on one", () =>
    withService(
      Effect.gen(function* () {
        yield* standard;
        const { breakdowns } = yield* usage();
        const rows = breakdowns.find((breakdown) => breakdown.dimension === "Model")?.rows ?? [];
        expect(rows.map((row) => row.key)).toEqual([
          "claude-opus-5-5",
          "claude-sonnet-5-5",
          "gpt-5.1-codex",
          "free-model",
          "x/unknown",
          "",
        ]);
        expect(rows[0]).toMatchObject({ harness: "claude" });
        // A known price of zero stays a known zero.
        expect(rows.find((row) => row.key === "free-model")?.amounts).toMatchObject({ estimated: 0, pricedTurns: 1 });
      }),
    ),
  );

  it.live("divides it by realm and by quest, with the Borderlands, Iskios, and deleted quests told apart", () =>
    withService(
      Effect.gen(function* () {
        const { a, b, c } = yield* standard;
        const sql = yield* SqlClient.SqlClient;
        // A quest of Iskios's own, and a quest deleted since it spent.
        yield* sql`UPDATE missions SET is_guildmaster = 1 WHERE id = ${c.mission}`;
        yield* sql`INSERT INTO usage (turn_id, mission_id, thread_id, ended_at, input, output, cache_read, cache_creation, billing, harness, model, estimate)
          VALUES ('turn-gone', 'mission-gone', 'thread-gone', ${dayAt(1)}, 1, 1, 0, 0, 'Subscription', 'claude', 'claude-sonnet-5-5', 0.25)`;
        const { breakdowns } = yield* usage();
        const realms = breakdowns.find((breakdown) => breakdown.dimension === "Realm")?.rows ?? [];
        expect(Object.fromEntries(realms.map((row) => [row.key, row.name]))).toEqual({
          "~deleted": null,
          "~iskios": "Iskios (assistant)",
          "realm-atlas": "Atlas",
          "realm-borealis": "Borealis",
        });
        const questRows = breakdowns.find((breakdown) => breakdown.dimension === "Quest")?.rows ?? [];
        expect(questRows.find((row) => row.key === a.mission)?.name).toBe("Quest A");
        expect(questRows.find((row) => row.key === b.mission)?.name).toBe("Quest B");
        expect(questRows.find((row) => row.key === c.mission)?.name).toBe("Iskios (assistant)");
        expect(questRows.find((row) => row.key === "mission-gone")?.name).toBeNull();
      }),
    ),
  );

  it.live("puts a quest with no realm in the Borderlands, under the empty realm key", () =>
    withService(
      Effect.gen(function* () {
        yield* standard;
        const { breakdowns } = yield* usage();
        const realms = breakdowns.find((breakdown) => breakdown.dimension === "Realm")?.rows ?? [];
        expect(realms.find((row) => row.key === "")?.amounts.turns).toBe(2);
        expect(realms.find((row) => row.key === "realm-atlas")?.amounts.turns).toBe(3);
        expect(realms.find((row) => row.key === "realm-borealis")?.amounts.turns).toBe(1);
      }),
    ),
  );

  it.live("divides it by account, and by day", () =>
    withService(
      Effect.gen(function* () {
        yield* standard;
        const { breakdowns } = yield* usage();
        const accounts = breakdowns.find((breakdown) => breakdown.dimension === "Account")?.rows ?? [];
        expect(accounts.map((row) => row.key).sort()).toEqual([
          "",
          "claude/",
          "codex/",
          "codex/acct-work",
          "opencode/",
        ]);
        // A harness's own sign-in has no account row to name it, so it carries the computer's name; a turn with no harness has none.
        expect(accounts.find((row) => row.key === "claude/")?.name).toBe(computerNameOf());
        expect(accounts.find((row) => row.key === "")?.name).toBeNull();
        const days = breakdowns.find((breakdown) => breakdown.dimension === "Day")?.rows ?? [];
        expect(days.map((row) => row.key).sort()).toEqual([dayText(3), dayText(2), dayText(1)].sort());
      }),
    ),
  );

  it.live("shows every local day of the period, oldest first, with what each harness used", () =>
    withService(
      Effect.gen(function* () {
        yield* standard;
        const { days, period } = yield* usage({ _tag: "Days", days: 7 });
        expect(days.map((day) => day.day)).toEqual([6, 5, 4, 3, 2, 1, 0].map(dayText));
        expect(period.firstDay).toBe(dayText(6));
        expect(period.lastDay).toBe(dayText(0));
        const yesterday = days.find((day) => day.day === dayText(1));
        expect(yesterday?.byHarness.map((entry) => entry.harness)).toEqual(["claude"]);
        expect(yesterday?.byHarness[0]?.amounts).toMatchObject({ estimated: 1, reported: 2, turns: 2 });
        expect(days.find((day) => day.day === dayText(4))?.byHarness).toEqual([]);
      }),
    ),
  );

  it.live("puts a turn on the local day it ended, also just after midnight and just before it", () =>
    withService(
      Effect.gen(function* () {
        const { a } = yield* quests;
        const row = (endedAt: number) =>
          ({
            billing: "Subscription",
            endedAt,
            estimate: 1,
            harness: "claude",
            mission: a.mission,
            model: "m",
            thread: a.thread,
          }) as const;
        yield* seed([row(dayAt(2, 0, 30)), row(dayAt(2, 23, 30)), row(dayAt(1, 0, 30))]);
        const { breakdowns, days } = yield* usage({ _tag: "Days", days: 7 });
        const dayRows = breakdowns.find((breakdown) => breakdown.dimension === "Day")?.rows ?? [];
        expect(Object.fromEntries(dayRows.map((dayRow) => [dayRow.key, dayRow.amounts.turns]))).toEqual({
          [dayText(1)]: 1,
          [dayText(2)]: 2,
        });
        expect(days.find((day) => day.day === dayText(2))?.byHarness[0]?.amounts.turns).toBe(2);
      }),
    ),
  );

  it.live("lists the turns behind the numbers, newest first, with each turn's own cost and where it came from", () =>
    withService(
      Effect.gen(function* () {
        yield* standard;
        const report = yield* usage({ _tag: "Days", days: 7 });
        expect(report.records.hiddenCount).toBe(0);
        const [first, second, third] = report.records.rows;
        expect(first).toMatchObject({
          cost: 2,
          harness: "claude",
          isReported: true,
          model: "claude-opus-5-5",
          questName: "Quest B",
        });
        expect(second).toMatchObject({ cost: 1, isReported: false, model: "claude-sonnet-5-5", questName: "Quest A" });
        expect(third?.harness).toBe("codex");
        const unpriced = report.records.rows.find((record) => record.model === "x/unknown");
        expect(unpriced).toMatchObject({ cost: null, isReported: false });
        expect(second?.threadTitle).toEqual(expect.any(String));
        expect(second?.tokens).toEqual({ cacheCreation: 20, cacheRead: 1000, input: 100, output: 30 });
      }),
    ),
  );

  it.live("lists at most 100 turns and counts the older ones left out", () =>
    withService(
      Effect.gen(function* () {
        const { a } = yield* quests;
        yield* seed(
          Array.from({ length: 105 }, (_, index) => ({
            billing: "Subscription" as const,
            endedAt: dayAt(1) + index,
            estimate: 1,
            harness: "claude" as const,
            mission: a.mission,
            model: "m",
            thread: a.thread,
          })),
        );
        const report = yield* usage();
        expect(report.amounts.turns).toBe(105);
        expect(report.records.rows).toHaveLength(100);
        expect(report.records.hiddenCount).toBe(5);
        expect(report.records.rows[0]?.endedAt).toBe(dayAt(1) + 104);
      }),
    ),
  );

  it.live("reads the usage a real turn leaves, with its harness, model, and realm", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* start("usage 100 50 1000 20");
        yield* settle(quest.missionId, isIdle);
        const report = yield* usage({ _tag: "Days", days: 7 });
        expect(report.amounts.turns).toBe(1);
        expect(report.amounts.tokens).toEqual({ cacheCreation: 20, cacheRead: 1000, input: 100, output: 50 });
        const harness = report.breakdowns.find((breakdown) => breakdown.dimension === "Harness")?.rows ?? [];
        expect(harness.map((row) => row.key)).toEqual(["claude"]);
      }),
    ),
  );
  it.live("counts the days at the edge of each preset: today and the 29 before it, not the 30th", () =>
    withService(
      Effect.gen(function* () {
        const { a } = yield* quests;
        const row = (endedAt: number) =>
          ({
            billing: "Subscription",
            endedAt,
            estimate: 1,
            harness: "claude",
            mission: a.mission,
            model: "m",
            thread: a.thread,
          }) as const;
        yield* seed([row(dayAt(29)), row(dayAt(30)), row(dayAt(6)), row(dayAt(7))]);
        // Days 29, 6, and 7 are in the last 30 days; day 30 is not.
        expect((yield* usage({ _tag: "Days", days: 30 })).amounts.turns).toBe(3);
        expect((yield* usage({ _tag: "Days", days: 7 })).amounts.turns).toBe(1);
      }),
    ),
  );

  it.live(
    "keeps the page's tokens apart from the budget's: the page leaves cache reads out, the budget counts them",
    () =>
      withService(
        Effect.gen(function* () {
          // 100 uncached input, 30 output, 1,000 cache reads, 20 cache creation.
          const quest = yield* start("usage 100 30 1000 20");
          yield* settle(quest.missionId, isIdle);
          const { amounts } = yield* usage({ _tag: "Days", days: 7 });
          expect(amounts.tokens).toEqual({ cacheCreation: 20, cacheRead: 1000, input: 100, output: 30 });
          const budget = yield* call({ _tag: "ReadBudget", missionId: null });
          expect(budget.spent.tokens).toBe(1150);
        }),
      ),
  );
  it.live("keeps at most 100 rows of a breakdown, with the total of all of them for the shares", () =>
    withService(
      Effect.gen(function* () {
        const { a } = yield* quests;
        // 105 quests deleted since they spent: each a row of its own in the Quest breakdown.
        yield* seed(
          Array.from({ length: 105 }, (_, index) => ({
            billing: "Subscription" as const,
            endedAt: dayAt(1) + index,
            estimate: 1,
            harness: "claude" as const,
            mission: `mission-gone-${index}`,
            model: "m",
            thread: a.thread,
          })),
        );
        const { breakdowns } = yield* usage();
        const questRows = breakdowns.find((breakdown) => breakdown.dimension === "Quest");
        expect(questRows?.rows).toHaveLength(100);
        expect(questRows?.hiddenRows).toBe(5);
        expect(questRows?.total).toMatchObject({ estimated: 105, pricedTurns: 105, turns: 105 });
      }),
    ),
  );
});
