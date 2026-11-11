import type { Consumption, GuildHallRecap, MissionSummary } from "@iskios/contracts";
import { describe, expect, it } from "vitest";
import { heroOf, hubOf, nowOf, recapOf } from "../../src/conversation/guildHall";

const mission = (id: string, more: Partial<MissionSummary> = {}) =>
  ({ id, lastActivityAt: 0, prompt: null, state: "Idle", title: id, ...more }) as unknown as MissionSummary;

describe("what the hub shows of the quests", () => {
  it("lists what waits for the owner: Attention, Failed, and a result to confirm, newest first", () => {
    const { waiting } = hubOf([
      mission("quiet"),
      mission("asked", { lastActivityAt: 10, state: "Attention" }),
      mission("broken", { lastActivityAt: 30, state: "Failed" }),
      mission("result", { lastActivityAt: 20, prompt: "MarkDone", state: "Idle" }),
      mission("stale", { lastActivityAt: 40, prompt: "Inactive", state: "Idle" }),
    ]);
    expect(waiting.map((row) => [row.mission.id, row.reason])).toEqual([
      ["broken", "Failed"],
      ["result", "Result to confirm"],
      ["asked", "Needs your answer"],
    ]);
  });

  it("lists the five quests touched last, newest first", () => {
    const { recent } = hubOf(Array.from({ length: 7 }, (_, index) => mission(`q${index}`, { lastActivityAt: index })));
    expect(recent.map((row) => row.id)).toEqual(["q6", "q5", "q4", "q3", "q2"]);
  });

  it("counts the quests underway", () => {
    expect(hubOf([mission("a", { state: "Running" }), mission("b", { state: "Running" }), mission("c")]).running).toBe(
      2,
    );
  });

  it("has nothing to list with no quest", () => {
    expect(hubOf([])).toEqual({ recent: [], running: 0, waiting: [] });
  });
});

const consumption = (more: Partial<Consumption> = {}): Consumption => ({
  earlierTurns: 0,
  estimated: 0,
  reported: 0,
  tokens: { cacheCreation: 0, cacheRead: 0, input: 0, output: 0 },
  turns: 0,
  unpricedTurns: 0,
  ...more,
});

const recap = (more: Partial<GuildHallRecap> = {}): GuildHallRecap => ({
  consumption: consumption(),
  finished: [],
  finishedCount: 0,
  isFirstVisit: false,
  ritualRuns: 0,
  since: 0,
  ...more,
});

describe("the recap in words", () => {
  it("names the period by the last visit, or by the last 24 hours at the first", () => {
    expect(recapOf(recap()).heading).toBe("Since your last visit");
    expect(recapOf(recap({ isFirstVisit: true })).heading).toBe("In the last 24 hours");
    expect(recapOf(recap()).finishedHeading).toBe("Finished since your last visit");
    expect(recapOf(recap({ isFirstVisit: true })).finishedHeading).toBe("Finished in the last 24 hours");
  });

  it("shows zero figures when nothing happened", () => {
    expect(recapOf(recap()).tiles).toEqual([
      { key: "finished", label: "quests finished", value: "0" },
      { key: "spent", label: "tokens used", value: "0" },
      { key: "rituals", label: "Ritual runs", value: "0" },
    ]);
  });

  it("shows finished quests, the cost marked as an estimate with the tokens beneath, and Ritual runs", () => {
    const { tiles } = recapOf(
      recap({
        consumption: consumption({
          estimated: 1.2,
          tokens: { cacheCreation: 0, cacheRead: 0, input: 9000, output: 3000 },
          turns: 4,
        }),
        finishedCount: 1,
        ritualRuns: 1,
      }),
    );
    expect(tiles).toEqual([
      { key: "finished", label: "quest finished", value: "1" },
      { key: "spent", label: "12,000 tokens", value: "≈ $1.20" },
      { key: "rituals", label: "Ritual run", value: "1" },
    ]);
  });

  it("shows tokens alone when no turn is priced", () => {
    const { tiles } = recapOf(
      recap({
        consumption: consumption({ tokens: { cacheCreation: 0, cacheRead: 0, input: 500, output: 100 }, turns: 1 }),
      }),
    );
    expect(tiles[1]).toEqual({ key: "spent", label: "tokens used", value: "600" });
  });
});

describe("the line over the hub", () => {
  it("counts the quests that wait", () => {
    expect(heroOf(0)).toBe("Nothing waits for you");
    expect(heroOf(1)).toBe("1 quest waits for you");
    expect(heroOf(3)).toBe("3 quests wait for you");
  });
});

describe("the band's figures about now", () => {
  it("counts the quests that wait and the quests underway", () => {
    expect(nowOf(2, 1)).toEqual([
      { key: "waiting", label: "waiting for you", value: "2" },
      { key: "running", label: "underway", value: "1" },
    ]);
  });
});
