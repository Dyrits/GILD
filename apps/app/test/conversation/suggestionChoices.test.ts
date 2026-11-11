import type { Tier } from "@iskios/contracts";
import { describe, expect, it } from "vitest";
import { companionChoicesOf, hasTiers, selectedChoiceOf } from "../../src/conversation/suggestionChoices";

const tier = (model: string, effort: Tier["effort"] = "default"): Tier => ({
  accountId: null,
  effort,
  harness: "claude",
  model,
});

const settings = (tiers: { Balanced?: Tier | null; Heavy?: Tier | null; Light?: Tier | null }) => ({
  defaultEffort: "default" as const,
  defaultHarness: "claude" as const,
  defaultModel: "claude-sonnet-5-5",
  tiers: { Balanced: null, Heavy: null, Light: null, ...tiers },
});

const label = (runner: { model: string }) => runner.model;

describe("the Companions a proposal card offers", () => {
  it("offers only the default when no tier is set", () => {
    const choices = companionChoicesOf(settings({}), label);
    expect(choices.map((choice) => choice.label)).toEqual(["Default"]);
    expect(hasTiers(choices)).toBe(false);
  });

  it("offers the default, then each tier that is set, in the order Light, Balanced, Heavy", () => {
    const choices = companionChoicesOf(
      settings({ Balanced: tier("claude-sonnet-5-5"), Heavy: tier("claude-opus-5-5", "high"), Light: null }),
      label,
    );
    expect(choices.map((choice) => choice.label)).toEqual([
      "Default",
      "Balanced · claude-sonnet-5-5",
      "Heavy · claude-opus-5-5",
    ]);
    expect(hasTiers(choices)).toBe(true);
  });

  it("selects the one choice whose Companion the card holds", () => {
    const choices = companionChoicesOf(settings({ Heavy: tier("claude-opus-5-5", "high") }), label);
    expect(selectedChoiceOf(choices, tier("claude-opus-5-5", "high"))?.label).toBe("Heavy · claude-opus-5-5");
  });

  it("selects only the first when a tier is the same Companion as the default", () => {
    const choices = companionChoicesOf(settings({ Balanced: tier("claude-sonnet-5-5") }), label);
    expect(selectedChoiceOf(choices, tier("claude-sonnet-5-5"))?.label).toBe("Default");
  });

  it("selects none for a Companion the owner customized", () => {
    const choices = companionChoicesOf(settings({ Light: tier("claude-haiku-5-5") }), label);
    expect(selectedChoiceOf(choices, tier("some-other-model"))).toBeNull();
  });
});
