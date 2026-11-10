import { mkdirSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import type { MissionId, MissionList } from "@gild/contracts";
import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { afterEach } from "vitest";
import { call, fixture, open, start, tool } from "../fixtures/service.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
const make = () => {
  const value = fixture();
  fixtures.push(value);
  return value;
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

const advance = (millis: number) =>
  Effect.gen(function* () {
    yield* TestClock.adjust(millis);
    for (let i = 0; i < 40; i++) yield* Effect.yieldNow;
  });
const settleTurns = Effect.gen(function* () {
  for (let i = 0; i < 5; i++) yield* advance(20);
});
const list = (filters: Partial<Omit<Extract<Parameters<typeof call>[0], { _tag: "ListMissions" }>, "_tag">> = {}) =>
  call({ _tag: "ListMissions", isArchived: false, search: null, state: null, workspaceId: null, ...filters });
const titlesOf = (missions: MissionList) => missions.missions.map((m) => m.title);
const titleOf = (missions: MissionList, id: MissionId) => missions.missions.find((m) => m.id === id)?.title;

describe("naming a mission", () => {
  it.effect("takes the top thread's proposed title", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* start("Hello");
      yield* settleTurns;
      const answer = yield* tool(threadId, "set_mission_title", { title: "Plan the trip" });
      expect(answer).toContain("Named");
      expect(titleOf(yield* list(), missionId)).toBe("Plan the trip");
      const detail = yield* call({ _tag: "ReadMission", missionId, threadId: null });
      expect(detail.thread.title).toBe("Plan the trip");
    }).pipe(Effect.provide(make().layer)),
  );

  it.effect("refuses a title from a thread other than the top thread", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* start("Hello");
      yield* settleTurns;
      const child = yield* open(threadId, "Hi");
      yield* settleTurns;
      const answer = yield* tool(child.threadId, "set_mission_title", { title: "Other" });
      expect(answer).toContain("Not named");
      expect(titleOf(yield* list(), missionId)).toBe("Hello");
    }).pipe(Effect.provide(make().layer)),
  );

  it.effect("keeps the owner's rename and refuses set_mission_title afterwards", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* start("Hello");
      yield* settleTurns;
      yield* call({ _tag: "RenameMission", missionId, title: "  My trip  " });
      const answer = yield* tool(threadId, "set_mission_title", { title: "Plan the trip" });
      expect(answer).toContain("Not named: the owner named this mission");
      const missions = yield* list();
      expect(titleOf(missions, missionId)).toBe("My trip");
      expect(missions.missions[0]?.isTitleByUser).toBe(true);
    }).pipe(Effect.provide(make().layer)),
  );

  it.effect("refuses a blank rename", () =>
    Effect.gen(function* () {
      const { missionId } = yield* start("Hello");
      const failure = yield* Effect.flip(call({ _tag: "RenameMission", missionId, title: "  " }));
      expect(failure.kind).toBe("InvalidInput");
    }).pipe(Effect.provide(make().layer)),
  );

  it.effect("asks the top thread, and only it, to name the mission on its first turn", () =>
    Effect.gen(function* () {
      const asking = "On your first turn, call set_mission_title";
      const first = yield* start("context");
      yield* settleTurns;
      const top = yield* call({ _tag: "ReadMission", missionId: first.missionId, threadId: null });
      expect(top.messages.find((m) => m.sender === "agent")?.text).toContain(asking);
      // A child of a top thread that never echoed its context, so the opener's messages cannot carry the line.
      const { missionId, threadId } = yield* start("Hello");
      yield* settleTurns;
      const child = yield* open(threadId, "context");
      yield* settleTurns;
      const beneath = yield* call({ _tag: "ReadMission", missionId, threadId: child.threadId });
      expect(beneath.messages.find((m) => m.sender === "agent")?.text).not.toContain(asking);
    }).pipe(Effect.provide(make().layer)),
  );
});

