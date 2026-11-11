import { describe, expect, it } from "@effect/vitest";
import type { MissionEnding, MissionId, MissionList, Settings } from "@iskios/contracts";
import { Effect, PubSub } from "effect";
import { TestClock } from "effect/testing";
import { afterEach } from "vitest";
import { Changes } from "../src/core/index.ts";
import { call, fixture, open, read, send, start } from "./fixtures/service.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
const live = () => {
  const value = fixture();
  fixtures.push(value);
  return value.layer;
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

const day = 24 * 60 * 60 * 1000;
const reportLine = 'call report_result {"result":"All done.","journal":"nothing to record"}';

/** Moves the test clock and lets forked turns and sweeps observe it and commit. */
const advance = (millis: number) =>
  Effect.gen(function* () {
    yield* TestClock.adjust(millis);
    for (let i = 0; i < 40; i++) yield* Effect.yieldNow;
  });
/** Lets a fake turn (10 millis) and its tool calls finish. */
const settleTurns = Effect.gen(function* () {
  for (let i = 0; i < 5; i++) yield* advance(20);
});

const list = (filters: Partial<Omit<Extract<Parameters<typeof call>[0], { _tag: "ListMissions" }>, "_tag">> = {}) =>
  call({ _tag: "ListMissions", isArchived: false, search: null, state: null, workspaceId: null, ...filters });
const summaryOf = (missions: MissionList, id: MissionId) => missions.missions.find((m) => m.id === id);
/** The journal's entries, oldest first (the Journal view lists them newest first). */
const entriesOf = (missionId: MissionId) =>
  call({ _tag: "ReadJournal", missionId }).pipe(Effect.map((view) => view.entries.map((e) => e.text).toReversed()));
const end = (missionId: MissionId, ending: MissionEnding) =>
  Effect.gen(function* () {
    const preview = yield* call({ _tag: "PreviewEnding", ending, missionId });
    yield* call({ _tag: "EndMission", ending, missionId, snapshot: preview.snapshot });
  });
const updateSettings = (change: Partial<Settings>) =>
  Effect.gen(function* () {
    const settings = yield* call({ _tag: "ReadSettings" });
    yield* call({ _tag: "UpdateSettings", settings: { ...settings, ...change } });
  });
/** A mission whose top thread has finished its first turn. */
const idle = (text = "Hello") =>
  Effect.gen(function* () {
    const started = yield* start(text);
    yield* settleTurns;
    return started;
  });

describe("working out a mission's state", () => {
  it.effect("takes the most urgent state among its threads", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      expect(summaryOf(yield* list(), missionId)?.state).toBe("Idle");
      yield* open(threadId, "wait 100000");
      yield* advance(20);
      expect(summaryOf(yield* list(), missionId)).toMatchObject({ runningCount: 1, state: "Running", threadCount: 2 });
      yield* open(threadId, 'ask {"action":"Push the code","command":"git push"}');
      yield* settleTurns;
      expect(summaryOf(yield* list(), missionId)?.state).toBe("Attention");
    }).pipe(Effect.provide(live())),
  );
});

describe("asking to mark a mission done", () => {
  it.effect("asks Mark as done when the top thread reports, without ending the mission", () =>
    Effect.gen(function* () {
      const { missionId } = yield* idle(reportLine);
      const summary = summaryOf(yield* list(), missionId);
      expect(summary).toMatchObject({ prompt: "MarkDone", state: "Idle" });
    }).pipe(Effect.provide(live())),
  );

  it.effect("does not ask when a thread beneath reports", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      yield* open(threadId, reportLine);
      yield* settleTurns;
      expect(summaryOf(yield* list(), missionId)?.prompt).toBeNull();
    }).pipe(Effect.provide(live())),
  );

  it.effect("stops asking after Not now, and asks again at the next result", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle(reportLine);
      yield* call({ _tag: "DismissMissionPrompt", missionId, prompt: "MarkDone" });
      expect(summaryOf(yield* list(), missionId)?.prompt).toBeNull();
      yield* send(threadId, reportLine);
      yield* settleTurns;
      expect(summaryOf(yield* list(), missionId)?.prompt).toBe("MarkDone");
    }).pipe(Effect.provide(live())),
  );
});

