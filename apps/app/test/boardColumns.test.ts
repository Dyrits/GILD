import { describe, expect, it } from "vitest";
import { boardColumns, boardOf, isStateShownOn, splitEarlier, trimmedColumns } from "../src/boardColumns";

describe("laying missions out on the board", () => {
  it("puts failed missions with those in Attention, since both need the owner", () => {
    const board = boardOf([
      { id: "a", state: "Attention" },
      { id: "f", state: "Failed" },
    ] as const);
    expect(board.Attention.map((mission) => mission.id)).toEqual(["a", "f"]);
  });

  it("keeps waiting missions under Running, in their order, since a thread beneath is at work", () => {
    const board = boardOf([
      { id: "w", state: "Waiting" },
      { id: "r", state: "Running" },
    ] as const);
    expect(board.Running.map((mission) => mission.id)).toEqual(["w", "r"]);
    expect(board.Attention).toEqual([]);
  });

  it("puts idle missions in their own column, apart from those at work", () => {
    const board = boardOf([
      { id: "r", state: "Running" },
      { id: "i", state: "Idle" },
    ] as const);
    expect(board.Idle.map((mission) => mission.id)).toEqual(["i"]);
    expect(board.Running.map((mission) => mission.id)).toEqual(["r"]);
  });

  it("orders the columns by what needs the owner first, idle before done", () => {
    expect(boardColumns).toEqual(["Attention", "Running", "Idle", "Done"]);
  });

  it("puts done missions in the last column", () => {
    expect(boardOf([{ id: "d", state: "Done" }] as const).Done.map((mission) => mission.id)).toEqual(["d"]);
  });

  it("names a card's state only when it differs from its column", () => {
    expect(isStateShownOn("Running", "Running")).toBe(false);
    expect(isStateShownOn("Idle", "Idle")).toBe(false);
    expect(isStateShownOn("Running", "Waiting")).toBe(true);
    expect(isStateShownOn("Attention", "Failed")).toBe(true);
  });
});

describe("folding earlier missions away", () => {
  const noon = new Date(2026, 10, 9, 12).getTime();
  const at = (id: string, hour: number, day = 9) => ({ id, lastActivityAt: new Date(2026, 10, day, hour).getTime() });

  it("trims only the columns that grow without end", () => {
    expect(trimmedColumns).toEqual(["Idle", "Done"]);
  });

  it("shows the missions active today and folds the others, keeping their order", () => {
    const { earlier, shown } = splitEarlier([at("a", 9), at("b", 23, 8), at("c", 0), at("d", 11, 1)], noon, null);
    expect(shown.map((mission) => mission.id)).toEqual(["a", "c"]);
    expect(earlier.map((mission) => mission.id)).toEqual(["b", "d"]);
  });

  it("keeps the mission whose panel is open on view, even if it is earlier", () => {
    const { earlier, shown } = splitEarlier([at("a", 9), at("b", 23, 8)], noon, "b");
    expect(shown.map((mission) => mission.id)).toEqual(["a", "b"]);
    expect(earlier).toEqual([]);
  });
});
