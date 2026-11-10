import { mkdirSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import type { MissionDetail, MissionId, Suggestion, SuggestionAnswer, ThreadId } from "@gild/contracts";
import { Effect } from "effect";
import { afterEach } from "vitest";
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
const lastAgentText = (detail: MissionDetail) => detail.messages.filter((m) => m.sender === "agent").at(-1)?.text ?? "";

const startIdle = (text: string, workspacePath: string | null = null) =>
  Effect.gen(function* () {
    const started = yield* start(text, workspacePath);
    yield* settle(started.missionId, isIdle);
    return started;
  });

/** The Guildmaster's place, made on first use. */
const guildmaster = call({ _tag: "ReadGuildmaster" });

/** Writes to the Guildmaster as the owner; the fake harness runs the scripted `call` line as its agent would. */
const say = (threadId: ThreadId, text: string, realmPath: string | null = null) =>
  call({ _tag: "SendMessage", delivery: null, realmPath, requestId: crypto.randomUUID(), text, threadId });

const answer = (suggestion: Suggestion, given: SuggestionAnswer) =>
  call({ _tag: "AnswerSuggestion", answer: given, suggestionId: suggestion.id });

const listed = call({ _tag: "ListMissions", isArchived: false, search: null, state: null, workspaceId: null });

/** A folder under the fixture's home, which a quest turns into a realm. */
const folderIn = (directory: string, name: string) => {
  const path = join(realpathSync(directory), name);
  mkdirSync(path, { recursive: true });
  return path;
};

describe("the Guildmaster's place", () => {
  it.live("is made once, hidden from every list, and cannot be ended, renamed, or deleted", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      expect(yield* guildmaster).toEqual(place);
      yield* startIdle("Fix the printer");
      const dashboard = yield* listed;
      expect(dashboard.missions.map((mission) => mission.id)).not.toContain(place.missionId);
      const archived = yield* call({
        _tag: "ListMissions",
        isArchived: true,
        search: null,
        state: null,
        workspaceId: null,
      });
      expect(archived.missions.map((mission) => mission.id)).not.toContain(place.missionId);
      const searched = yield* call({
        _tag: "ListMissions",
        isArchived: false,
        search: "Guildmaster",
        state: null,
        workspaceId: null,
      });
      expect(searched.missions).toEqual([]);
      const refusals = [
        yield* Effect.flip(call({ _tag: "PreviewEnding", ending: "Archived", missionId: place.missionId })),
        yield* Effect.flip(call({ _tag: "RenameMission", missionId: place.missionId, title: "Mine" })),
        yield* Effect.flip(call({ _tag: "PreviewDeletion", threadId: place.threadId })),
      ];
      for (const refusal of refusals) expect(JSON.stringify(refusal)).toContain("Guildmaster is permanent");
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("starts a turn from its own instructions, the realms, and the quests as a list, not a journal", () => {
    const { directory, layer } = setup();
    return Effect.gen(function* () {
      const folder = folderIn(directory, "app");
      const quest = yield* startIdle("Add dark mode to the settings page", folder);
      const place = yield* guildmaster;
      yield* say(place.threadId, "context");
      const detail = yield* settle(
        place.missionId,
        (d) => lastAgentText(d).includes("# You are the Guildmaster"),
        place.threadId,
      );
      const context = lastAgentText(detail);
      expect(context).toContain("route work to quests");
      expect(context).toContain(`- app: ${folder}`);
      expect(context).toContain(`"Add dark mode to the settings page" (id ${quest.missionId})`);
      expect(context).not.toContain("# Quest journal at this turn");
      expect(context).not.toContain("open_thread once per part");
    }).pipe(Effect.provide(layer));
  });
});

describe("opening a quest", () => {
  it.live(
    "opens it from the Guildmaster, in the named realm, shows a card, and starts its thread on the request",
    () => {
      const { directory, layer } = setup();
      return Effect.gen(function* () {
        const folder = folderIn(directory, "app");
        yield* startIdle("Existing work", folder);
        const place = yield* guildmaster;
        const args = { realm: "app", request: "Fix the login redirect loop", title: "Login loop" };
        yield* say(place.threadId, `call open_mission ${JSON.stringify(args)}`);
        const detail = yield* settle(place.missionId, (d) => d.suggestions.length === 1 && isIdle(d), place.threadId);
        const card = detail.suggestions[0];
        expect(card).toMatchObject({
          isAutomatic: true,
          isFromGuildmaster: true,
          outcome: "MovedToMission",
          targetTitle: "Login loop",
        });
        expect(lastAgentText(detail)).toContain("Opened the quest");
        const opened = yield* settle(card?.targetMissionId as MissionId, (d) =>
          d.messages.some((m) => m.sender === "agent"),
        );
        expect(opened.messages[0]?.text).toBe("Fix the login redirect loop");
        expect(opened.thread.workspace?.path).toBe(folder);
        expect((yield* listed).missions.map((mission) => mission.title)).toContain("Login loop");
      }).pipe(Effect.provide(layer));
    },
  );

  it.live("is the Guildmaster's alone, and refuses a realm that does not exist", () =>
    Effect.gen(function* () {
      const quest = yield* startIdle("Some quest");
      const refused = yield* tool(quest.threadId, "open_mission", { request: "Do something" });
      expect(refused).toBe("Only the Guildmaster opens quests.");
      const place = yield* guildmaster;
      const unknown = yield* tool(place.threadId, "open_mission", { realm: "nowhere", request: "Do something" });
      expect(unknown).toContain('no realm "nowhere"');
      expect((yield* listed).missions).toHaveLength(1);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("opens no thread beneath itself", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      const refused = yield* tool(place.threadId, "open_thread", { request: "Split this up" });
      expect(refused).toContain("opens no threads");
      expect((yield* read(place.missionId)).threads).toHaveLength(1);
    }).pipe(Effect.provide(setup().layer)),
  );
});

describe("finding a quest that already fits", () => {
  it.live("finds the quest on the same ticket, though its title and briefing never name it", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      const first = yield* startIdle(
        "Fix the checkout total rounding. Ticket PAY-481, see https://tracker.example/browse/PAY-481",
      );
      yield* startIdle("Compare lunch options");
      const found = yield* tool(place.threadId, "find_missions", { request: "Please take PAY-481 for me" });
      expect(found).toContain(first.missionId);
      expect(found).not.toContain("lunch");
      const byLink = yield* tool(place.threadId, "find_missions", {
        request: "https://tracker.example/browse/PAY-481/",
      });
      expect(byLink).toContain(first.missionId);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("ranks a shared ticket above shared words and never offers the Guildmaster itself", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      const wordy = yield* startIdle("Checkout total rounding review");
      const ticket = yield* startIdle("Billing work for ticket PAY-481");
      const found = yield* tool(place.threadId, "find_missions", { request: "Checkout total rounding, PAY-481" });
      expect(found.indexOf(ticket.missionId)).toBeLessThan(found.indexOf(wordy.missionId));
      expect(found).not.toContain(place.missionId);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("offers Continue in, then sends the owner's words to the chosen quest", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      const existing = yield* startIdle("Fix the checkout total rounding, ticket PAY-481");
      const args = {
        missions: [existing.missionId],
        text: "Take PAY-481 again, with the rounding bug",
        title: "PAY-481",
      };
      yield* say(place.threadId, `call suggest_mission ${JSON.stringify(args)}`);
      const waiting = yield* settle(
        place.missionId,
        (d) => d.suggestions.some((s) => s.outcome === null),
        place.threadId,
      );
      const card = waiting.suggestions.find((s) => s.outcome === null);
      if (card === undefined) return yield* Effect.die("Missing card");
      expect(card.isFromGuildmaster).toBe(true);
      expect(card.matches.map((match) => match.missionId)).toEqual([existing.missionId]);
      const asAside = yield* Effect.flip(answer(card, { _tag: "Aside" }));
      expect(JSON.stringify(asAside)).toContain("keeps no asides");
      yield* answer(card, { _tag: "Continue", missionId: existing.missionId });
      const continued = yield* settle(
        existing.missionId,
        (d) => d.messages.filter((m) => m.sender === "user").length === 2,
      );
      expect(continued.messages.filter((m) => m.sender === "user").at(-1)?.text).toBe(
        "Take PAY-481 again, with the rounding bug",
      );
      expect((yield* listed).missions).toHaveLength(1);
      const done = yield* settle(
        place.missionId,
        (d) => isIdle(d) && d.suggestions.every((s) => s.outcome !== null),
        place.threadId,
      );
      expect(done.suggestions[0]).toMatchObject({ outcome: "Continued", targetMissionId: existing.missionId });
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("opens a new quest in the realm the owner named when the owner chooses to open one anyway", () => {
    const { directory, layer } = setup();
    return Effect.gen(function* () {
      const folder = folderIn(directory, "billing");
      const existing = yield* startIdle("Fix the checkout total rounding, ticket PAY-481", folder);
      const place = yield* guildmaster;
      const args = {
        missions: [existing.missionId],
        realm: "billing",
        text: "A second look at PAY-481",
        title: "Second look",
      };
      yield* say(place.threadId, `call suggest_mission ${JSON.stringify(args)}`);
      const waiting = yield* settle(
        place.missionId,
        (d) => d.suggestions.some((s) => s.outcome === null),
        place.threadId,
      );
      const card = waiting.suggestions.find((s) => s.outcome === null);
      if (card === undefined) return yield* Effect.die("Missing card");
      yield* answer(card, { _tag: "NewMission", effort: "default", model: "default" });
      const done = yield* settle(
        place.missionId,
        (d) => d.suggestions.some((s) => s.outcome === "MovedToMission"),
        place.threadId,
      );
      const opened = yield* read(done.suggestions[0]?.targetMissionId as MissionId);
      expect(opened.thread.workspace?.path).toBe(folder);
      expect(opened.mission.title).toBe("Second look");
    }).pipe(Effect.provide(layer));
  });
});

describe("a realm chosen for a message", () => {
  it.live("reaches the Guildmaster's turn with the message, and is kept on it", () => {
    const { directory, layer } = setup();
    return Effect.gen(function* () {
      const folder = folderIn(directory, "app");
      yield* startIdle("Existing work", folder);
      const place = yield* guildmaster;
      yield* say(place.threadId, "Fix the login bug", folder);
      const detail = yield* settle(place.missionId, (d) => lastAgentText(d) !== "", place.threadId);
      expect(lastAgentText(detail)).toContain("Fix the login bug");
      expect(lastAgentText(detail)).toContain(`The owner chose the realm "app" (${folder})`);
    }).pipe(Effect.provide(layer));
  });
});

// A plain owner message to a quest still carries no realm note.
describe("an ordinary quest", () => {
  it.live("is not told about realms in its messages", () =>
    Effect.gen(function* () {
      const quest = yield* startIdle("Hello there");
      yield* send(quest.threadId, "Another message");
      const detail = yield* settle(quest.missionId, (d) => lastAgentText(d).includes("Another message"));
      expect(lastAgentText(detail)).not.toContain("The owner chose the realm");
    }).pipe(Effect.provide(setup().layer)),
  );
});
