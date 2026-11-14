import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import type { MissionDetail, MissionId, Suggestion, SuggestionAnswer, ThreadId } from "@iskios/contracts";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { fakeHarnessLayer, serviceLayer } from "../src/index.ts";
import { call, fixture, read, send, settle, start, tool } from "./fixtures/service.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
const setup = () => {
  const value = fixture();
  fixtures.push(value);
  return value;
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

const isIdle = (detail: MissionDetail) => detail.thread.state === "Idle";

/** Starts a mission and waits for its first turn to end. */
const startIdle = (text: string) =>
  Effect.gen(function* () {
    const started = yield* start(text);
    yield* settle(started.missionId, isIdle);
    return started;
  });

/** Rewrites a mission's briefing as the owner. */
const brief = (missionId: MissionId, briefing: string) =>
  call({ _tag: "RewriteBriefing", basedOn: 0, briefing, entry: null, missionId, requestId: crypto.randomUUID() });

/** Has the thread call suggest_mission, as its agent would after judging the owner's message off topic. */
const suggest = (threadId: ThreadId, args: { text: string; title: string; missions: ReadonlyArray<string> }) =>
  send(threadId, `call suggest_mission ${JSON.stringify(args)}`);

/** Waits for the thread's open suggestion. */
const openSuggestion = (missionId: MissionId, threadId: ThreadId | null = null) =>
  Effect.gen(function* () {
    const detail = yield* settle(missionId, (d) => d.suggestions.some((s) => s.outcome === null), threadId);
    const suggestion = detail.suggestions.find((s) => s.outcome === null);
    if (suggestion === undefined) return yield* Effect.die("Missing suggestion");
    return { detail, suggestion };
  });

const answer = (suggestion: Suggestion, given: SuggestionAnswer) =>
  call({ _tag: "AnswerSuggestion", answer: given, suggestionId: suggestion.id });

const lastAgentText = (detail: MissionDetail) => detail.messages.filter((m) => m.sender === "agent").at(-1)?.text ?? "";

describe("finding missions for an off-topic request", () => {
  it.live("matches other missions by title and briefing, whatever their state, best first", () =>
    Effect.gen(function* () {
      const current = yield* startIdle("Write the Lisbon trip report");
      const trip = yield* startIdle("Plan the Lisbon trip");
      const hotel = yield* startIdle("Compare options");
      yield* brief(hotel.missionId, "Comparing hotels in Lisbon for the trip.");
      const archived = yield* startIdle("Lisbon flights");
      const preview = yield* call({ _tag: "PreviewEnding", ending: "Archived", missionId: archived.missionId });
      yield* call({
        _tag: "EndMission",
        ending: "Archived",
        missionId: archived.missionId,
        snapshot: preview.snapshot,
      });
      yield* startIdle("Fix the printer");
      const answer = yield* tool(current.threadId, "find_missions", { request: "Book a hotel for the Lisbon trip" });
      const order = [trip.missionId, hotel.missionId, archived.missionId].map((id) => answer.indexOf(id));
      expect(order.every((index) => index >= 0)).toBe(true);
      expect(answer).toContain("Archived");
      expect(answer).toContain("Comparing hotels in Lisbon");
      expect(answer).not.toContain("printer");
      expect(answer).not.toContain(current.missionId);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("offers at most 3 missions and never a deleted one", () =>
    Effect.gen(function* () {
      const current = yield* startIdle("Write the report");
      const kept = [];
      for (const title of ["Garden plan", "Garden tools", "Garden shed", "Garden pond", "Garden fence"])
        kept.push(yield* startIdle(title));
      const deleted = kept[0];
      if (deleted === undefined) return yield* Effect.die("Missing mission");
      const preview = yield* call({ _tag: "PreviewDeletion", threadId: deleted.threadId });
      yield* call({ _tag: "DeleteThread", confirmation: preview.confirmation, threadId: deleted.threadId });
      const answer = yield* tool(current.threadId, "find_missions", { request: "garden" });
      expect(answer).not.toContain(deleted.missionId);
      expect(kept.slice(1).filter((m) => answer.includes(m.missionId))).toHaveLength(3);
      const none = yield* tool(current.threadId, "find_missions", { request: "astronomy" });
      expect(none).toContain("No mission");
    }).pipe(Effect.provide(setup().layer)),
  );
});

describe("suggesting where an off-topic request goes", () => {
  it.live("puts the thread in Attention with the matching missions and their states", () =>
    Effect.gen(function* () {
      const current = yield* startIdle("Write the report");
      const trip = yield* startIdle("Plan the Lisbon trip");
      yield* suggest(current.threadId, { missions: [trip.missionId], text: "Book a hotel", title: "Hotel booking" });
      const { detail, suggestion } = yield* openSuggestion(current.missionId);
      expect(detail.thread.state).toBe("Attention");
      expect(suggestion).toMatchObject({
        matches: [{ missionId: trip.missionId, state: "Idle", title: "Plan the Lisbon trip" }],
        model: "default",
        text: "Book a hotel",
        title: "Hotel booking",
      });
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("continues in the chosen mission, waking it, and leaves a link behind", () =>
    Effect.gen(function* () {
      const current = yield* startIdle("Write the report");
      const trip = yield* startIdle("Plan the Lisbon trip");
      const preview = yield* call({ _tag: "PreviewEnding", ending: "Done", missionId: trip.missionId });
      yield* call({ _tag: "EndMission", ending: "Done", missionId: trip.missionId, snapshot: preview.snapshot });
      yield* suggest(current.threadId, { missions: [trip.missionId], text: "Book a hotel", title: "Hotel booking" });
      const { suggestion } = yield* openSuggestion(current.missionId);
      expect(suggestion.matches[0]?.state).toBe("Done");
      yield* answer(suggestion, { _tag: "Continue", missionId: trip.missionId });
      const target = yield* settle(trip.missionId, (d) => d.messages.some((m) => m.text === "Echo: Book a hotel"));
      expect(target.messages.some((m) => m.sender === "user" && m.text === "Book a hotel")).toBe(true);
      expect(target.mission.state).not.toBe("Done");
      const original = yield* settle(
        current.missionId,
        (d) => isIdle(d) && lastAgentText(d).includes("continued it in mission"),
      );
      expect(lastAgentText(original)).toContain("as if that message had not been sent");
      expect(original.suggestions[0]).toMatchObject({
        outcome: "Continued",
        targetMissionId: trip.missionId,
        targetTitle: "Plan the Lisbon trip",
      });
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("drops the @ of a mention written in a suggestion, which would grant reach as the owner's words do", () =>
    Effect.gen(function* () {
      const current = yield* startIdle("Write the report");
      const trip = yield* startIdle("Plan the Lisbon trip");
      yield* suggest(current.threadId, {
        missions: [trip.missionId],
        text: `Book a hotel, see @quest:${trip.missionId}`,
        title: "Hotel booking",
      });
      const { suggestion } = yield* openSuggestion(current.missionId);
      expect(suggestion.text).toBe(`Book a hotel, see quest:${trip.missionId}`);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("refuses to continue in a mission it did not offer", () =>
    Effect.gen(function* () {
      const current = yield* startIdle("Write the report");
      const trip = yield* startIdle("Plan the Lisbon trip");
      const other = yield* startIdle("Fix the printer");
      yield* suggest(current.threadId, { missions: [trip.missionId], text: "Book a hotel", title: "Hotel booking" });
      const { suggestion } = yield* openSuggestion(current.missionId);
      const refused = yield* Effect.flip(answer(suggestion, { _tag: "Continue", missionId: other.missionId }));
      expect(refused.kind).toBe("InvalidInput");
      expect((yield* read(current.missionId)).suggestions[0]?.outcome).toBeNull();
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("opens a new mission that starts fresh with only the off-topic part", () =>
    Effect.gen(function* () {
      const current = yield* start("Write the report");
      yield* settle(current.missionId, isIdle);
      yield* brief(current.missionId, "The report covers Q3 sales.");
      yield* suggest(current.threadId, { missions: [], text: "context", title: "Read my emails" });
      const { suggestion } = yield* openSuggestion(current.missionId);
      const choicesBefore = yield* call({ _tag: "ReadStartChoices" });
      yield* answer(suggestion, { _tag: "NewMission", effort: "low", model: "haiku" });
      const original = yield* settle(current.missionId, (d) => d.suggestions[0]?.outcome === "MovedToMission");
      const moved = original.suggestions[0];
      if (moved?.targetMissionId == null) return yield* Effect.die("Missing new mission");
      const fresh = yield* settle(moved.targetMissionId, (d) => isIdle(d) && lastAgentText(d) !== "");
      expect(fresh.mission.title).toBe("Read my emails");
      expect(moved.targetTitle).toBe("Read my emails");
      expect(fresh.thread).toMatchObject({ effort: "low", model: "haiku", workspace: null });
      expect(fresh.messages.filter((m) => m.sender === "user").map((m) => m.text)).toEqual(["context"]);
      expect(lastAgentText(fresh)).not.toContain("Q3 sales");
      expect(lastAgentText(fresh)).not.toContain("Write the report");
      expect(yield* call({ _tag: "ReadStartChoices" })).toEqual(choicesBefore);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("keeps it as an aside beneath the thread, with the briefing and the aside's rules", () =>
    Effect.gen(function* () {
      const current = yield* startIdle("Write the report");
      yield* brief(current.missionId, "The report covers Q3 sales.");
      yield* suggest(current.threadId, { missions: [], text: "context", title: "Weather chat" });
      const { suggestion } = yield* openSuggestion(current.missionId);
      yield* answer(suggestion, { _tag: "Aside" });
      const original = yield* settle(current.missionId, (d) => d.suggestions[0]?.outcome === "KeptAsAside");
      const asideId = original.suggestions[0]?.targetThreadId;
      if (asideId == null) return yield* Effect.die("Missing aside");
      expect(original.threads.find((t) => t.id === asideId)).toMatchObject({
        isAside: true,
        parentId: current.threadId,
        title: "Weather chat",
      });
      const aside = yield* settle(current.missionId, (d) => isIdle(d) && lastAgentText(d) !== "", asideId);
      expect(aside.messages[0]).toMatchObject({ sender: "user", text: "context" });
      const context = lastAgentText(aside);
      expect(context).toContain("The report covers Q3 sales.");
      expect(context).toContain("went off the quest's topic and was put aside");
      expect(context).toContain("comes back to the quest");
      const refused = yield* tool(asideId, "update_journal", { entry: "Weather is fine" });
      expect(refused).toContain("aside");
      yield* tool(asideId, "report_result", { journal: "Talked about the weather", result: "Sunny" });
      const journal = yield* call({ _tag: "ReadJournal", missionId: current.missionId });
      expect(journal.entries.some((e) => e.text.includes("weather"))).toBe(false);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("opens a new mission without asking when the setting is on and nothing matches", () =>
    Effect.gen(function* () {
      const settings = yield* call({ _tag: "ReadSettings" });
      expect(settings.shouldOpenOffTopicMissions).toBe(false);
      yield* call({ _tag: "UpdateSettings", settings: { ...settings, shouldOpenOffTopicMissions: true } });
      const current = yield* startIdle("Write the report");
      yield* suggest(current.threadId, { missions: [], text: "Read my emails", title: "Emails" });
      const original = yield* settle(current.missionId, (d) => isIdle(d) && d.suggestions.length > 0);
      expect(original.suggestions[0]).toMatchObject({ isAutomatic: true, outcome: "MovedToMission" });
      expect(lastAgentText(original)).toContain("as the owner's settings ask");
      const trip = yield* startIdle("Plan the Lisbon trip");
      yield* suggest(current.threadId, { missions: [trip.missionId], text: "Book a hotel", title: "Hotel" });
      const { detail } = yield* openSuggestion(current.missionId);
      expect(detail.thread.state).toBe("Attention");
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("withdraws the suggestion when the owner stops the thread", () =>
    Effect.gen(function* () {
      const current = yield* startIdle("Write the report");
      yield* suggest(current.threadId, { missions: [], text: "Read my emails", title: "Emails" });
      const { suggestion } = yield* openSuggestion(current.missionId);
      yield* call({ _tag: "StopThread", threadId: current.threadId });
      const stopped = yield* read(current.missionId);
      expect(stopped.suggestions[0]?.outcome).toBe("Withdrawn");
      expect((yield* Effect.flip(answer(suggestion, { _tag: "Aside" }))).kind).toBe("InvalidInput");
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("tells every thread how to handle an off-topic message", () =>
    Effect.gen(function* () {
      const current = yield* start("context");
      const detail = yield* settle(current.missionId, (d) => isIdle(d) && lastAgentText(d) !== "");
      expect(lastAgentText(detail)).toContain("find_missions");
      expect(lastAgentText(detail)).toContain("suggest_mission");
    }).pipe(Effect.provide(setup().layer)),
  );
});

describe("opening off-topic requests without asking", () => {
  it.live("still asks when a mission matches, even if the thread named none", () =>
    Effect.gen(function* () {
      const settings = yield* call({ _tag: "ReadSettings" });
      yield* call({ _tag: "UpdateSettings", settings: { ...settings, shouldOpenOffTopicMissions: true } });
      const trip = yield* startIdle("Plan the Lisbon trip");
      const current = yield* startIdle("Write the report");
      yield* suggest(current.threadId, { missions: [], text: "Book a Lisbon hotel for the trip", title: "Hotel" });
      const { detail, suggestion } = yield* openSuggestion(current.missionId);
      expect(detail.thread.state).toBe("Attention");
      expect(suggestion.matches.map((m) => m.missionId)).toEqual([trip.missionId]);
    }).pipe(Effect.provide(setup().layer)),
  );
});

describe("withdrawing a suggestion", () => {
  it.live("withdraws it when the owner interrupts the thread", () =>
    Effect.gen(function* () {
      const current = yield* startIdle("Write the report");
      yield* suggest(current.threadId, { missions: [], text: "Read my emails", title: "Emails" });
      yield* openSuggestion(current.missionId);
      yield* call({ _tag: "InterruptThread", threadId: current.threadId });
      const after = yield* settle(current.missionId, (d) => d.suggestions[0]?.outcome === "Withdrawn");
      expect(after.thread.state).not.toBe("Attention");
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("withdraws an open suggestion when the service restarts", () => {
    const value = setup();
    const again = serviceLayer({
      filename: join(value.directory, "store.sqlite"),
      harness: fakeHarnessLayer("10 millis"),
      homeFolder: value.directory,
      scratchRoot: join(value.directory, "missions"),
    });
    return Effect.gen(function* () {
      const current = yield* Effect.gen(function* () {
        const started = yield* startIdle("Write the report");
        yield* suggest(started.threadId, { missions: [], text: "Read my emails", title: "Emails" });
        yield* openSuggestion(started.missionId);
        return started;
      }).pipe(Effect.provide(value.layer));
      const after = yield* read(current.missionId).pipe(Effect.provide(again));
      expect(after.suggestions[0]?.outcome).toBe("Withdrawn");
      expect(after.thread.state).not.toBe("Attention");
    });
  });

  it.live("tells a thread not at work in a turn that its suggestion was not asked, not that it was stopped", () =>
    Effect.gen(function* () {
      const current = yield* startIdle("Write the report");
      const answer = yield* tool(current.threadId, "suggest_mission", {
        missions: [],
        text: "Emails",
        title: "Emails",
      });
      expect(answer).not.toContain("stopped");
      expect(answer).toContain("not at work");
    }).pipe(Effect.provide(setup().layer)),
  );
});
