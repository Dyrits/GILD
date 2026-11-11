import { describe, expect, it } from "@effect/vitest";
import type { MissionId } from "@iskios/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { afterEach } from "vitest";
import { call, fixture, settle, start } from "../fixtures/service.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});
const withService = <A, E, R>(body: Effect.Effect<A, E, R>) => {
  const value = fixture();
  fixtures.push(value);
  return body.pipe(Effect.provide(value.layer));
};

const recap = (since: number | null = null) => call({ _tag: "ReadGuildHallRecap", since });
const isIdle = (detail: { thread: { state: string } }) => detail.thread.state === "Idle";

const finish = (missionId: MissionId) =>
  Effect.gen(function* () {
    const preview = yield* call({ _tag: "PreviewEnding", ending: "Done", missionId });
    yield* call({ _tag: "EndMission", ending: "Done", missionId, snapshot: preview.snapshot });
  });

const hour = 60 * 60 * 1000;

describe("the Guild Hall recap", () => {
  it.live("covers the last 24 hours at the first visit, and says it is the first", () =>
    withService(
      Effect.gen(function* () {
        const before = Date.now();
        const first = yield* recap();
        expect(first.isFirstVisit).toBe(true);
        expect(first.since).toBeGreaterThanOrEqual(before - 24 * hour - 1000);
        expect(first.since).toBeLessThanOrEqual(Date.now() - 24 * hour + 1000);
        expect(first).toMatchObject({ finished: [], finishedCount: 0, ritualRuns: 0 });
        expect(first.consumption.turns).toBe(0);
      }),
    ),
  );

  it.live("starts at the last visit afterwards, and a given start is kept", () =>
    withService(
      Effect.gen(function* () {
        const before = Date.now();
        yield* call({ _tag: "VisitGuildHall" });
        const next = yield* recap();
        expect(next.isFirstVisit).toBe(false);
        expect(next.since).toBeGreaterThanOrEqual(before);
        expect(next.since).toBeLessThanOrEqual(Date.now());
        const fixed = yield* recap(1234);
        expect(fixed).toMatchObject({ isFirstVisit: false, since: 1234 });
      }),
    ),
  );

  it.live("counts the quests finished and what their turns used since the start, and leaves earlier ones out", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* start("usage 100 50 0 0");
        yield* settle(quest.missionId, isIdle);
        yield* finish(quest.missionId);
        const since = yield* recap(Date.now() - hour);
        expect(since.finishedCount).toBe(1);
        expect(since.finished).toEqual([{ missionId: quest.missionId, title: expect.any(String) }]);
        expect(since.consumption).toMatchObject({ tokens: { input: 100, output: 50 }, turns: 1 });
        const later = yield* recap(Date.now() + hour);
        expect(later).toMatchObject({ finished: [], finishedCount: 0 });
        expect(later.consumption.turns).toBe(0);
      }),
    ),
  );

  it.live("lists at most the five latest finished quests but counts them all", () =>
    withService(
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        for (let index = 0; index < 7; index++) {
          const quest = yield* start(`Quest ${index}`);
          yield* settle(quest.missionId, isIdle);
          yield* finish(quest.missionId);
          yield* sql`UPDATE missions SET done_at = ${Date.now() - (7 - index) * 1000} WHERE id = ${quest.missionId}`;
        }
        const all = yield* recap(Date.now() - hour);
        expect(all.finishedCount).toBe(7);
        expect(all.finished).toHaveLength(5);
        expect(all.finished.map((quest) => quest.title)).toEqual([
          "Quest 6",
          "Quest 5",
          "Quest 4",
          "Quest 3",
          "Quest 2",
        ]);
      }),
    ),
  );

  it.live("counts the Rituals run since the start, by hand or on schedule", () =>
    withService(
      Effect.gen(function* () {
        const created = yield* call({
          _tag: "CreateRitual",
          fallbacks: [],
          instruction: "runner",
          primary: { accountId: null, effort: "default", harness: "claude", model: "claude-sonnet-5-5" },
          requestId: crypto.randomUUID(),
          schedule: { _tag: "Daily", time: "07:00" },
          title: "Morning digest",
          workspacePath: null,
        });
        expect((yield* recap(Date.now() - hour)).ritualRuns).toBe(0);
        yield* call({ _tag: "RunRitual", ritualId: created.ritualId });
        yield* settle(created.missionId, isIdle);
        expect((yield* recap(Date.now() - hour)).ritualRuns).toBe(1);
        expect((yield* recap(Date.now() + hour)).ritualRuns).toBe(0);
      }),
    ),
  );

  it.live("leaves out the Guild Hall's own quest from the finished ones", () =>
    withService(
      Effect.gen(function* () {
        yield* call({ _tag: "ReadGuildmaster" });
        const result = yield* recap(0);
        expect(result.finishedCount).toBe(0);
      }),
    ),
  );
});