describe("asking about an inactive mission", () => {
  it.effect("asks after the set number of days without activity", () =>
    Effect.gen(function* () {
      const { missionId } = yield* idle();
      yield* advance(14 * day - 1000);
      expect(summaryOf(yield* list(), missionId)?.prompt).toBeNull();
      yield* advance(1000);
      expect(summaryOf(yield* list(), missionId)?.prompt).toBe("Inactive");
    }).pipe(Effect.provide(live())),
  );

  it.effect("counts an agent's activity as activity", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      yield* open(threadId, `wait ${10 * day}`);
      yield* advance(10 * day);
      yield* settleTurns;
      // The thread beneath finished after 10 days: its turn and reply are activity.
      yield* advance(13 * day);
      expect(summaryOf(yield* list(), missionId)?.prompt).toBeNull();
      yield* advance(day);
      expect(summaryOf(yield* list(), missionId)?.prompt).toBe("Inactive");
    }).pipe(Effect.provide(live())),
  );

  it.effect("asks again after another inactive period once dismissed", () =>
    Effect.gen(function* () {
      const { missionId } = yield* idle();
      yield* advance(14 * day);
      yield* call({ _tag: "DismissMissionPrompt", missionId, prompt: "Inactive" });
      expect(summaryOf(yield* list(), missionId)?.prompt).toBeNull();
      yield* advance(14 * day - 1000);
      expect(summaryOf(yield* list(), missionId)?.prompt).toBeNull();
      yield* advance(1000);
      expect(summaryOf(yield* list(), missionId)?.prompt).toBe("Inactive");
    }).pipe(Effect.provide(live())),
  );

  it.effect("follows the inactivity setting", () =>
    Effect.gen(function* () {
      yield* updateSettings({ inactivityDays: 3 });
      const { missionId } = yield* idle();
      yield* advance(3 * day);
      expect(summaryOf(yield* list(), missionId)?.prompt).toBe("Inactive");
    }).pipe(Effect.provide(live())),
  );

  it.effect("announces a change each hour, so an open dashboard asks about a newly inactive mission", () =>
    Effect.gen(function* () {
      yield* idle();
      const subscription = yield* PubSub.subscribe((yield* Changes).pubsub);
      yield* advance(60 * 60 * 1000);
      expect((yield* PubSub.takeAll(subscription)).length).toBeGreaterThan(0);
    }).pipe(Effect.scoped, Effect.provide(live())),
  );

  it.effect("does not ask of a Done mission", () =>
    Effect.gen(function* () {
      const { missionId } = yield* idle();
      yield* end(missionId, "Done");
      yield* advance(20 * day);
      expect(summaryOf(yield* list(), missionId)?.prompt).toBeNull();
    }).pipe(Effect.provide(live())),
  );
});

describe("ending a mission", () => {
  it.effect("marks a mission Done with its journal entry and clears its question", () =>
    Effect.gen(function* () {
      const { missionId } = yield* idle(reportLine);
      const preview = yield* call({ _tag: "PreviewEnding", ending: "Done", missionId });
      expect(preview).toMatchObject({ question: null, workingCount: 0 });
      yield* call({ _tag: "EndMission", ending: "Done", missionId, snapshot: preview.snapshot });
      expect(summaryOf(yield* list(), missionId)).toMatchObject({ prompt: null, state: "Done" });
      expect(yield* entriesOf(missionId)).toEqual(["Marked done by the user"]);
    }).pipe(Effect.provide(live())),
  );

  it.effect("names the threads still at work, then stops them", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      const first = yield* open(threadId, "wait 100000");
      yield* open(threadId, 'ask {"action":"Push the code","command":"git push"}');
      yield* settleTurns;
      const preview = yield* call({ _tag: "PreviewEnding", ending: "Done", missionId });
      expect(preview.workingCount).toBe(2);
      expect(preview.question).toBe("2 threads are still running. Stop them and mark as done?");
      yield* call({ _tag: "EndMission", ending: "Done", missionId, snapshot: preview.snapshot });
      const detail = yield* read(missionId, first.threadId);
      expect(detail.threads.filter((t) => t.depth === 1).map((t) => t.state)).toEqual(["Stopped", "Stopped"]);
      expect(yield* call({ _tag: "ListOpenQuestions" })).toEqual([]);
      expect(detail.mission.state).toBe("Done");
    }).pipe(Effect.provide(live())),
  );

  it.effect("names one running thread in the singular", () =>
    Effect.gen(function* () {
      const { missionId } = yield* start("wait 100000");
      yield* advance(20);
      const preview = yield* call({ _tag: "PreviewEnding", ending: "Done", missionId });
      expect(preview.question).toBe("1 thread is still running. Stop it and mark as done?");
    }).pipe(Effect.provide(live())),
  );

  it.effect("refuses to end when the threads at work changed since the preview", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      const preview = yield* call({ _tag: "PreviewEnding", ending: "Done", missionId });
      yield* open(threadId, "wait 100000");
      yield* advance(20);
      const failure = yield* Effect.flip(
        call({ _tag: "EndMission", ending: "Archived", missionId, snapshot: preview.snapshot }),
      );
      expect(failure.kind).toBe("StaleVersion");
      expect(summaryOf(yield* list(), missionId)?.state).toBe("Running");
    }).pipe(Effect.provide(live())),
  );

  it.effect("archives a mission into the Archived view with its journal entry", () =>
    Effect.gen(function* () {
      const { missionId } = yield* idle();
      yield* end(missionId, "Archived");
      expect(summaryOf(yield* list(), missionId)).toBeUndefined();
      expect(summaryOf(yield* list({ isArchived: true }), missionId)?.state).toBe("Archived");
      expect(yield* entriesOf(missionId)).toEqual(["Archived by the user"]);
    }).pipe(Effect.provide(live())),
  );
});

