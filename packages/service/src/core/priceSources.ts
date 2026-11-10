import { Effect, Layer } from "effect";
import { PriceReadFailed, type PriceRow, PriceSource, priceProviders } from "./prices.ts";
import { fieldOf, numberFieldOf } from "./records.ts";

// Where the price table is read from (decision record 0014): models.dev, as a plain GET.

/** The public table's address. */
export const modelsDevUrl = "https://models.dev/api.json";

/** A price in the table, or null when the model carries none or an unreadable one. */
const rowOf = (provider: string, model: string, entry: unknown): PriceRow | null => {
  const cost = fieldOf(entry, "cost");
  if (typeof fieldOf(cost, "input") !== "number" || typeof fieldOf(cost, "output") !== "number") return null;
  const cacheRead = fieldOf(cost, "cache_read");
  const cacheWrite = fieldOf(cost, "cache_write");
  return {
    cacheRead: typeof cacheRead === "number" ? cacheRead : null,
    cacheWrite: typeof cacheWrite === "number" ? cacheWrite : null,
    input: numberFieldOf(cost, "input"),
    model,
    output: numberFieldOf(cost, "output"),
    provider,
  };
};

/** The prices of the providers the table keeps, from the public table's JSON; models without a price are left out. */
export const rowsOfModelsDev = (table: unknown): ReadonlyArray<PriceRow> =>
  priceProviders.flatMap((provider) => {
    const models = fieldOf(fieldOf(table, provider), "models");
    if (typeof models !== "object" || models === null) return [];
    return Object.entries(models).flatMap(([model, entry]) => {
      const row = rowOf(provider, model, entry);
      return row === null ? [] : [row];
    });
  });

/**
 * Reads models.dev with the given `fetch`. The request carries nothing about the owner: no body, no cookies, and
 * no header beyond the kind of answer wanted (requirements, Price table read carries no owner data).
 */
export const modelsDevSourceLayer = (fetchImpl: typeof fetch = fetch) =>
  Layer.succeed(PriceSource, {
    read: Effect.tryPromise({
      catch: (error) => new PriceReadFailed({ reason: `Could not read the price table: ${String(error)}` }),
      try: async () => {
        const response = await fetchImpl(modelsDevUrl, {
          headers: { accept: "application/json" },
          method: "GET",
          signal: AbortSignal.timeout(20_000),
        });
        if (!response.ok) throw new Error(`models.dev answered ${response.status}`);
        return rowsOfModelsDev(await response.json());
      },
    }),
  });

/** A source that has no table to give, for a service that never reads the public one (the fake harness's own runs). */
export const noPriceSourceLayer = Layer.succeed(PriceSource, {
  read: Effect.fail(new PriceReadFailed({ reason: "No price table source is configured." })),
});
