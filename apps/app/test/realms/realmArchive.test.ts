import { MissionId } from "@iskios/contracts";
import { describe, expect, it } from "vitest";
import { archiveLabelOf, matchingArchivedRealmsOf, retainedArchiveChoicesOf } from "../../src/realms/realmArchive";

describe("reviewing realm archive choices", () => {
  it("drops removed and working quests while keeping eligible selected quests", () => {
    const kept = MissionId.make("kept");
    const working = MissionId.make("working");
    const removed = MissionId.make("removed");
    const selected = new Set([kept, working, removed]);
    expect(
      retainedArchiveChoicesOf(selected, [
        { id: kept, isWorking: false },
        { id: working, isWorking: true },
        { id: MissionId.make("not-selected"), isWorking: false },
      ]),
    ).toEqual(new Set([kept]));
    expect(selected).toEqual(new Set([kept, working, removed]));
    expect(retainedArchiveChoicesOf(selected, [])).toEqual(new Set());
  });

  it("names the stop and move effects on the confirming button", () => {
    expect(archiveLabelOf(0, 0)).toBe("Archive realm");
    expect(archiveLabelOf(1, 0)).toBe("Stop and archive realm");
    expect(archiveLabelOf(0, 2)).toBe("Archive realm, move 2");
    expect(archiveLabelOf(3, 2)).toBe("Stop and archive realm, move 2");
  });
});

describe("searching archived realms", () => {
  it("ignores search case and surrounding whitespace without changing records", () => {
    const garden = { realm: { name: "Garden" }, snapshot: "garden" };
    const records = [garden, { realm: { name: "Workshop" }, snapshot: "workshop" }];
    expect(matchingArchivedRealmsOf(records, "  ARD  ")).toEqual([garden]);
    expect(matchingArchivedRealmsOf(records, " ")).toEqual(records);
    expect(matchingArchivedRealmsOf(records, "missing")).toEqual([]);
  });
});