describe("prefilling a new mission's choices", () => {
  it.effect("offers the Settings defaults before any mission", () =>
    Effect.gen(function* () {
      expect(yield* call({ _tag: "ReadStartChoices" })).toEqual({
        accountId: null,
        effort: "default",
        harness: "claude",
        model: "claude-sonnet-5-5",
        workspacePath: null,
      });
    }).pipe(Effect.provide(make().layer)),
  );

  it.effect("offers the last mission's model, effort, and workspace", () => {
    const value = make();
    const folder = join(value.directory, "project");
    mkdirSync(folder);
    return Effect.gen(function* () {
      yield* call({
        _tag: "StartMission",
        effort: "high",
        model: "haiku",
        requestId: "r1",
        text: "Hello",
        workspacePath: folder,
      });
      expect(yield* call({ _tag: "ReadStartChoices" })).toEqual({
        accountId: null,
        effort: "high",
        harness: "claude",
        model: "haiku",
        workspacePath: folder,
      });
    }).pipe(Effect.provide(value.layer));
  });
});

describe("listing missions on the dashboard", () => {
  it.effect("lists missions needing the owner first, then by latest activity", () =>
    Effect.gen(function* () {
      yield* start("First");
      yield* settleTurns;
      yield* start('ask {"action":"Push the code","command":"git push"}');
      yield* settleTurns;
      yield* advance(1000);
      yield* start("Third");
      yield* settleTurns;
      const missions = yield* list();
      expect(missions.missions.map((m) => m.state)).toEqual(["Attention", "Idle", "Idle"]);
      expect(titlesOf(missions).slice(1)).toEqual(["Third", "First"]);
    }).pipe(Effect.provide(make().layer)),
  );

  it.effect("filters by state", () =>
    Effect.gen(function* () {
      yield* start("Quiet");
      yield* settleTurns;
      yield* start("wait 100000");
      yield* advance(20);
      expect(titlesOf(yield* list({ state: "Running" }))).toEqual(["wait 100000"]);
      expect(titlesOf(yield* list({ state: "Idle" }))).toEqual(["Quiet"]);
    }).pipe(Effect.provide(make().layer)),
  );

  it.effect("filters by workspace and lists the workspaces to filter by, with their folders", () => {
    const value = make();
    const folder = join(value.directory, "project");
    mkdirSync(folder);
    return Effect.gen(function* () {
      yield* start("In the project", folder);
      yield* start("Scratch");
      yield* settleTurns;
      const all = yield* list();
      expect(all.workspaces.map((w) => w.name)).toEqual(["project"]);
      // Its folder too, so a mission started from the workspace's board starts there.
      expect(all.workspaces.map((w) => w.path)).toEqual([realpathSync(folder)]);
      const workspaceId = all.workspaces[0]?.id ?? null;
      expect(titlesOf(yield* list({ workspaceId }))).toEqual(["In the project"]);
    }).pipe(Effect.provide(value.layer));
  });

  it.effect("searches titles and briefings, ignoring case", () =>
    Effect.gen(function* () {
      yield* start("Plan the trip");
      const other = yield* start("Something else");
      yield* settleTurns;
      yield* tool(other.threadId, "update_journal", {
        basedOn: 0,
        briefing: "Booking the TRIP hotels.",
        entry: "Wrote the briefing.",
      });
      yield* start("Unrelated");
      yield* settleTurns;
      expect(titlesOf(yield* list({ search: "trip" })).toSorted()).toEqual(["Plan the trip", "Something else"]);
      expect(titlesOf(yield* list({ search: "  " }))).toHaveLength(3);
    }).pipe(Effect.provide(make().layer)),
  );

  it.effect("treats search wildcards as plain text", () =>
    Effect.gen(function* () {
      yield* start("100% done");
      yield* start("Other");
      yield* settleTurns;
      expect(titlesOf(yield* list({ search: "%" }))).toEqual(["100% done"]);
    }).pipe(Effect.provide(make().layer)),
  );
});
