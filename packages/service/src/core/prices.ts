import type { PriceStatus, TokenUsage } from "@iskios/contracts";
import { Clock, Context, Effect, Layer, Ref, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { snapshotAt, snapshotPrices } from "./priceSnapshot.ts";
import { readSettings } from "./settings.ts";

// The model price table behind estimated costs (budget-control, The price table; decision record 0014): read from the
// public table, kept in the service's database, with a snapshot shipped with Iskios as the fallback.

/** A model's price in dollars per million tokens, by token kind; a null cache price is billed as input. */
export interface PriceRow {
  readonly cacheRead: number | null;
  readonly cacheWrite: number | null;
  readonly input: number;
  readonly model: string;
  readonly output: number;
  readonly provider: string;
}

/** The public table could not be read, with the reason the owner reads. */
export class PriceReadFailed extends Schema.TaggedError<PriceReadFailed>()("PriceReadFailed", {
  reason: Schema.String,
}) {}

/** Where the price table is read from; a seam so checks never reach the network (decision record 0014). */
export class PriceSource extends Context.Service<
  PriceSource,
  { readonly read: Effect.Effect<ReadonlyArray<PriceRow>, PriceReadFailed> }
>()("iskios/PriceSource") {}

/** What a turn was estimated to cost, with when the table it was priced from was read. */
export interface Estimate {
  readonly amount: number;
  readonly pricedAt: number;
}

/**
 * The providers whose models the table keeps, which are those the harnesses offer and OpenCode lists, in the order
 * tried when a model names no provider.
 */
export const priceProviders = [
  "anthropic",
  "openai",
  "google",
  "xai",
  "deepseek",
  "mistral",
  "moonshotai",
  "zai",
  "opencode",
] as const;

const rankOf = (provider: string) => {
  const index = (priceProviders as ReadonlyArray<string>).indexOf(provider);
  return index === -1 ? priceProviders.length : index;
};

/** A model name without a trailing release date such as `-20251001` or `-2025-10-01`. */
const withoutDate = (model: string) => model.replace(/-(\d{8}|\d{4}-\d{2}-\d{2})$/, "");

/**
 * The price of a model among the rows: its exact name, then without a provider prefix such as `anthropic/` (taken as
 * the provider when the rows know it), then without a release date. Null when no row matches; a price is never guessed.
 */
export const priceOf = (rows: ReadonlyArray<PriceRow>, model: string): PriceRow | null => {
  const slash = model.indexOf("/");
  const provider = slash === -1 ? null : model.slice(0, slash);
  const name = slash === -1 ? model : model.slice(slash + 1);
  for (const candidate of [name, withoutDate(name)]) {
    const matches = rows
      .filter((row) => row.model === candidate && (provider === null || row.provider === provider))
      .toSorted((a, b) => rankOf(a.provider) - rankOf(b.provider));
    if (matches[0] !== undefined) return matches[0];
  }
  return null;
};

/** What the usage costs at the price, rounded to a millionth of a dollar. */
export const amountOf = (price: PriceRow, usage: TokenUsage) => {
  const cost =
    usage.input * price.input +
    usage.output * price.output +
    usage.cacheRead * (price.cacheRead ?? price.input) +
    usage.cacheCreation * (price.cacheWrite ?? price.input);
  return Math.round(cost) / 1_000_000;
};

/** The price table: estimates a turn once when it ends, and reads the public table when asked. */
export class PriceTable extends Context.Service<
  PriceTable,
  {
    /** The turn's estimated cost, or null when the model has no price; never reads the network and never fails. */
    readonly estimate: (model: string, usage: TokenUsage) => Effect.Effect<Estimate | null>;
    /** Reads the public table now and keeps it; with fetching off it reads nothing and returns the status. */
    readonly refresh: Effect.Effect<PriceStatus, PriceReadFailed>;
    readonly status: Effect.Effect<PriceStatus>;
  }
>()("iskios/PriceTable") {}

interface StoredRow {
  readonly cacheRead: number | null;
  readonly cacheWrite: number | null;
  readonly fetchedAt: number;
  readonly input: number;
  readonly model: string;
  readonly output: number;
  readonly provider: string;
}

/** The price table over the service's database and a source for the public table. */
export const priceTableLayer = Layer.effect(
  PriceTable,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const source = yield* PriceSource;
    const stored = yield* sql<StoredRow>`
      SELECT provider, model, input, output, cache_read AS cacheRead, cache_write AS cacheWrite, fetched_at AS fetchedAt
      FROM prices`.pipe(Effect.orDie);
    const fetched = yield* Ref.make({ at: stored[0]?.fetchedAt ?? 0, rows: stored as ReadonlyArray<PriceRow> });

    /** The rows estimates use now: the fetched table first with the snapshot behind it, or the snapshot alone. */
    const activeOf = Effect.gen(function* () {
      const isFetching = (yield* readSettings.pipe(Effect.provideService(SqlClient.SqlClient, sql), Effect.orDie))
        .shouldFetchPrices;
      const kept = yield* Ref.get(fetched);
      return isFetching && kept.rows.length > 0
        ? { at: kept.at, isFetching, rows: kept.rows, source: "Fetched" as const }
        : { at: snapshotAt, isFetching, rows: [], source: "Snapshot" as const };
    });

    const status = Effect.gen(function* () {
      const active = yield* activeOf;
      const names = new Set([...active.rows, ...snapshotPrices].map((row) => `${row.provider}/${row.model}`));
      return {
        at: active.at,
        isFetching: active.isFetching,
        models: names.size,
        source: active.source,
      } satisfies PriceStatus;
    });

    const estimate = (model: string, usage: TokenUsage) =>
      Effect.gen(function* () {
        const active = yield* activeOf;
        const fromTable = priceOf(active.rows, model);
        if (fromTable !== null) return { amount: amountOf(fromTable, usage), pricedAt: active.at } satisfies Estimate;
        const fromSnapshot = priceOf(snapshotPrices, model);
        return fromSnapshot === null
          ? null
          : ({ amount: amountOf(fromSnapshot, usage), pricedAt: snapshotAt } satisfies Estimate);
      });

    const refresh = Effect.gen(function* () {
      if (!(yield* activeOf).isFetching) return yield* status;
      const rows = yield* source.read;
      const at = yield* Clock.currentTimeMillis;
      yield* sql
        .withTransaction(
          Effect.gen(function* () {
            yield* sql`DELETE FROM prices`;
            for (const row of rows)
              yield* sql`INSERT OR REPLACE INTO prices (provider, model, input, output, cache_read, cache_write, source, fetched_at)
                VALUES (${row.provider}, ${row.model}, ${row.input}, ${row.output}, ${row.cacheRead}, ${row.cacheWrite}, 'Fetched', ${at})`;
          }),
        )
        .pipe(Effect.orDie);
      yield* Ref.set(fetched, { at, rows });
      return yield* status;
    });

    return PriceTable.of({ estimate, refresh, status });
  }),
);
