import { describe, expect, it } from "vitest";
import { boardOf, isStateShownOn } from "../src/boardColumns";

describe("laying missions out on the board", () => {
  it("puts failed missions with those in Attention, since both need the owner", () => {
    const board = boardOf([
      { id: "a", state: "Attention" },
      { id: "f", state: "Failed" },
    ] as const);
    expect(board.Attention.map((mission) => mission.id)).toEqual(["a", "f"]);
  });

  it("keeps waiting and idle missions under Running, in their order", () => {
    const board = boardOf([
      { id: "w", state: "Waiting" },
      { id: "r", state: "Running" },
      { id: "i", state: "Idle" },
    ] as const);
    expect(board.Running.map((mission) => mission.id)).toEqual(["w", "r", "i"]);
    expect(board.Attention).toEqual([]);
  });

  it("puts done missions in the last column", () => {
    expect(boardOf([{ id: "d", state: "Done" }] as const).Done.map((mission) => mission.id)).toEqual(["d"]);
  });

  it("names a card's state only when it differs from its column", () => {
    expect(isStateShownOn("Running", "Running")).toBe(false);
    expect(isStateShownOn("Running", "Waiting")).toBe(true);
    expect(isStateShownOn("Attention", "Failed")).toBe(true);
  });
});
