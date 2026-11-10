import { describe, expect, it } from "@effect/vitest";
import type { CreateRitualResult, MissionId, RitualCompanion, RitualSchedule } from "@gild/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { TestClock } from "effect/testing";
import { afterEach } from "vitest";
import { call, fixture, read, settle } from "./fixtures/service.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});
const withService = <A, E, R>(body: Effect.Effect<A, E, R>) => {
  const value = fixture();
  fixtures.push(value);
  return body.pipe(Effect.provide(value.layer));
};

const claude: RitualCompanion = { accountId: null, effort: "default", harness: "claude", model: "claude-sonnet-5-5" };
const codex: RitualCompanion = { accountId: null, effort: "default", harness: "codex", model: "gpt-5" };
const daily: RitualSchedule = { _tag: "Daily", time: "07:00" };

/** Creates a Ritual; the instruction is the fake harness's script. */
const create = (
  instruction: string,
  more: { fallbacks?: ReadonlyArray<RitualCompanion>; schedule?: RitualSchedule; title?: string } = {},
) =>
  call({
    _tag: "CreateRitual",
    fallbacks: more.fallbacks ?? [],
    instruction,
    primary: claude,
    requestId: crypto.randomUUID(),
    schedule: more.schedule ?? daily,
    title: more.title ?? "Morning digest",
    workspacePath: null,
  });
const readRitual = (missionId: MissionId) => call({ _tag: "ReadRitual", missionId });
const run = (created: CreateRitualResult) => call({ _tag: "RunRitual", ritualId: created.ritualId });
const isIdle = (detail: { thread: { state: string } }) => detail.thread.state === "Idle";
const replies = (detail: { messages: ReadonlyArray<{ sender: string; text: string }> }) =>
  detail.messages.filter((message) => message.sender === "agent").map((message) => message.text);

const advance = (millis: number) =>
  Effect.gen(function* () {
    yield* TestClock.adjust(millis);
    for (let i = 0; i < 40; i++) yield* Effect.yieldNow;
  });

describe("creating a Ritual", () => {
  it.live("makes a quest of its own that waits for a run, and shows the Ritual on the board", () =>
    withService(
      Effect.gen(function* () {
        const created = yield* create("runner");
        const detail = yield* read(created.missionId);
        expect(detail.messages).toEqual([]);
        expect(detail.thread.title).toBe("Morning digest");
        const ritual = yield* readRitual(created.missionId);
        expect(ritual).toMatchObject({
          instruction: "runner",
          isOn: true,
          lastRunAt: null,
          primary: claude,
          schedule: daily,
        });
        expect(ritual?.nextRunAt).toBeGreaterThan(Date.now());
        const { missions } = yield* call({
          _tag: "ListMissions",
          isArchived: false,
          search: null,
          state: null,
          workspaceId: null,
        });
        expect(missions.find((mission) => mission.id === created.missionId)?.ritual).toMatchObject({
          isOn: true,
          lastRunState: null,
          schedule: daily,
        });
      }),
    ),
  );

  it.live("starts the quest's thread on the Ritual's primary Companion", () =>
    withService(
      Effect.gen(function* () {
        const created = yield* create("runner");
        const detail = yield* read(created.missionId);
        expect(detail.thread).toMatchObject({ harness: "claude", model: "claude-sonnet-5-5" });
      }),
    ),
  );
});

describe("running a Ritual by hand", () => {
  it.live("sends the instruction to the main thread under its trigger, whatever the switch", () =>
    withService(
      Effect.gen(function* () {
        const created = yield* create("runner");
        const ritual = yield* readRitual(created.missionId);
        yield* call({
          _tag: "UpdateRitual",
          fallbacks: [],
          instruction: "runner",
          isOn: false,
          primary: claude,
          ritualId: created.ritualId,
          schedule: daily,
          title: "Morning digest",
        });
        yield* run(created);
        const detail = yield* settle(created.missionId, (d) => replies(d).length === 1 && isIdle(d));
        expect(detail.messages[0]?.text).toContain("Ritual · run by you");
        expect(replies(detail)[0]).toBe("Echo: claude/claude-sonnet-5-5/default/session none");
        const after = yield* readRitual(created.missionId);
        expect(after).toMatchObject({ isOn: false, lastRunState: "Done", nextRunAt: null });
        expect(after?.lastRunAt).not.toBeNull();
        expect(ritual?.id).toBe(created.ritualId);
      }),
    ),
  );

  it.live("is refused while the previous run is still in a turn", () =>
    withService(
      Effect.gen(function* () {
        const created = yield* create("wait 400");
        yield* run(created);
        const refusal = yield* run(created).pipe(Effect.flip);
        expect(refusal.kind).toBe("InvalidInput");
        expect(refusal.message).toContain("still running");
        expect((yield* readRitual(created.missionId))?.lastRunState).toBe("Underway");
      }),
    ),
  );
});

