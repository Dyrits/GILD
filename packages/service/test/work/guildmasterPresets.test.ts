import { describe, expect, it } from "@effect/vitest";
import type { BackupCompanion, MissionId, ThreadId } from "@iskios/contracts";
import { Effect } from "effect";
import { guildmaster, isIdle, say } from "../fixtures/guildmaster.ts";
import { call, settle, withService } from "../fixtures/service.ts";

type Place = { missionId: MissionId; threadId: ThreadId };

/** Waits until Iskios is idle or asks the owner a question, and returns its detail. */
const waitOn = (place: Place) =>
  settle(
    place.missionId,
    (detail) => isIdle(detail) || detail.questions.some((question) => question.outcome === null),
    place.threadId,
  );

const codex: BackupCompanion = { accountId: null, effort: "default", harness: "codex", model: "gpt-5" };

/** Sets Heavy to the given Companion with one backup. */
const setHeavy = (primary: { effort: string; harness: "claude" | "codex" | "opencode"; model: string }) =>
  Effect.gen(function* () {
    yield* call({
      _tag: "ChangeSettings",
      change: { tiers: { Heavy: { ...primary, accountId: null, backups: [codex] } } },
    });
  });

describe("proposing quests and creating Rituals on presets", () => {
  it.live("offers the preset's whole stack on its card even when its primary equals the default", () =>
    withService(
      Effect.gen(function* () {
        const settings = yield* call({ _tag: "ReadSettings" });
        yield* setHeavy({
          effort: settings.defaultEffort,
          harness: settings.defaultHarness,
          model: settings.defaultModel,
        });
        const place = yield* guildmaster;
        yield* say(
          place.threadId,
          `call suggest_mission ${JSON.stringify({ text: "Job", tier: "Heavy", title: "Job" })}`,
        );
        const waiting = yield* settle(
          place.missionId,
          (detail) => detail.suggestions.some((suggestion) => suggestion.outcome === null),
          place.threadId,
        );
        const card = waiting.suggestions.find((suggestion) => suggestion.outcome === null);
        expect(card).toMatchObject({ backups: [codex], model: settings.defaultModel });
      }),
    ),
  );

  it.live("makes a Ritual on a preset with the preset's backups as its fallbacks", () =>
    withService(
      Effect.gen(function* () {
        yield* setHeavy({ effort: "high", harness: "claude", model: "claude-opus-5-5" });
        const place = yield* guildmaster;
        const ritual = {
          instruction: "Check it",
          schedule: { _tag: "Hourly", hours: 1 },
          tier: "Heavy",
          title: "Heavy check",
        };
        yield* say(place.threadId, `call create_ritual ${JSON.stringify(ritual)}`);
        const asked = yield* waitOn(place);
        const question = asked.questions.find((candidate) => candidate.outcome === null);
        if (question === undefined) return yield* Effect.die("No confirmation");
        yield* call({ _tag: "AnswerQuestion", answer: "Allow", message: null, questionId: question.id });
        yield* settle(place.missionId, isIdle, place.threadId);
        expect((yield* call({ _tag: "ListRituals" }))[0]?.fallbacks).toEqual([codex]);
      }),
    ),
  );

  it.live("tells the owner in its question when a Ritual on a preset brings fallback Companions", () =>
    withService(
      Effect.gen(function* () {
        yield* setHeavy({ effort: "high", harness: "claude", model: "claude-opus-5-5" });
        const place = yield* guildmaster;
        const ritual = {
          instruction: "Check it",
          schedule: { _tag: "Hourly", hours: 1 },
          tier: "Heavy",
          title: "Heavy check",
        };
        yield* say(place.threadId, `call create_ritual ${JSON.stringify(ritual)}`);
        const asked = yield* waitOn(place);
        expect(asked.questions.find((question) => question.outcome === null)?.summary).toContain(
          "with 1 fallback from Heavy",
        );
      }),
    ),
  );

  it.live("gives a Ritual no fallbacks when Iskios names a Companion of its own", () =>
    withService(
      Effect.gen(function* () {
        yield* setHeavy({ effort: "high", harness: "claude", model: "claude-opus-5-5" });
        const place = yield* guildmaster;
        const ritual = {
          effort: "low",
          instruction: "Check it",
          schedule: { _tag: "Hourly", hours: 1 },
          tier: "Heavy",
          title: "Heavy check",
        };
        yield* say(place.threadId, `call create_ritual ${JSON.stringify(ritual)}`);
        const asked = yield* waitOn(place);
        expect(asked.questions.find((question) => question.outcome === null)?.summary).not.toContain("fallback");
      }),
    ),
  );
});
