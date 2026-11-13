import { describe, expect, it } from "@effect/vitest";
import {
  AccountId,
  type MissionDetail,
  type MissionId,
  type Suggestion,
  type SuggestionAnswer,
  type ThreadId,
} from "@iskios/contracts";
import { Effect, Schema } from "effect";
import { call, read, send, settle, start, withService } from "../fixtures/service.ts";

const isIdle = (detail: MissionDetail) => detail.thread.state === "Idle";

/** Has the thread call suggest_mission, as its agent would after judging the owner's message off topic. */
const suggest = (threadId: ThreadId, args: { text: string; title: string; missions: ReadonlyArray<string> }) =>
  send(threadId, `call suggest_mission ${JSON.stringify(args)}`);

/** Waits for the thread's open suggestion. */
const openSuggestion = (missionId: MissionId) =>
  Effect.gen(function* () {
    const detail = yield* settle(missionId, (candidate) =>
      candidate.suggestions.some((suggestion) => suggestion.outcome === null),
    );
    const suggestion = detail.suggestions.find((candidate) => candidate.outcome === null);
    if (suggestion === undefined) return yield* Effect.die("Missing suggestion");
    return { detail, suggestion };
  });

const answer = (suggestion: Suggestion, given: SuggestionAnswer) =>
  call({ _tag: "AnswerSuggestion", answer: given, suggestionId: suggestion.id });

describe("opening a new mission from a card", () => {
  it.live("opens a new mission with the backup Companions of the preset chosen on the card", () =>
    withService(
      Effect.gen(function* () {
        const current = yield* start("Write the report");
        yield* settle(current.missionId, isIdle);
        yield* suggest(current.threadId, { missions: [], text: "context", title: "Read my emails" });
        const { suggestion } = yield* openSuggestion(current.missionId);
        const codex = { accountId: null, effort: "default", harness: "codex", model: "gpt-5" } as const;
        yield* answer(suggestion, { _tag: "NewMission", backups: [codex], effort: "low", model: "haiku" });
        const original = yield* settle(
          current.missionId,
          (detail) => detail.suggestions[0]?.outcome === "MovedToMission",
        );
        const target = original.suggestions[0]?.targetThreadId;
        if (target == null) return yield* Effect.die("Missing new mission");
        expect((yield* call({ _tag: "ReadThreadPanel", threadId: target })).backups).toEqual([codex]);
      }),
    ),
  );

  it.live("opens a new mission with the default backups even when one names a removed account", () =>
    withService(
      Effect.gen(function* () {
        const settings = yield* call({ _tag: "ReadSettings" });
        const removed = {
          accountId: Schema.decodeSync(AccountId)("removed-account"),
          effort: "default",
          harness: "codex",
          model: "gpt-5",
        } as const;
        yield* call({ _tag: "UpdateSettings", settings: { ...settings, backups: [removed] } });
        const current = yield* start("Write the report");
        yield* settle(current.missionId, isIdle);
        yield* suggest(current.threadId, { missions: [], text: "context", title: "Read my emails" });
        const { suggestion } = yield* openSuggestion(current.missionId);
        yield* answer(suggestion, { _tag: "NewMission", effort: "low", model: "haiku" });
        const original = yield* settle(
          current.missionId,
          (detail) => detail.suggestions[0]?.outcome === "MovedToMission",
        );
        const target = original.suggestions[0]?.targetThreadId;
        if (target == null) return yield* Effect.die("Missing new mission");
        expect((yield* call({ _tag: "ReadThreadPanel", threadId: target })).backups).toEqual([removed]);
      }),
    ),
  );

  it.live("opens a new mission from a card that sends the default backups, even when one names a removed account", () =>
    withService(
      Effect.gen(function* () {
        const settings = yield* call({ _tag: "ReadSettings" });
        const removed = {
          accountId: Schema.decodeSync(AccountId)("removed-account"),
          effort: "default",
          harness: "codex",
          model: "gpt-5",
        } as const;
        yield* call({ _tag: "UpdateSettings", settings: { ...settings, backups: [removed] } });
        const current = yield* start("Write the report");
        yield* settle(current.missionId, isIdle);
        yield* suggest(current.threadId, { missions: [], text: "context", title: "Read my emails" });
        const { suggestion } = yield* openSuggestion(current.missionId);
        yield* answer(suggestion, { _tag: "NewMission", backups: [removed], effort: "low", model: "haiku" });
        const original = yield* settle(
          current.missionId,
          (detail) => detail.suggestions[0]?.outcome === "MovedToMission",
        );
        const target = original.suggestions[0]?.targetThreadId;
        if (target == null) return yield* Effect.die("Missing new mission");
        expect((yield* call({ _tag: "ReadThreadPanel", threadId: target })).backups).toEqual([removed]);
      }),
    ),
  );

  it.live("opens no mission when a backup on the card names an account that does not exist", () =>
    withService(
      Effect.gen(function* () {
        const current = yield* start("Write the report");
        yield* settle(current.missionId, isIdle);
        yield* suggest(current.threadId, { missions: [], text: "context", title: "Read my emails" });
        const { suggestion } = yield* openSuggestion(current.missionId);
        const missing = {
          accountId: Schema.decodeSync(AccountId)("missing"),
          effort: "default",
          harness: "codex",
          model: "gpt-5",
        } as const;
        const refused = yield* Effect.flip(
          answer(suggestion, { _tag: "NewMission", backups: [missing], effort: "low", model: "haiku" }),
        );
        expect(refused.kind).toBe("InvalidInput");
        expect((yield* read(current.missionId)).suggestions[0]?.outcome).toBeNull();
        const listed = yield* call({
          _tag: "ListMissions",
          isArchived: false,
          search: null,
          state: null,
          workspaceId: null,
        });
        expect(listed.missions).toHaveLength(1);
      }),
    ),
  );
});