describe("archiving done missions automatically", () => {
  it.effect("leaves Done missions alone by default", () =>
    Effect.gen(function* () {
      const { missionId } = yield* idle();
      yield* end(missionId, "Done");
      yield* advance(60 * day);
      expect(summaryOf(yield* list(), missionId)?.state).toBe("Done");
    }).pipe(Effect.provide(live())),
  );

  it.effect("archives a Done mission the set number of days after it was marked Done", () =>
    Effect.gen(function* () {
      yield* updateSettings({ autoArchiveDays: 30, shouldAutoArchive: true });
      const { missionId } = yield* idle();
      yield* end(missionId, "Done");
      yield* advance(29 * day);
      expect(summaryOf(yield* list(), missionId)?.state).toBe("Done");
      yield* advance(2 * day);
      expect(summaryOf(yield* list({ isArchived: true }), missionId)?.state).toBe("Archived");
      expect(yield* entriesOf(missionId)).toEqual(["Marked done by the user", "Archived automatically"]);
    }).pipe(Effect.provide(live())),
  );
});

describe("continuing an ended mission", () => {
  it.effect("reopens an archived mission to the state from its threads", () =>
    Effect.gen(function* () {
      const { missionId } = yield* idle();
      yield* end(missionId, "Archived");
      yield* call({ _tag: "ReopenMission", missionId });
      expect(summaryOf(yield* list(), missionId)?.state).toBe("Idle");
      expect(yield* entriesOf(missionId)).toEqual(["Archived by the user", "Reopened by the user"]);
    }).pipe(Effect.provide(live())),
  );

  it.effect("refuses to reopen a mission that has not ended", () =>
    Effect.gen(function* () {
      const { missionId } = yield* idle();
      const failure = yield* Effect.flip(call({ _tag: "ReopenMission", missionId }));
      expect(failure.kind).toBe("InvalidInput");
    }).pipe(Effect.provide(live())),
  );

  it.effect("brings a Done mission back when the owner writes in one of its threads", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      yield* end(missionId, "Done");
      yield* send(threadId, "wait 100000");
      yield* advance(20);
      expect(summaryOf(yield* list(), missionId)?.state).toBe("Running");
    }).pipe(Effect.provide(live())),
  );

  it.effect("brings an archived mission back to the dashboard when the owner writes in it", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      yield* end(missionId, "Archived");
      yield* send(threadId, "Back to it");
      yield* settleTurns;
      expect(summaryOf(yield* list(), missionId)?.state).toBe("Idle");
      expect(summaryOf(yield* list({ isArchived: true }), missionId)).toBeUndefined();
    }).pipe(Effect.provide(live())),
  );
});

describe("ending an ended mission", () => {
  it.effect("refuses to mark a Done mission done again, or an archived one done", () =>
    Effect.gen(function* () {
      const { missionId } = yield* idle();
      yield* end(missionId, "Done");
      expect((yield* Effect.flip(end(missionId, "Done"))).kind).toBe("InvalidInput");
      yield* end(missionId, "Archived");
      expect((yield* Effect.flip(end(missionId, "Done"))).kind).toBe("InvalidInput");
      expect(yield* entriesOf(missionId)).toEqual(["Marked done by the user", "Archived by the user"]);
    }).pipe(Effect.provide(live())),
  );
});
