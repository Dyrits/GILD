import type { MissionId } from "@iskios/contracts";
import { describe, expect, it } from "vitest";
import { viewingOf } from "../../src/shell/viewing";

describe("where Iskios is told the owner is", () => {
  it("names the quest that is open, whatever the place", () => {
    const id = "q1" as MissionId;
    expect(viewingOf("Guildmaster", id, null)).toEqual({ missionId: id, screen: "Quest" });
    expect(viewingOf("Settings", id, null)).toEqual({ missionId: id, screen: "Quest" });
  });

  it("names the screen otherwise, as the owner knows it", () => {
    expect(viewingOf("Guildmaster", null, null)).toEqual({ screen: "Guild Hall" });
    expect(viewingOf("Settings", null, null)).toEqual({ screen: "Settings" });
    expect(viewingOf("Archived", null, null)).toEqual({ screen: "Archive" });
  });

  it("names the realm whose quests are listed", () => {
    expect(viewingOf("RealmQuests", null, "Shop")).toEqual({ screen: "Quests of Shop" });
    expect(viewingOf("RealmQuests", null, null)).toEqual({ screen: "Realm quests" });
  });

  it("does not attach the hidden quest or realm when Iskios fills the panel", () => {
    expect(viewingOf("RealmQuests", "q1" as MissionId, "Shop", true)).toEqual({ screen: "Iskios" });
  });
});
