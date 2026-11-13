import { AccountId, type Tier } from "@iskios/contracts";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { isSameBackups, isSamePresets, presetChangeOf, presetOf, presetsOf } from "../../src/editors/presets";

const codex = { accountId: null, effort: "default", harness: "codex", model: "gpt-5" } as const;

const tier = (
  model: string,
  effort: Tier["effort"] = "default",
  accountId: Tier["accountId"] = null,
  backups: Tier["backups"] = [],
): Tier => ({
  accountId,
  backups,
  effort,
  harness: "claude",
  model,
});

const tiers = (change: { Balanced?: Tier | null; Heavy?: Tier | null; Light?: Tier | null }) => ({
  Balanced: null,
  Heavy: null,
  Light: null,
  ...change,
});

describe("offering presets", () => {
  it("offers none when no tier is set, so the picker stays as it was", () => {
    expect(presetsOf(tiers({}))).toEqual([]);
  });

  it("offers each tier that is set, in the order Light, Balanced, Heavy, with its Companion", () => {
    const presets = presetsOf(tiers({ Balanced: tier("claude-sonnet-5-5"), Heavy: tier("claude-opus-5-5", "high") }));
    expect(presets.map((preset) => preset.name)).toEqual(["Balanced", "Heavy"]);
    expect(presets[1]?.runner).toEqual({
      accountId: null,
      effort: "high",
      harness: "claude",
      model: "claude-opus-5-5",
    });
  });

  it("carries the preset's backups, so choosing it puts the whole stack in place", () => {
    const [heavy] = presetsOf(tiers({ Heavy: tier("claude-opus-5-5", "high", null, [codex]) }));
    expect(heavy?.backups).toEqual([codex]);
    if (heavy === undefined) throw new Error("Missing Heavy preset");
    expect(presetChangeOf(heavy)).toEqual({
      accountId: null,
      backups: [codex],
      effort: "high",
      harness: "claude",
      model: "claude-opus-5-5",
    });
  });

  it("turns a preset with no backups into a change that clears them", () => {
    const [light] = presetsOf(tiers({ Light: tier("claude-haiku-5-5") }));
    if (light === undefined) throw new Error("Missing Light preset");
    expect(presetChangeOf(light).backups).toEqual([]);
  });
});

describe("marking the chosen preset", () => {
  it("marks a preset only when the complete ordered stack matches", () => {
    const other = { ...codex, model: "other" };
    const presets = presetsOf(tiers({ Heavy: tier("opus", "high", null, [codex, other]) }));
    const runner = tier("opus", "high");
    expect(presetOf(presets, { ...runner, backups: [codex, other] })?.name).toBe("Heavy");
    expect(presetOf(presets, { ...runner, backups: [other, codex] })).toBeNull();
    expect(presetOf(presets, { ...runner, backups: [] })).toBeNull();
  });

  it("marks the preset whose Companion, effort and account the thread has, and none for a custom one", () => {
    const presets = presetsOf(tiers({ Heavy: tier("claude-opus-5-5", "high") }));
    expect(presetOf(presets, tier("claude-opus-5-5", "high"))?.name).toBe("Heavy");
    expect(presetOf(presets, tier("claude-opus-5-5", "low"))).toBeNull();
    expect(presetOf(presets, tier("claude-opus-5-5", "high", Schema.decodeSync(AccountId)("account-2")))).toBeNull();
  });

  it("marks only the first when two presets are the same Companion", () => {
    const same = tier("claude-sonnet-5-5");
    expect(presetOf(presetsOf(tiers({ Balanced: same, Light: same })), same)?.name).toBe("Light");
  });
});

describe("comparing stacks for a redraw", () => {
  it("finds two backup lists the same only when they hold the same Companions in the same order", () => {
    const other = { ...codex, model: "other" };
    expect(isSameBackups([codex, other], [{ ...codex }, { ...other }])).toBe(true);
    expect(isSameBackups([codex, other], [other, codex])).toBe(false);
    expect(isSameBackups([], null)).toBe(false);
    expect(isSameBackups(null, undefined)).toBe(true);
  });

  it("finds two preset lists the same only when each preset holds the same whole stack", () => {
    const heavy = presetsOf(tiers({ Heavy: tier("opus", "high", null, [codex]) }));
    expect(isSamePresets(heavy, presetsOf(tiers({ Heavy: tier("opus", "high", null, [codex]) })))).toBe(true);
    expect(isSamePresets(heavy, presetsOf(tiers({ Heavy: tier("opus", "high", null, []) })))).toBe(false);
    expect(isSamePresets(heavy, undefined)).toBe(false);
    expect(isSamePresets(undefined, undefined)).toBe(true);
  });
});
