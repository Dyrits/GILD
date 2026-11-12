import { describe, expect, it } from "@effect/vitest";
import type { MissionDetail } from "@iskios/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { afterEach } from "vitest";
import { fakePriceSource, testPrices } from "./fixtures/prices.ts";
import { call, fixture, read, send, settle } from "./fixtures/service.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
const setup = (prices = fakePriceSource(testPrices)) => {
  const value = fixture(void 0, prices.layer);
  fixtures.push(value);
  return { ...value, prices };
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

const isIdleWithTurn = (detail: MissionDetail) =>
  detail.thread.state === "Idle" && detail.mission.consumption.turns >= 1;

/** Waits until the table read at startup is the one in use: the service reads it in the background, so a turn that starts at once can be priced from the snapshot alone. */
const fetchedTableInUse = Effect.gen(function* () {
  for (let i = 0; i < 400; i++) {
    if ((yield* call({ _tag: "ReadPriceStatus" })).source === "Fetched") return;
    yield* Effect.sleep("10 millis");
  }
  return yield* Effect.die(new Error("The price table read at startup was never put in use."));
});

/**
 * Starts a mission on `model` whose first message is the script, and waits for its turn to end. Unless `isTableRead`
 * is false (a source that cannot be read), it first waits for the startup read, so the turn is priced from the table.
 */
const startOn = (model: string, script: string, isTableRead = true) =>
  Effect.gen(function* () {
    if (isTableRead) yield* fetchedTableInUse;
    const started = yield* call({
      _tag: "StartMission",
      effort: "default",
      model,
      requestId: crypto.randomUUID(),
      text: script,
      workspacePath: null,
    });
    return yield* settle(started.missionId, isIdleWithTurn);
  });

describe("estimating a turn's cost", () => {
  it.live("stamps an estimated cost on each turn from the price table", () => {
    const { layer } = setup();
    return Effect.gen(function* () {
      const detail = yield* startOn("test-model", "spend 1000000");
      expect(detail.mission.consumption).toMatchObject({
        earlierTurns: 0,
        estimated: 3,
        reported: 0,
        turns: 1,
        unpricedTurns: 0,
      });
    }).pipe(Effect.provide(layer));
  });

  it.live("prices each token kind at its own rate", () => {
    const { layer } = setup();
    return Effect.gen(function* () {
      const detail = yield* startOn("test-model", "usage 100000 200000 1000000 400000");
      // 0.3 input + 3 output + 0.3 cache read + 1.5 cache write, from the prices in dollars per million tokens.
      expect(detail.mission.consumption.estimated).toBeCloseTo(5.1, 6);
      expect(detail.mission.consumption.tokens).toEqual({
        cacheCreation: 400000,
        cacheRead: 1000000,
        input: 100000,
        output: 200000,
      });
    }).pipe(Effect.provide(layer));
  });

  it.live("leaves a turn unpriced when no price is known for its model", () => {
    const { layer } = setup();
    return Effect.gen(function* () {
      const detail = yield* startOn("model-nobody-prices", "spend 1000");
      expect(detail.mission.consumption).toMatchObject({ estimated: 0, reported: 0, turns: 1, unpricedTurns: 1 });
    }).pipe(Effect.provide(layer));
  });

  it.live("takes the harness's own cost as the estimate for a model the table lacks", () => {
    const { layer } = setup();
    return Effect.gen(function* () {
      const detail = yield* startOn("model-nobody-prices", "billing Subscription\nspend 1000 2");
      expect(detail.mission.consumption).toMatchObject({ estimated: 2, reported: 0, unpricedTurns: 0 });
    }).pipe(Effect.provide(layer));
  });

  it.live("shows the cost an API-key turn reported as reported, not estimated", () => {
    const { layer } = setup();
    return Effect.gen(function* () {
      const detail = yield* startOn("test-model", "billing ApiKey\nspend 1000000 2.5");
      expect(detail.mission.consumption).toMatchObject({ estimated: 0, reported: 2.5, unpricedTurns: 0 });
      expect(detail.mission.budget.spent.cost).toBe(2.5);
    }).pipe(Effect.provide(layer));
  });

  it.live("counts an API-key turn the harness gave no cost for by its estimate", () => {
    const { layer } = setup();
    return Effect.gen(function* () {
      const detail = yield* startOn("test-model", "billing ApiKey\nusage 1000000 0 0 0");
      expect(detail.mission.budget.spent).toEqual({ cost: 3, tokens: 0 });
    }).pipe(Effect.provide(layer));
  });

  it.live("never counts an estimate toward a limit for a subscription turn", () => {
    const { layer } = setup();
    return Effect.gen(function* () {
      const detail = yield* startOn("test-model", "billing Subscription\nusage 1000000 0 0 0");
      expect(detail.mission.consumption.estimated).toBe(3);
      expect(detail.mission.budget.spent).toEqual({ cost: 0, tokens: 1000000 });
    }).pipe(Effect.provide(layer));
  });
});

describe("the price table", () => {
  it.live("keeps a turn's stamped estimate when the table changes", () => {
    const { layer, prices } = setup();
    return Effect.gen(function* () {
      const detail = yield* startOn("test-model", "spend 1000000");
      expect(detail.mission.consumption.estimated).toBe(3);
      prices.state.rows = [{ ...testPrices[0], input: 30 }] as typeof testPrices;
      const status = yield* call({ _tag: "RefreshPrices" });
      expect(status.source).toBe("Fetched");
      expect((yield* read(detail.mission.id)).mission.consumption.estimated).toBe(3);
      yield* send(detail.thread.id, "spend 1000000");
      const next = yield* settle(
        detail.mission.id,
        (d) => d.mission.consumption.turns >= 2 && d.thread.state === "Idle",
      );
      expect(next.mission.consumption.estimated).toBe(33);
    }).pipe(Effect.provide(layer));
  });

  it.live("reads the public table at startup", () => {
    const { layer, prices } = setup();
    return Effect.gen(function* () {
      yield* startOn("test-model", "spend 1");
      expect(prices.state.reads).toBeGreaterThanOrEqual(1);
      expect((yield* call({ _tag: "ReadPriceStatus" })).source).toBe("Fetched");
    }).pipe(Effect.provide(layer));
  });

  it.live("keeps the table it has when a read fails, and says why", () => {
    const { layer, prices } = setup();
    return Effect.gen(function* () {
      yield* startOn("test-model", "spend 1");
      prices.state.isFailing = true;
      const failure = yield* call({ _tag: "RefreshPrices" }).pipe(Effect.flip);
      expect(failure).toMatchObject({ kind: "ExecutionFailure" });
      expect((yield* call({ _tag: "ReadPriceStatus" })).source).toBe("Fetched");
      const detail = yield* startOn("test-model", "spend 1000000");
      expect(detail.mission.consumption.estimated).toBe(3);
    }).pipe(Effect.provide(layer));
  });

  it.live("falls back to the shipped snapshot when no table was read", () => {
    const { layer, prices } = setup();
    prices.state.isFailing = true;
    return Effect.gen(function* () {
      // Claude Code's Sonnet 5.5 at the snapshot's $2 per million input tokens.
      const detail = yield* startOn("claude-sonnet-5-5", "spend 1000000", false);
      expect(detail.mission.consumption.estimated).toBe(2);
      expect(yield* call({ _tag: "ReadPriceStatus" })).toMatchObject({ isFetching: true, source: "Snapshot" });
    }).pipe(Effect.provide(layer));
  });

  it.live("uses only the snapshot, and reads nothing more, with Fetch prices off", () => {
    const { layer, prices } = setup();
    return Effect.gen(function* () {
      // The table is read and in use first, so that switching the setting off is what makes it unused.
      const first = yield* startOn("test-model", "spend 1000000");
      expect(first.mission.consumption.estimated).toBe(3);
      const settings = yield* call({ _tag: "ReadSettings" });
      yield* call({ _tag: "UpdateSettings", settings: { ...settings, shouldFetchPrices: false } });
      const reads = prices.state.reads;
      const status = yield* call({ _tag: "RefreshPrices" });
      expect(status).toMatchObject({ isFetching: false, source: "Snapshot" });
      expect(prices.state.reads).toBe(reads);
      yield* send(first.thread.id, "spend 1000000");
      const detail = yield* settle(
        first.mission.id,
        (d) => d.mission.consumption.turns >= 2 && d.thread.state === "Idle",
      );
      expect(detail.mission.consumption).toMatchObject({ estimated: 3, unpricedTurns: 1 });
    }).pipe(Effect.provide(layer));
  });
});

describe("turns recorded before billing kinds", () => {
  it.live("stay unpriced, are counted as they were, and are named as earlier turns", () => {
    const { layer } = setup();
    return Effect.gen(function* () {
      const detail = yield* startOn("test-model", "spend 1");
      const sql = yield* SqlClient.SqlClient;
      yield* sql`INSERT INTO usage (turn_id, mission_id, thread_id, ended_at, input, output, cache_read, cache_creation, cost)
        VALUES ('earlier-subscription', ${detail.mission.id}, ${detail.thread.id}, 1, 700, 0, 0, 0, NULL),
          ('earlier-cost', ${detail.mission.id}, ${detail.thread.id}, 2, 900, 0, 0, 0, 1.25)`;
      const after = yield* read(detail.mission.id);
      expect(after.mission.consumption).toMatchObject({ earlierTurns: 1, reported: 1.25, turns: 3 });
      expect(after.mission.budget.spent).toEqual({ cost: 1.25, tokens: 701 });
    }).pipe(Effect.provide(layer));
  });
});

describe("the budget window's consumption", () => {
  it.live("splits a mission's use by thread, harness, and model, each with its estimate", () => {
    const { layer } = setup();
    return Effect.gen(function* () {
      const detail = yield* startOn("test-model", "spend 1000000");
      const window = yield* call({ _tag: "ReadBudget", missionId: detail.mission.id });
      expect(window.consumption).toMatchObject({ estimated: 3, turns: 1 });
      expect(window.parts.map((part) => part.consumption.estimated)).toEqual([3]);
      expect(window.byHarness).toMatchObject([{ consumption: { estimated: 3 }, title: "Claude Code" }]);
      expect(window.byModel).toMatchObject([{ consumption: { estimated: 3 }, title: "test-model" }]);
    }).pipe(Effect.provide(layer));
  });

  it.live("splits the global period's use by mission, harness, and model", () => {
    const { layer } = setup();
    return Effect.gen(function* () {
      yield* startOn("test-model", "spend 1000000");
      const window = yield* call({ _tag: "ReadBudget", missionId: null });
      expect(window.consumption.estimated).toBe(3);
      expect(window.byModel).toMatchObject([{ title: "test-model" }]);
    }).pipe(Effect.provide(layer));
  });

  it.live("names turns recorded before models were recorded as earlier turns", () => {
    const { layer } = setup();
    return Effect.gen(function* () {
      const detail = yield* startOn("test-model", "spend 1");
      const sql = yield* SqlClient.SqlClient;
      yield* sql`INSERT INTO usage (turn_id, mission_id, thread_id, ended_at, input, output, cache_read, cache_creation, cost)
        VALUES ('earlier', ${detail.mission.id}, ${detail.thread.id}, 1, 700, 0, 0, 0, NULL)`;
      const window = yield* call({ _tag: "ReadBudget", missionId: detail.mission.id });
      expect(window.byModel.map((part) => part.title).toSorted()).toEqual(["Earlier turns", "test-model"]);
    }).pipe(Effect.provide(layer));
  });
});

describe("consumption on the quest and thread panels", () => {
  it.live("shows what a thread's own turns used, with the estimate", () => {
    const { layer } = setup();
    return Effect.gen(function* () {
      const detail = yield* startOn("test-model", "spend 1000000");
      const panel = yield* call({ _tag: "ReadThreadPanel", threadId: detail.thread.id });
      expect(panel.consumption).toMatchObject({ estimated: 3, reported: 0, turns: 1 });
    }).pipe(Effect.provide(layer));
  });

  it.live("counts no earlier turns for a mission that has run none", () => {
    const { layer } = setup();
    return Effect.gen(function* () {
      const started = yield* call({
        _tag: "StartMission",
        effort: "default",
        model: "test-model",
        requestId: crypto.randomUUID(),
        text: "wait 60000",
        workspacePath: null,
      });
      const detail = yield* read(started.missionId);
      expect(detail.mission.consumption).toMatchObject({ earlierTurns: 0, turns: 0, unpricedTurns: 0 });
    }).pipe(Effect.provide(layer));
  });
});

describe("cost on each agent reply", () => {
  const lastReplyOf = (detail: MissionDetail) => detail.messages.filter((message) => message.sender === "agent").at(-1);

  it.live("shows the turn's use under its last reply when the harness reports only per turn", () => {
    const { layer } = setup();
    return Effect.gen(function* () {
      const detail = yield* startOn("test-model", "spend 1000000");
      expect(lastReplyOf(detail)?.usage).toEqual({
        estimated: 3,
        reported: null,
        tokens: { cacheCreation: 0, cacheRead: 0, input: 1000000, output: 0 },
      });
    }).pipe(Effect.provide(layer));
  });

  it.live("shows the reported cost of an API-key turn, not an estimate", () => {
    const { layer } = setup();
    return Effect.gen(function* () {
      const detail = yield* startOn("test-model", "billing ApiKey\nspend 1000 2.5");
      expect(lastReplyOf(detail)?.usage).toMatchObject({ estimated: null, reported: 2.5 });
    }).pipe(Effect.provide(layer));
  });

  it.live("shows a reply's own call and gives it what the turn used beyond its calls, so the lines add up", () => {
    const { layer } = setup();
    return Effect.gen(function* () {
      // The reply's call used 100,000 input and 10,000 output tokens; the turn used 300,000 and 30,000 in all.
      const detail = yield* startOn("test-model", "callusage 100000 10000 0 0\nusage 300000 30000 0 0");
      const usage = lastReplyOf(detail)?.usage;
      expect(usage?.tokens).toEqual({ cacheCreation: 0, cacheRead: 0, input: 300000, output: 30000 });
      // $3 and $15 per million tokens: 0.9 + 0.45.
      expect(usage?.estimated).toBeCloseTo(1.35, 6);
      expect(detail.mission.consumption.estimated).toBeCloseTo(1.35, 6);
    }).pipe(Effect.provide(layer));
  });

  it.live("shows no price for a reply whose model has none", () => {
    const { layer } = setup();
    return Effect.gen(function* () {
      const detail = yield* startOn("model-nobody-prices", "spend 1000");
      expect(lastReplyOf(detail)?.usage).toMatchObject({ estimated: null, reported: null });
      expect(lastReplyOf(detail)?.usage?.tokens.input).toBe(1000);
    }).pipe(Effect.provide(layer));
  });

  it.live("shows nothing under a reply of a turn that reported no usage, and under the owner's messages", () => {
    const { layer } = setup();
    return Effect.gen(function* () {
      const started = yield* call({
        _tag: "StartMission",
        effort: "default",
        model: "test-model",
        requestId: crypto.randomUUID(),
        text: "Hello",
        workspacePath: null,
      });
      const detail = yield* settle(
        started.missionId,
        (d) => d.thread.state === "Idle" && d.messages.some((message) => message.sender === "agent"),
      );
      expect(lastReplyOf(detail)?.usage).toBeNull();
      expect(detail.messages.find((message) => message.sender === "user")?.usage).toBeNull();
    }).pipe(Effect.provide(layer));
  });

  it.live("gives each turn's last reply its own turn's use", () => {
    const { layer } = setup();
    return Effect.gen(function* () {
      const first = yield* startOn("test-model", "spend 1000000");
      yield* send(first.thread.id, "spend 2000000");
      const second = yield* settle(
        first.mission.id,
        (d) => d.mission.consumption.turns >= 2 && d.thread.state === "Idle",
      );
      const replies = second.messages.filter((message) => message.sender === "agent");
      expect(replies.map((reply) => reply.usage?.estimated)).toEqual([3, 6]);
    }).pipe(Effect.provide(layer));
  });
});
