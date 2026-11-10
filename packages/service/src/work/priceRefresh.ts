import { Effect, Layer, Schedule } from "effect";
import { PriceTable } from "../core/index.ts";

/**
 * Reads the public price table at startup and then daily, while the Charter's Fetch prices switch is on; a failed
 * read keeps the table as it was and tries again at the next time (budget-control, The price table).
 */
export const priceRefreshLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const prices = yield* PriceTable;
    const refresh = prices.refresh.pipe(Effect.ignore);
    yield* Effect.forkScoped(refresh.pipe(Effect.repeat(Schedule.spaced("1 day"))));
  }),
);
