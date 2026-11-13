import { describe, expect, it } from "vitest";
import { detailsModeOf } from "../../src/shell/navigation";

const view = { hasListedRealm: false, openMission: null, place: "Guildmaster" as const, selectedMission: null };

describe("the side panel's mode", () => {
  it("is pinned on the quest board", () => {
    expect(detailsModeOf({ ...view, place: "Quests" })).toBe("pinned");
  });
  it("is a toggle when a quest is open, even from the quests place", () => {
    expect(detailsModeOf({ ...view, openMission: "m", place: "Quests" })).toBe("toggle");
    expect(detailsModeOf({ ...view, openMission: "m" })).toBe("toggle");
  });
  it("is a toggle when a quest is chosen without opening it", () => {
    expect(detailsModeOf({ ...view, selectedMission: "m" })).toBe("toggle");
  });
  it("is a toggle on a listed realm's page only", () => {
    expect(detailsModeOf({ ...view, hasListedRealm: true, place: "RealmQuests" })).toBe("toggle");
    expect(detailsModeOf({ ...view, place: "RealmQuests" })).toBe("none");
  });
  it("is none elsewhere", () => {
    expect(detailsModeOf(view)).toBe("none");
  });
});
