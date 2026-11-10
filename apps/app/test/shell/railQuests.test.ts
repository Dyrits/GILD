import type { MissionId, MissionSummary } from "@gild/contracts";
import { describe, expect, it } from "vitest";
import { railQuestsOf } from "../../src/shell/railQuests";

const quest = (id: string, state: MissionSummary["state"]) => ({ id, state }) as MissionSummary;
const quests = [
  quest("running", "Running"),
  quest("done", "Done"),
  quest("idle", "Idle"),
  quest("attention", "Attention"),
];
const ids = (list: ReadonlyArray<MissionSummary>) => list.map((each) => each.id);

describe("the quests the rail lists", () => {
  it("leaves out finished quests by default", () => {
    expect(ids(railQuestsOf(quests, { openMission: null, shouldShowFinished: false }))).toEqual([
      "running",
      "idle",
      "attention",
    ]);
  });
  it("lists them when the Charter says so", () => {
    expect(ids(railQuestsOf(quests, { openMission: null, shouldShowFinished: true }))).toEqual([
      "running",
      "done",
      "idle",
      "attention",
    ]);
  });
  it("keeps a finished quest that is open, so the rail shows where the owner is", () => {
    expect(ids(railQuestsOf(quests, { openMission: "done" as MissionId, shouldShowFinished: false }))).toContain(
      "done",
    );
  });
});
