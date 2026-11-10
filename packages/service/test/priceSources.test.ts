import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { modelsDevSourceLayer, PriceSource, priceOf, rowsOfModelsDev } from "../src/core/index.ts";

const row = (provider: string, model: string, input = 1) => ({
  cacheRead: null,
  cacheWrite: null,
  input,
  model,
  output: 2,
  provider,
});

describe("matching a model to its price", () => {
  const rows = [
    row("anthropic", "claude-sonnet-5-5", 2),
    row("opencode", "claude-sonnet-5-5", 9),
    row("openai", "gpt-5.5", 5),
    row("anthropic", "claude-haiku-4-5", 1),
  ];

  it("finds a model by its exact name, the first-party provider first", () => {
    expect(priceOf(rows, "claude-sonnet-5-5")).toMatchObject({ input: 2, provider: "anthropic" });
  });

  it("takes a provider prefix as the provider", () => {
    expect(priceOf(rows, "opencode/claude-sonnet-5-5")).toMatchObject({ input: 9 });
    expect(priceOf(rows, "anthropic/claude-sonnet-5-5")).toMatchObject({ input: 2 });
  });

  it("matches a model released under a dated name to its undated price", () => {
    expect(priceOf(rows, "claude-haiku-4-5-20251001")).toMatchObject({ model: "claude-haiku-4-5" });
    expect(priceOf(rows, "claude-haiku-4-5-2025-10-01")).toMatchObject({ model: "claude-haiku-4-5" });
  });

  it("finds nothing for a model it does not know, never a nearest guess", () => {
    expect(priceOf(rows, "claude-sonnet-9")).toBeNull();
    expect(priceOf(rows, "mistral/claude-sonnet-5-5")).toBeNull();
  });
});

describe("reading the public price table", () => {
  const table = {
    anthropic: { models: { "claude-opus-5-5": { cost: { cache_read: 0.2, cache_write: 5, input: 4, output: 20 } } } },
    elsewhere: { models: { "other-model": { cost: { input: 1, output: 2 } } } },
    openai: {
      models: { free: { name: "no cost listed" }, "gpt-5.5": { cost: { cache_read: 0.5, input: 5, output: 30 } } },
    },
  };

  it("keeps the prices of the providers it follows, with a missing cache price as null", () => {
    expect(rowsOfModelsDev(table)).toEqual([
      { cacheRead: 0.2, cacheWrite: 5, input: 4, model: "claude-opus-5-5", output: 20, provider: "anthropic" },
      { cacheRead: 0.5, cacheWrite: null, input: 5, model: "gpt-5.5", output: 30, provider: "openai" },
    ]);
  });

  it.effect("sends a plain GET that carries nothing about the owner", () =>
    Effect.gen(function* () {
      const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
      const fake = (async (url: string | URL | Request, init?: RequestInit) => {
        requests.push({ init, url: String(url) });
        return Response.json(table);
      }) as typeof fetch;
      const rows = yield* Effect.gen(function* () {
        return yield* (yield* PriceSource).read;
      }).pipe(Effect.provide(modelsDevSourceLayer(fake)));
      expect(rows).toHaveLength(2);
      expect(requests).toHaveLength(1);
      expect(requests[0]?.url).toBe("https://models.dev/api.json");
      expect(requests[0]?.init?.method).toBe("GET");
      expect(requests[0]?.init?.body).toBeUndefined();
      expect(requests[0]?.init?.headers).toEqual({ accept: "application/json" });
    }),
  );

  it.effect("fails with a reason when the table answers with an error", () =>
    Effect.gen(function* () {
      const failing = (async () => new Response("nope", { status: 503 })) as unknown as typeof fetch;
      const failure = yield* Effect.gen(function* () {
        return yield* (yield* PriceSource).read;
      }).pipe(Effect.provide(modelsDevSourceLayer(failing)), Effect.flip);
      expect(failure.reason).toContain("503");
    }),
  );
});
