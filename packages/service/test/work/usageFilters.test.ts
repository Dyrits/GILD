import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { afterEach } from "vitest";
import { fixture, settle, start } from "../fixtures/service.ts";
import { dayAt, dayText, isIdle, last30, quests, seed, standard, usage } from "../fixtures/usage.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});
const withService = <A, E, R>(body: Effect.Effect<A, E, R>) => {
  const value = fixture();
  fixtures.push(value);
  return body.pipe(Effect.provide(value.layer));
};

describe("narrowing the usage page", () => {
  it.live("narrows everything to the selected rows, all of them applying together", () =>
    withService(
      Effect.gen(function* () {
        const { a } = yield* standard;
        const claude = yield* usage(last30, [{ dimension: "Harness", key: "claude" }]);
        expect(claude.amounts.turns).toBe(2);
        const models = claude.breakdowns.find((breakdown) => breakdown.dimension === "Model")?.rows ?? [];
        expect(models.map((row) => row.key).sort()).toEqual(["claude-opus-5-5", "claude-sonnet-5-5"]);
        expect(claude.days.flatMap((day) => day.byHarness.map((entry) => entry.harness))).toEqual(["claude"]);
        expect(claude.records.rows).toHaveLength(2);

        const narrowed = yield* usage(last30, [
          { dimension: "Harness", key: "claude" },
          { dimension: "Realm", key: "realm-atlas" },
        ]);
        expect(narrowed.amounts.turns).toBe(1);
        expect(narrowed.records.rows.map((record) => record.model)).toEqual(["claude-sonnet-5-5"]);

        const quest = yield* usage(last30, [{ dimension: "Quest", key: a.mission }]);
        expect(quest.amounts.turns).toBe(3);
        const day = yield* usage(last30, [{ dimension: "Day", key: dayText(2) }]);
        expect(day.amounts.turns).toBe(3);
        const borderlands = yield* usage(last30, [{ dimension: "Realm", key: "" }]);
        expect(borderlands.amounts.turns).toBe(2);
        const unrecorded = yield* usage(last30, [{ dimension: "Model", key: "" }]);
        expect(unrecorded.amounts.turns).toBe(1);
        const account = yield* usage(last30, [{ dimension: "Account", key: "codex/acct-work" }]);
        expect(account.amounts.turns).toBe(1);
      }),
    ),
  );

  it.live("follows local calendar days, with both days of a custom range included", () =>
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
        yield* seed([
          row(dayAt(5, 0, 0, 0, 0)),
          row(dayAt(5, 23, 59, 59, 999)),
          row(dayAt(4, 0, 0, 0, 0)),
          row(dayAt(3, 23, 59, 59, 999)),
          row(dayAt(2, 0, 0, 0, 0)),
          row(dayAt(0, 0, 0, 0, 0)),
        ]);
        const range = yield* usage({ _tag: "Range", from: dayText(5), to: dayText(3) });
        // The first day from midnight, the last day to its last millisecond; the next midnight is out.
        expect(range.amounts.turns).toBe(4);
        expect(range.days.map((day) => day.day)).toEqual([dayText(5), dayText(4), dayText(3)]);
        // Today counts in the 7-day preset, from midnight.
        const week = yield* usage({ _tag: "Days", days: 7 });
        expect(week.amounts.turns).toBe(6);
        const single = yield* usage({ _tag: "Range", from: dayText(0), to: dayText(0) });
        expect(single.amounts.turns).toBe(1);
      }),
    ),
  );

  it.live("refuses a range that ends before it starts, is not a date, or is longer than a year", () =>
    withService(
      Effect.gen(function* () {
        const backwards = yield* usage({ _tag: "Range", from: dayText(1), to: dayText(3) }).pipe(Effect.flip);
        expect(backwards).toMatchObject({ kind: "InvalidInput" });
        const nonsense = yield* usage({ _tag: "Range", from: "2026-13-45", to: "2026-14-01" }).pipe(Effect.flip);
        expect(nonsense).toMatchObject({ kind: "InvalidInput" });
        const long = yield* usage({ _tag: "Range", from: dayText(500), to: dayText(0) }).pipe(Effect.flip);
        expect(long).toMatchObject({ kind: "InvalidInput" });
      }),
    ),
  );

  it.live("says when collection started and was last updated, whatever the period and filters", () =>
    withService(
      Effect.gen(function* () {
        yield* standard;
        const report = yield* usage({ _tag: "Days", days: 7 }, [{ dimension: "Harness", key: "codex" }]);
        expect(report.startedAt).toBe(dayAt(40));
        expect(report.updatedAt).toBe(dayAt(1, 18));
      }),
    ),
  );

  it.live("counts the turns that left no usage, the records without a price, and the empty token records", () =>
    withService(
      Effect.gen(function* () {
        const { a } = yield* standard;
        const sql = yield* SqlClient.SqlClient;
        // The quests' own turns lost their usage when the case replaced it: three finished turns without a record.
        const before = yield* usage();
        expect(before.gaps.turnsWithoutUsage).toBe(3);
        yield* sql`INSERT INTO turns (id, thread_id, status, started_at, ended_at)
          VALUES ('turn-no-usage', ${a.thread}, 'completed', ${dayAt(1)}, ${dayAt(1)}),
                 ('turn-failed', ${a.thread}, 'failed', ${dayAt(1)}, ${dayAt(1)}),
                 ('turn-old', ${a.thread}, 'completed', ${dayAt(40)}, ${dayAt(40)})`;
        yield* sql`INSERT INTO usage (turn_id, mission_id, thread_id, ended_at, input, output, cache_read, cache_creation, billing, harness, model)
          VALUES ('turn-empty', ${a.mission}, ${a.thread}, ${dayAt(1)}, 0, 0, 0, 0, 'Subscription', 'claude', 'claude-sonnet-5-5')`;
        const report = yield* usage();
        expect(report.gaps).toEqual({ earlierTurns: 1, emptyTokenTurns: 1, turnsWithoutUsage: 4, unpricedTurns: 2 });
        // Which harness a turn without usage ran on is unknown, so the count stays out under such a filter.
        const filtered = yield* usage(last30, [{ dimension: "Harness", key: "claude" }]);
        expect(filtered.gaps.turnsWithoutUsage).toBeNull();
        const inRealm = yield* usage(last30, [{ dimension: "Realm", key: "realm-atlas" }]);
        // Quest A's own turn without a record, and the one added.
        expect(inRealm.gaps.turnsWithoutUsage).toBe(2);
      }),
    ),
  );

  it.live("counts the messages sent and the replies completed, and leaves them out under a harness filter", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* start("usage 100 50 0 0");
        yield* settle(quest.missionId, isIdle);
        const report = yield* usage({ _tag: "Days", days: 7 });
        expect(report.messages?.user).toBe(1);
        expect(report.messages?.assistant).toBeGreaterThanOrEqual(1);
        const filtered = yield* usage({ _tag: "Days", days: 7 }, [{ dimension: "Harness", key: "claude" }]);
        expect(filtered.messages).toBeNull();
        const elsewhere = yield* usage({ _tag: "Days", days: 7 }, [{ dimension: "Quest", key: "mission-other" }]);
        expect(elsewhere.messages).toEqual({ assistant: 0, user: 0 });
      }),
    ),
  );
  it.live("keeps the rows beside a chosen one in view, leaving out only the filter on their own dimension", () =>
    withService(
      Effect.gen(function* () {
        yield* standard;
        const report = yield* usage(last30, [
          { dimension: "Harness", key: "claude" },
          { dimension: "Day", key: dayText(2) },
        ]);
        // The totals follow both filters: Claude has no turn on that day.
        expect(report.amounts.turns).toBe(0);
        const rowsOf = (dimension: string) =>
          report.breakdowns.find((breakdown) => breakdown.dimension === dimension)?.rows ?? [];
        // The harnesses stay listed under a Harness filter (narrowed by the day), and the days under a Day filter (narrowed by the harness).
        expect(
          rowsOf("Harness")
            .map((row) => row.key)
            .sort(),
        ).toEqual(["codex", "opencode"]);
        expect(rowsOf("Day").map((row) => row.key)).toEqual([dayText(1)]);
        // The graph keeps every day under a Day filter, narrowed by the harness only.
        expect(report.days.filter((day) => day.byHarness.length > 0).map((day) => day.day)).toEqual([dayText(1)]);
        // Other dimensions follow every filter.
        expect(rowsOf("Model")).toEqual([]);
      }),
    ),
  );

  it.live("does not count a Ritual's scheduled run as a message the owner sent, and counts one run by hand", () =>
    withService(
      Effect.gen(function* () {
        const { a } = yield* quests;
        const sql = yield* SqlClient.SqlClient;
        const before = (yield* usage({ _tag: "Days", days: 7 }, [{ dimension: "Quest", key: a.mission }])).messages;
        const now = Date.now();
        yield* sql`INSERT INTO messages (id, mission_id, thread_id, sender_kind, text, sequence, sent_at) VALUES
          ('ritual-scheduled', ${a.mission}, ${a.thread}, 'user', 'Ritual · scheduled 07:00', 9001, ${now}),
          ('ritual-by-hand', ${a.mission}, ${a.thread}, 'user', 'Ritual · run by you', 9002, ${now})`;
        const after = (yield* usage({ _tag: "Days", days: 7 }, [{ dimension: "Quest", key: a.mission }])).messages;
        expect(after?.user).toBe((before?.user ?? 0) + 1);
      }),
    ),
  );
});
