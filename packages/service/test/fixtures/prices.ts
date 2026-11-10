import { Effect, Layer } from "effect";
import { PriceReadFailed, type PriceRow, PriceSource } from "../../src/core/index.ts";

/** A stand-in for the public price table: it answers with the rows it was given, or fails, and counts its reads. */
export const fakePriceSource = (initial: ReadonlyArray<PriceRow>) => {
  const state = { isFailing: false, reads: 0, rows: initial };
  return {
    layer: Layer.succeed(PriceSource, {
      read: Effect.suspend(() => {
        state.reads += 1;
        return state.isFailing
          ? Effect.fail(new PriceReadFailed({ reason: "stand-in: the table cannot be read" }))
          : Effect.succeed(state.rows);
      }),
    }),
    state,
  };
};

/** Prices used by the checks: dollars per million tokens, as the public table gives them. */
export const testPrices: ReadonlyArray<PriceRow> = [
  { cacheRead: 0.3, cacheWrite: 3.75, input: 3, model: "test-model", output: 15, provider: "test" },
];