describe("falling back to another Companion", () => {
  it.live("hands the failed run to the next Companion, says so in the quest, and finishes there", () =>
    withService(
      Effect.gen(function* () {
        const created = yield* create("fail claude Usage limit reached\nrunner", { fallbacks: [codex] });
        yield* run(created);
        const detail = yield* settle(created.missionId, (d) => replies(d).length === 1 && isIdle(d));
        expect(replies(detail)[0]).toBe("Echo: codex/gpt-5/default/session none");
        expect(detail.handovers.map((handover) => handover.text)).toEqual([
          expect.stringMatching(/^Fell back to Codex · gpt-5 · default effort · Usage limit reached/),
        ]);
        expect((yield* readRitual(created.missionId))?.lastRunState).toBe("Done");
      }),
    ),
  );

  it.live("fails the run once every Companion has failed", () =>
    withService(
      Effect.gen(function* () {
        const created = yield* create("fail claude no\nfail codex no", { fallbacks: [codex] });
        yield* run(created);
        yield* settle(created.missionId, (d) => d.thread.state === "Failed");
        expect((yield* readRitual(created.missionId))?.lastRunState).toBe("Failed");
      }),
    ),
  );

  it.live("starts the next run on the primary Companion again", () =>
    withService(
      Effect.gen(function* () {
        const created = yield* create("fail claude no\nrunner", { fallbacks: [codex] });
        yield* run(created);
        yield* settle(created.missionId, (d) => replies(d).length === 1 && isIdle(d));
        yield* call({
          _tag: "UpdateRitual",
          fallbacks: [codex],
          instruction: "runner",
          isOn: true,
          primary: claude,
          ritualId: created.ritualId,
          schedule: daily,
          title: "Morning digest",
        });
        yield* run(created);
        const detail = yield* settle(created.missionId, (d) => replies(d).length === 2 && isIdle(d));
        expect(replies(detail)[1]).toMatch(/^Echo: claude\/claude-sonnet-5-5\/default\/session none/);
      }),
    ),
  );
});

describe("the schedule", () => {
  it.effect("runs a due Ritual in its quest, and only a Ritual that is on", () =>
    withService(
      Effect.gen(function* () {
        const hourly: RitualSchedule = { _tag: "Hourly", hours: 1 };
        const on = yield* create("runner", { schedule: hourly, title: "On" });
        const off = yield* create("runner", { schedule: hourly, title: "Off" });
        yield* call({
          _tag: "UpdateRitual",
          fallbacks: [],
          instruction: "runner",
          isOn: false,
          primary: claude,
          ritualId: off.ritualId,
          schedule: hourly,
          title: "Off",
        });
        yield* advance(30 * 60 * 1000);
        expect(replies(yield* read(on.missionId))).toEqual([]);
        yield* advance(40 * 60 * 1000);
        for (let i = 0; i < 5; i++) yield* advance(20);
        const detail = yield* read(on.missionId);
        expect(detail.messages[0]?.text).toContain("Ritual · scheduled");
        expect(replies(detail)).toHaveLength(1);
        expect((yield* read(off.missionId)).messages).toEqual([]);
        expect((yield* readRitual(on.missionId))?.lastRunAt).not.toBeNull();
      }),
    ),
  );

  it.effect("skips a run missed while the app was closed and moves to the next one", () =>
    withService(
      Effect.gen(function* () {
        const created = yield* create("runner", { schedule: { _tag: "Hourly", hours: 1 } });
        const sql = yield* SqlClient.SqlClient;
        // The service was down for a day: the run due then is long past.
        yield* sql`UPDATE rituals SET next_run_at = -86400000`;
        // Any change wakes the scheduler, which then finds the run long past.
        yield* call({
          _tag: "UpdateRitual",
          fallbacks: [],
          instruction: "runner",
          isOn: true,
          primary: claude,
          ritualId: created.ritualId,
          schedule: { _tag: "Hourly", hours: 1 },
          title: "Morning digest",
        });
        yield* advance(1000);
        const ritual = yield* readRitual(created.missionId);
        expect(ritual?.lastRunAt).toBeNull();
        expect(ritual?.nextRunAt).toBeGreaterThan(0);
        expect((yield* read(created.missionId)).messages).toEqual([]);
      }),
    ),
  );
});

describe("editing and deleting a Ritual", () => {
  it.live("recomputes the next run from a new schedule, and none while it is off", () =>
    withService(
      Effect.gen(function* () {
        const created = yield* create("runner");
        const update = (isOn: boolean) =>
          call({
            _tag: "UpdateRitual",
            fallbacks: [codex],
            instruction: "new instruction",
            isOn,
            primary: claude,
            ritualId: created.ritualId,
            schedule: { _tag: "Hourly", hours: 2 },
            title: "Renamed",
          });
        yield* update(true);
        const edited = yield* readRitual(created.missionId);
        expect(edited).toMatchObject({ fallbacks: [codex], instruction: "new instruction", title: "Renamed" });
        expect(edited?.nextRunAt).toBeGreaterThan(Date.now() + 90 * 60 * 1000);
        expect((yield* read(created.missionId)).thread.title).toBe("Renamed");
        yield* update(false);
        expect((yield* readRitual(created.missionId))?.nextRunAt).toBeNull();
      }),
    ),
  );

  it.live("keeps the quest as an ordinary one when the Ritual is deleted", () =>
    withService(
      Effect.gen(function* () {
        const created = yield* create("runner");
        yield* call({ _tag: "DeleteRitual", ritualId: created.ritualId });
        expect(yield* readRitual(created.missionId)).toBeNull();
        expect((yield* read(created.missionId)).thread.title).toBe("Morning digest");
      }),
    ),
  );
});
