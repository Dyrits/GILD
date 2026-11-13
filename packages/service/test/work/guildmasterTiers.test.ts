import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { approvedCall, guildmaster, isIdle, lastAgentText, listed, say, startIdle } from "../fixtures/guildmaster.ts";
import { call, read, settle, withService } from "../fixtures/service.ts";

describe("choosing tiers and budgets for Iskios", () => {
  const withTiers = Effect.gen(function* () {
    const settings = yield* call({ _tag: "ReadSettings" });
    yield* call({
      _tag: "UpdateSettings",
      settings: {
        ...settings,
        defaultHarness: "claude",
        defaultModel: "claude-sonnet-5-5",
        tiers: {
          Balanced: { accountId: null, backups: [], effort: "medium", harness: "codex", model: "gpt-6.1-terra" },
          Heavy: { accountId: null, backups: [], effort: "high", harness: "claude", model: "claude-opus-5-5" },
          Light: null,
        },
      },
    });
  });

  it.live("starts on the cheapest model Iskios knows and with no budget of the quests' default", () =>
    withService(
      Effect.gen(function* () {
        const settings = yield* call({ _tag: "ReadSettings" });
        yield* call({
          _tag: "UpdateSettings",
          settings: { ...settings, defaultMissionBudget: { cost: null, tokens: 5000 } },
        });
        const place = yield* guildmaster;
        const detail = yield* read(place.missionId, place.threadId);
        expect(detail.thread).toMatchObject({ harness: "claude", model: "claude-haiku-5-5" });
        expect(detail.mission.budget.limits).toEqual({ cost: null, tokens: null });
      }),
    ),
  );

  it.live("proposes a new quest on the Companion of the tier it picks, and the default when no tier fits", () =>
    withService(
      Effect.gen(function* () {
        yield* withTiers;
        const place = yield* guildmaster;
        yield* say(
          place.threadId,
          `call suggest_mission ${JSON.stringify({ text: "Ordinary job", tier: "Balanced", title: "Ordinary" })}`,
        );
        const waiting = yield* settle(
          place.missionId,
          (detail) => detail.suggestions.some((suggestion) => suggestion.outcome === null),
          place.threadId,
        );
        expect(waiting.suggestions.find((suggestion) => suggestion.outcome === null)).toMatchObject({
          harness: "codex",
          model: "gpt-6.1-terra",
        });
        expect((yield* listed).missions).toHaveLength(0);
      }),
    ),
  );

  it.live("lets the owner's default stand when no tier is set, never the Guildmaster's cheap model", () =>
    withService(
      Effect.gen(function* () {
        const settings = yield* call({ _tag: "ReadSettings" });
        yield* call({ _tag: "UpdateSettings", settings: { ...settings, defaultModel: "claude-sonnet-5-5" } });
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
        expect(waiting.suggestions.find((suggestion) => suggestion.outcome === null)).toMatchObject({
          harness: "claude",
          model: "claude-sonnet-5-5",
        });
      }),
    ),
  );

  it.live("makes a Ritual on a tier, and offers a new quest on the tier it chose", () =>
    withService(
      Effect.gen(function* () {
        yield* withTiers;
        const place = yield* guildmaster;
        yield* approvedCall(place, "create_ritual", {
          instruction: "Check it",
          schedule: { _tag: "Daily", time: "07:00" },
          tier: "Heavy",
          title: "Heavy check",
        });
        expect((yield* call({ _tag: "ListRituals" }))[0]?.primary).toMatchObject({
          harness: "claude",
          model: "claude-opus-5-5",
        });
        const existing = yield* startIdle("Fix the billing total, ticket PAY-9");
        const args = { missions: [existing.missionId], text: "PAY-9 again", tier: "Balanced", title: "Again" };
        yield* say(place.threadId, `call suggest_mission ${JSON.stringify(args)}`);
        const waiting = yield* settle(
          place.missionId,
          (detail) => detail.suggestions.some((suggestion) => suggestion.outcome === null),
          place.threadId,
        );
        expect(waiting.suggestions.find((suggestion) => suggestion.outcome === null)).toMatchObject({
          harness: "codex",
          model: "gpt-6.1-terra",
        });
      }),
    ),
  );

  it.live("starts its turn knowing the tiers, or that none are set", () =>
    withService(
      Effect.gen(function* () {
        const place = yield* guildmaster;
        yield* say(place.threadId, "context");
        const none = yield* settle(
          place.missionId,
          (detail) => lastAgentText(detail).includes("# Tiers"),
          place.threadId,
        );
        expect(lastAgentText(none)).toContain("None set");
        yield* withTiers;
        yield* settle(place.missionId, isIdle, place.threadId);
        yield* say(place.threadId, "context");
        const set = yield* settle(
          place.missionId,
          (detail) => lastAgentText(detail).includes("- Heavy: claude"),
          place.threadId,
        );
        expect(lastAgentText(set)).toContain("- Balanced: codex, model gpt-6.1-terra, effort medium");
      }),
    ),
  );

  it.live("can be given a budget of its own, which stops its turns when reached", () =>
    withService(
      Effect.gen(function* () {
        const place = yield* guildmaster;
        yield* call({ _tag: "SetMissionBudget", limits: { cost: null, tokens: 100 }, missionId: place.missionId });
        const detail = yield* read(place.missionId, place.threadId);
        expect(detail.mission.budget.limits).toEqual({ cost: null, tokens: 100 });
        yield* say(place.threadId, "spend 500");
        const stopped = yield* settle(place.missionId, (detail) => detail.budgetStop !== null, place.threadId);
        expect(stopped.budgetStop).not.toBeNull();
      }),
    ),
  );
});
