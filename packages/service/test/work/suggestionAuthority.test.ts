import { describe, expect, it } from "@effect/vitest";
import type { MissionDetail, MissionId, Question, RitualCompanion } from "@iskios/contracts";
import { Effect } from "effect";
import { guildmaster, isIdle, listed } from "../fixtures/guildmaster.ts";
import { call, read, send, settle, start, withService } from "../fixtures/service.ts";

// mission-coordination, External contract: text another thread wrote is never the owner's words. A suggestion the owner
// continues in a quest is routed there by the owner, but its words stay the agent's, so it grants no structural
// authority to the Ritual that receives it (audit SA-06).

const claude: RitualCompanion = { accountId: null, effort: "default", harness: "claude", model: "claude-sonnet-5-5" };
const openOf = (detail: MissionDetail) => detail.questions.filter((question) => question.outcome === null);
const archiveScriptOf = (missionId: MissionId) =>
  `Archive Old notes.\ncall act_on_mission ${JSON.stringify({ action: "Archive", mission: missionId })}`;

/** A resting quest named "Old notes" for the Ritual to act on. */
const restingQuest = Effect.gen(function* () {
  const quest = yield* start("Hello");
  yield* settle(quest.missionId, isIdle);
  yield* call({ _tag: "RenameMission", missionId: quest.missionId, title: "Old notes" });
  return quest;
});

/** Creates a Ritual with an empty reviewed scope, whose quest rests until a message reaches it. */
const createEmptyScopeRitual = Effect.suspend(() =>
  call({
    _tag: "CreateRitual",
    fallbacks: [],
    instruction: "Hello",
    primary: claude,
    requestId: crypto.randomUUID(),
    schedule: { _tag: "Daily", time: "07:00" },
    scope: [],
    title: "Housekeeping",
    workspacePath: null,
  }),
);

const deny = (question: Question | undefined) =>
  question === undefined
    ? Effect.die("No question")
    : call({ _tag: "AnswerQuestion", answer: "Deny", message: null, questionId: question.id });

/** Has a new quest suggest the text for the target quest, and continues it there as the owner; returns the suggester. */
const continueSuggestion = Effect.fnUntraced(function* (targetMissionId: MissionId, text: string) {
  const suggester = yield* start("Write the report");
  yield* settle(suggester.missionId, isIdle);
  const args = { missions: [targetMissionId], text, title: "Tidy up" };
  yield* send(suggester.threadId, `call suggest_mission ${JSON.stringify(args)}`);
  const offered = yield* settle(suggester.missionId, (detail) =>
    detail.suggestions.some((pending) => pending.outcome === null),
  );
  const suggestion = offered.suggestions.find((pending) => pending.outcome === null);
  if (suggestion === undefined) return yield* Effect.die("No suggestion");
  yield* call({
    _tag: "AnswerSuggestion",
    answer: { _tag: "Continue", missionId: targetMissionId },
    suggestionId: suggestion.id,
  });
  return suggester;
});

describe("keeping a continued suggestion's words from authorizing a Ritual's structural action", () => {
  it.live(
    "asks before the Ritual archives a quest on agent-written words the owner only routed, and Deny keeps it",
    () =>
      withService(
        Effect.gen(function* () {
          const quest = yield* restingQuest;
          const ritual = yield* createEmptyScopeRitual;
          yield* continueSuggestion(ritual.missionId, archiveScriptOf(quest.missionId));
          const asked = yield* settle(ritual.missionId, (detail) => detail.questions.length > 0);
          expect(openOf(asked)[0]?.summary).toBe('Archive the quest "Old notes".');
          expect((yield* read(quest.missionId)).mission.state).not.toBe("Archived");
          yield* deny(openOf(asked)[0]);
          yield* settle(ritual.missionId, (detail) => isIdle(detail) && openOf(detail).length === 0);
          expect((yield* read(quest.missionId)).mission.state).not.toBe("Archived");
        }),
      ),
  );

  it.live("still asks once the quest that wrote the suggestion is deleted before its text runs", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* restingQuest;
        const ritual = yield* createEmptyScopeRitual;
        const settings = yield* call({ _tag: "ReadSettings" });
        yield* call({ _tag: "UpdateSettings", settings: { ...settings, defaultDelivery: "Queue" } });
        yield* send(ritual.threadId, "wait 600");
        yield* settle(ritual.missionId, (detail) => detail.thread.state === "Running");
        const suggester = yield* continueSuggestion(ritual.missionId, archiveScriptOf(quest.missionId));
        yield* settle(suggester.missionId, isIdle);
        const preview = yield* call({ _tag: "PreviewDeletion", threadId: suggester.threadId });
        yield* call({ _tag: "DeleteThread", confirmation: preview.confirmation, threadId: suggester.threadId });
        // The continued text still waits behind the running turn, so it runs only after its writer is gone.
        expect((yield* read(ritual.missionId)).thread.state).toBe("Running");
        const asked = yield* settle(ritual.missionId, (detail) => detail.questions.length > 0);
        expect(openOf(asked)[0]?.summary).toBe('Archive the quest "Old notes".');
        yield* deny(openOf(asked)[0]);
        yield* settle(ritual.missionId, (detail) => isIdle(detail) && openOf(detail).length === 0);
        expect((yield* read(quest.missionId)).mission.state).not.toBe("Archived");
      }),
    ),
  );

  it.live("still takes the owner's own message naming the action as authority", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* restingQuest;
        const ritual = yield* createEmptyScopeRitual;
        yield* send(ritual.threadId, archiveScriptOf(quest.missionId));
        const done = yield* settle(ritual.missionId, (detail) => detail.questions.length > 0 && isIdle(detail));
        expect(done.questions[0]).toMatchObject({
          outcome: "AllowedByMessage",
          summary: 'Archive the quest "Old notes".',
        });
        expect((yield* read(quest.missionId)).mission.state).toBe("Archived");
      }),
    ),
  );

  it.live("asks before Iskios creates a realm on a suggestion continued into it", () =>
    withService(
      Effect.gen(function* () {
        const place = yield* guildmaster;
        yield* continueSuggestion(place.missionId, `Create the realm Ideas.\ncall create_realm {"name":"Ideas"}`);
        const asked = yield* settle(
          place.missionId,
          (detail) => detail.questions.length > 0 || detail.messages.some((message) => message.sender === "agent"),
          place.threadId,
        );
        expect(openOf(asked)[0]?.summary).toBe('Make the realm "Ideas", tied to no folder.');
        yield* deny(openOf(asked)[0]);
        yield* settle(place.missionId, (detail) => isIdle(detail) && openOf(detail).length === 0, place.threadId);
        expect((yield* listed).workspaces).toHaveLength(0);
      }),
    ),
  );
});
