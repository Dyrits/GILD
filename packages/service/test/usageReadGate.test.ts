import { describe, expect, it } from "@effect/vitest";
import { afterFailure, afterRead, type GateState, isReadDue, noReadYet } from "../src/work/usageReadGate.ts";

const minute = 60_000;

describe("pacing the reads of a plan's usage", () => {
  it("allows the first read at once", () => {
    expect(isReadDue(noReadYet, 0)).toBe(true);
  });

  it("lets a reading stand for four minutes", () => {
    const state = afterRead(noReadYet, 1_000);
    expect(isReadDue(state, 1_000 + 4 * minute - 1)).toBe(false);
    expect(isReadDue(state, 1_000 + 4 * minute)).toBe(true);
  });

  it("waits 5, then 10, 20, and 40 minutes after failures, and no more than an hour", () => {
    let state: GateState = noReadYet;
    const waits: Array<number> = [];
    for (let failure = 0; failure < 6; failure++) {
      state = afterFailure(state, 0);
      waits.push(state.retryAt / minute);
    }
    expect(waits).toEqual([5, 10, 20, 40, 60, 60]);
  });

  it("starts over after a successful read", () => {
    const failed = afterFailure(afterFailure(noReadYet, 0), 0);
    expect(afterRead(failed, 50 * minute)).toEqual(afterRead(noReadYet, 50 * minute));
  });

  it("does not read during the wait after a failure, though a reading is old", () => {
    const state = afterFailure(afterRead(noReadYet, 0), 10 * minute);
    expect(isReadDue(state, 10 * minute + 4 * minute)).toBe(false);
    expect(isReadDue(state, 10 * minute + 5 * minute)).toBe(true);
  });
});
