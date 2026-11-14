import { type Tier, type WorkspaceChoice, WorkspaceId } from "@iskios/contracts";
import { describe, expect, it } from "vitest";
import {
  companionChoicesOf,
  hasTiers,
  realmOptionsOf,
  selectedChoiceOf,
} from "../../src/conversation/suggestionChoices";

const tier = (model: string, effort: Tier["effort"] = "default"): Tier => ({
  accountId: null,
  backups: [],
  effort,
  harness: "claude",
  model,
});

const settings = (tiers: { Balanced?: Tier | null; Heavy?: Tier | null; Light?: Tier | null }) => ({
  backups: [],
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

  it("distinguishes a tier from Default by its backups even with the same primary", () => {
    const heavy = {
      ...tier("claude-sonnet-5-5"),
      backups: [tier("claude-opus-5-5", "high")],
    };
    const choices = companionChoicesOf(settings({ Heavy: heavy }), label);
    expect(selectedChoiceOf(choices, heavy)?.label).toBe("Heavy · claude-sonnet-5-5");
    expect(choices[1]?.runner.backups).toEqual(heavy.backups);
    expect(choices[0]?.runner.backups).toEqual([]);
  });

  it("selects none for a Companion the owner customized", () => {
    const choices = companionChoicesOf(settings({ Light: tier("claude-haiku-5-5") }), label);
    expect(selectedChoiceOf(choices, tier("some-other-model"))).toBeNull();
  });
});

describe("offering realms on a quest proposal", () => {
  const realm = (id: string, name: string, path: string | null) =>
    ({ crest: null, id: WorkspaceId.make(id), name, path }) satisfies WorkspaceChoice;

  it("tells two realms of the same name apart by their parent folder, keeping each one's folder", () => {
    const options = realmOptionsOf([realm("b", "app", "/client-b/app"), realm("a", "app", "/client-a/app")]);
    expect(options.map((option) => option.label)).toEqual(["app · client-a", "app · client-b"]);
    expect(options.map((option) => option.path)).toEqual(["/client-a/app", "/client-b/app"]);
  });

  it("keeps a unique name as it is and leaves out a realm tied to no folder", () => {
    const options = realmOptionsOf([realm("g", "Garden", "/home/garden"), realm("n", "Notes", null)]);
    expect(options).toEqual([{ id: "g", label: "Garden", path: "/home/garden" }]);
  });
});
