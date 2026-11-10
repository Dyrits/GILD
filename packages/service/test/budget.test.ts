import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import type { BudgetLimits, MissionDetail, MissionId, Settings, ThreadId } from "@gild/contracts";
import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { afterEach } from "vitest";
import { periodStartOf } from "../src/core/spending.ts";
import { call, fixture, open, read, send, settle, start, tool } from "./fixtures/service.ts";

const openLine = (request: string) => `call open_thread ${JSON.stringify({ request })}`;

const fixtures: ReturnType<typeof fixture>[] = [];
const setup = () => {
  const value = fixture();
  fixtures.push(value);
  return value;
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

const none: BudgetLimits = { cost: null, tokens: null };
const isIdle = (detail: MissionDetail) => detail.thread.state === "Idle";
const isHeldByBudget = (detail: MissionDetail) =>
  detail.thread.state === "Attention" && detail.thread.blocker === "Budget";
const lastAgentText = (detail: MissionDetail) => detail.messages.filter((m) => m.sender === "agent").at(-1)?.text ?? "";

const updateSettings = (change: Partial<Settings>) =>
  Effect.gen(function* () {
    const settings = yield* call({ _tag: "ReadSettings" });
    yield* call({ _tag: "UpdateSettings", settings: { ...settings, ...change } });
  });

const setBudget = (missionId: MissionId, limits: BudgetLimits) => call({ _tag: "SetMissionBudget", limits, missionId });

/** Starts a mission with a budget and waits for its first turn to end. */
const startWithBudget = (limits: BudgetLimits, text = "Hello") =>
  Effect.gen(function* () {
    const started = yield* start(text);
    yield* settle(started.missionId, isIdle);
    yield* setBudget(started.missionId, limits);
    return started;
  });

/** Opens a thread beneath that keeps running until stopped. */
const openRunning = (missionId: MissionId, parentId: ThreadId) =>
  Effect.gen(function* () {
    const child = yield* open(parentId, "wait 60000");
    yield* settle(missionId, (d) => d.thread.state === "Running", child.threadId);
    return child;
  });

describe("counting spending against budgets", () => {
  it.live("counts cost and tokens separately, and never prices tokens", () =>
    Effect.gen(function* () {
      const started = yield* startWithBudget({ cost: 1, tokens: null });
      yield* send(started.threadId, "spend 1000000");
      yield* settle(started.missionId, (d) => isIdle(d) && d.mission.budget.spent.tokens >= 1_000_000);
      const detail = yield* read(started.missionId);
      expect(detail.mission.budget.spent).toEqual({ cost: 0, tokens: 1_000_000 });
      yield* send(started.threadId, "spend 500 1.5");
      const held = yield* settle(started.missionId, isHeldByBudget);
      expect(held.mission.budget.spent).toEqual({ cost: 1.5, tokens: 1_000_000 });
      expect(held.budgetStop).toMatchObject({ scope: "Mission", threadId: started.threadId });
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("counts a subscription turn's tokens even when the harness reported a cost", () =>
    Effect.gen(function* () {
      const started = yield* startWithBudget({ cost: 1, tokens: 1000 });
      yield* send(started.threadId, "billing Subscription\nspend 500 1.5");
      const detail = yield* settle(started.missionId, (d) => isIdle(d) && d.mission.budget.spent.tokens >= 500);
      expect(detail.mission.budget.spent).toEqual({ cost: 0, tokens: 500 });
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("counts an unknown billing kind as subscription tokens, and an API-key turn as cost", () =>
    Effect.gen(function* () {
      const started = yield* startWithBudget({ cost: 10, tokens: 10_000 });
      yield* send(started.threadId, "billing Unknown\nspend 300 2");
      yield* settle(started.missionId, (d) => isIdle(d) && d.mission.budget.spent.tokens >= 300);
      yield* send(started.threadId, "billing ApiKey\nspend 700 4");
      const detail = yield* settle(started.missionId, (d) => isIdle(d) && d.mission.budget.spent.cost >= 4);
      expect(detail.mission.budget.spent).toEqual({ cost: 4, tokens: 300 });
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("never stops on an empty budget", () =>
    Effect.gen(function* () {
      const started = yield* start("spend 5000000 100");
      const detail = yield* settle(started.missionId, (d) => isIdle(d) && d.mission.budget.spent.cost === 100);
      expect(detail.mission.budget.limits).toEqual(none);
      expect(detail.budgetStop).toBeNull();
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("draws every thread on its mission's budget and counts it toward the global budget", () =>
    Effect.gen(function* () {
      const started = yield* startWithBudget({ cost: null, tokens: 1000 });
      yield* send(started.threadId, "spend 60");
      yield* settle(started.missionId, (d) => isIdle(d) && d.mission.budget.spent.tokens === 60);
      const child = yield* open(started.threadId, "spend 50");
      yield* settle(started.missionId, (d) => isIdle(d), child.threadId);
      const window = yield* call({ _tag: "ReadBudget", missionId: started.missionId });
      expect(window.spent.tokens).toBe(110);
      expect(window.parts.map((p) => p.spent.tokens).sort()).toEqual([50, 60]);
      const global = yield* call({ _tag: "ReadBudget", missionId: null });
      expect(global.spent.tokens).toBe(110);
      expect(global.period).toBe("Month");
      expect(global.parts[0]).toMatchObject({ id: started.missionId });
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("applies the default budget to new missions and records each change in the top thread", () =>
    Effect.gen(function* () {
      expect((yield* call({ _tag: "ReadSettings" })).defaultMissionBudget).toEqual(none);
      yield* updateSettings({ defaultMissionBudget: { cost: null, tokens: 500 } });
      const started = yield* start("Hello");
      yield* settle(started.missionId, isIdle);
      expect((yield* read(started.missionId)).mission.budget.limits).toEqual({ cost: null, tokens: 500 });
      yield* setBudget(started.missionId, { cost: null, tokens: 900 });
      yield* setBudget(started.missionId, { cost: null, tokens: 700 });
      yield* setBudget(started.missionId, none);
      const lines = (yield* read(started.missionId)).budgetEvents.map((e) => e.text);
      expect(lines).toEqual([
        "Budget set: 500 tokens",
        "Budget raised to 900 tokens",
        "Budget lowered to 700 tokens",
        "Budget removed",
      ]);
    }).pipe(Effect.provide(setup().layer)),
  );
});

describe("the global budget's period", () => {
  it("starts at local midnight, on Monday for a week, and on the 1st for a month", () => {
    const friday = new Date(2026, 10, 6, 15, 30).getTime();
    const sunday = new Date(2026, 10, 8, 23, 59).getTime();
    expect(periodStartOf(friday, "Day")).toBe(new Date(2026, 10, 6).getTime());
    expect(periodStartOf(friday, "Week")).toBe(new Date(2026, 10, 2).getTime());
    expect(periodStartOf(sunday, "Week")).toBe(new Date(2026, 10, 2).getTime());
    expect(periodStartOf(friday, "Month")).toBe(new Date(2026, 10, 1).getTime());
  });
});

describe("reaching a limit", () => {
  it.live("stops the mission's running threads in Attention, then resumes them when the owner raises the budget", () =>
    Effect.gen(function* () {
      const started = yield* startWithBudget({ cost: null, tokens: 100 });
      const child = yield* openRunning(started.missionId, started.threadId);
      yield* send(started.threadId, "spend 100");
      const top = yield* settle(started.missionId, isHeldByBudget);
      expect(top.budgetStop?.threadId).toBe(started.threadId);
      yield* settle(started.missionId, isHeldByBudget, child.threadId);
      expect(top.budgetEvents.at(-1)?.text).toBe("Stopped at the budget limit: 100 of 100 tokens");
      yield* setBudget(started.missionId, { cost: null, tokens: 150 });
      // The interrupted message runs again: the child is back at work.
      yield* settle(started.missionId, (d) => d.thread.state === "Running", child.threadId);
      const released = yield* settle(started.missionId, (d) => d.thread.state === "Idle");
      expect(released.budgetStop).toBeNull();
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("leaves the threads stopped when the owner answers Stop, and holds new messages", () =>
    Effect.gen(function* () {
      const started = yield* startWithBudget({ cost: null, tokens: 100 });
      const child = yield* openRunning(started.missionId, started.threadId);
      yield* send(started.threadId, "spend 100");
      const top = yield* settle(started.missionId, isHeldByBudget);
      const stopId = top.budgetStop?.id;
      if (stopId === undefined) return yield* Effect.die("Missing stop");
      yield* call({ _tag: "StopAtBudget", stopId });
      yield* settle(started.missionId, (d) => d.thread.state === "Stopped");
      yield* settle(started.missionId, (d) => d.thread.state === "Stopped", child.threadId);
      yield* call({ _tag: "ResumeThread", threadId: started.threadId });
      yield* send(started.threadId, "Still there?");
      const held = yield* settle(started.missionId, isHeldByBudget);
      expect(held.messages.at(-1)?.text).toBe("Still there?");
      expect(held.budgetStop).not.toBeNull();
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("stops every running thread at the global limit, with one shared question, and refuses new missions", () =>
    Effect.gen(function* () {
      yield* updateSettings({ globalBudget: { cost: null, tokens: 100 } });
      const other = yield* start("wait 60000");
      yield* settle(other.missionId, (d) => d.thread.state === "Running");
      const spender = yield* start("spend 100");
      yield* settle(spender.missionId, isHeldByBudget);
      yield* settle(other.missionId, isHeldByBudget);
      const global = yield* call({ _tag: "ReadBudget", missionId: null });
      expect(global.stop).toMatchObject({ missionId: null, scope: "Global" });
      expect((yield* call({ _tag: "ReadBudget", missionId: other.missionId })).stop).toBeNull();
      const refused = yield* Effect.flip(start("Another"));
      expect(refused.kind).toBe("InvalidInput");
      expect(refused.message).toContain("global budget");
      yield* updateSettings({ globalBudget: { cost: null, tokens: 1000 } });
      yield* settle(other.missionId, (d) => d.thread.state === "Running");
      expect((yield* call({ _tag: "ReadBudget", missionId: null })).stop).toBeNull();
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("records each change of the global budget and each stop at it as a line in the Guildmaster", () =>
    Effect.gen(function* () {
      const guildmaster = yield* call({ _tag: "ReadGuildmaster" });
      const lines = () => read(guildmaster.missionId).pipe(Effect.map((d) => d.budgetEvents.map((e) => e.text)));
      yield* updateSettings({ globalBudget: { cost: null, tokens: 100 } });
      expect(yield* lines()).toEqual(["Global budget set: 100 tokens"]);
      const spender = yield* start("spend 100");
      yield* settle(spender.missionId, isHeldByBudget);
      expect(yield* lines()).toEqual([
        "Global budget set: 100 tokens",
        "Stopped at the global budget limit: 100 of 100 tokens",
      ]);
      yield* updateSettings({ globalBudget: { cost: null, tokens: 1000 } });
      expect((yield* lines()).at(-1)).toBe("Global budget raised to 1,000 tokens");
      yield* updateSettings({ globalBudget: none });
      expect((yield* lines()).at(-1)).toBe("Global budget removed");
      // The mission's own budget lines stay with the mission.
      expect((yield* read(spender.missionId)).budgetEvents).toEqual([]);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("refuses open_thread at a reached limit, with the reason", () =>
    Effect.gen(function* () {
      const started = yield* startWithBudget({ cost: null, tokens: 100 });
      yield* send(started.threadId, "spend 100");
      yield* settle(started.missionId, isHeldByBudget);
      const answer = yield* tool(started.threadId, "open_thread", { request: "More work" });
      expect(answer).toContain("budget");
      expect((yield* read(started.missionId)).threads).toHaveLength(1);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("stops running threads when the owner lowers the budget below the spending", () =>
    Effect.gen(function* () {
      const started = yield* start("spend 100");
      yield* settle(started.missionId, (d) => isIdle(d) && d.mission.budget.spent.tokens === 100);
      const child = yield* openRunning(started.missionId, started.threadId);
      yield* setBudget(started.missionId, { cost: null, tokens: 50 });
      yield* settle(started.missionId, isHeldByBudget, child.threadId);
      const top = yield* read(started.missionId);
      expect(top.budgetStop?.threadId).toBe(started.threadId);
    }).pipe(Effect.provide(setup().layer)),
  );
});

describe("telling threads their budget", () => {
  it.live("carries a budget line in each turn's context, and none without a budget", () =>
    Effect.gen(function* () {
      const bare = yield* start("context");
      const plain = yield* settle(bare.missionId, (d) => isIdle(d) && lastAgentText(d) !== "");
      expect(lastAgentText(plain)).not.toContain("Budget:");
      const started = yield* startWithBudget({ cost: null, tokens: 1000 });
      yield* send(started.threadId, "spend 200");
      yield* settle(started.missionId, (d) => isIdle(d) && d.mission.budget.spent.tokens === 200);
      yield* send(started.threadId, "context");
      const detail = yield* settle(started.missionId, (d) => isIdle(d) && lastAgentText(d).includes("Budget:"));
      expect(lastAgentText(detail)).toContain("Budget: 200 of 1,000 tokens used (20%)");
      expect(lastAgentText(detail)).toContain("At a limit, Gild stops the work under it and asks the owner.");
    }).pipe(Effect.provide(setup().layer)),
  );
});

describe("answering Stop at a reached budget", () => {
  it.live("returns a parent left Waiting to Idle once nothing beneath it is at work", () =>
    Effect.gen(function* () {
      const started = yield* start(openLine("wait 60000"));
      yield* settle(started.missionId, (d) => d.thread.state === "Waiting");
      yield* setBudget(started.missionId, { cost: null, tokens: 100 });
      const spender = yield* open(started.threadId, "spend 100");
      const held = yield* settle(started.missionId, isHeldByBudget, spender.threadId);
      const stopId = held.budgetStop?.id;
      if (stopId === undefined) return yield* Effect.die("Missing stop");
      yield* call({ _tag: "StopAtBudget", stopId });
      const after = yield* settle(started.missionId, (d) => d.threads.slice(1).every((t) => t.state === "Stopped"));
      expect(after.thread.state).toBe("Idle");
    }).pipe(Effect.provide(setup().layer)),
  );
});

describe("keeping spending when threads are deleted", () => {
  it.live("keeps a deleted thread's spending on its mission and the global budget", () =>
    Effect.gen(function* () {
      const started = yield* startWithBudget({ cost: null, tokens: 1000 });
      const child = yield* open(started.threadId, "spend 300");
      yield* settle(started.missionId, (d) => d.mission.budget.spent.tokens === 300);
      const preview = yield* call({ _tag: "PreviewDeletion", threadId: child.threadId });
      yield* call({ _tag: "DeleteThread", confirmation: preview.confirmation, threadId: child.threadId });
      const window = yield* call({ _tag: "ReadBudget", missionId: started.missionId });
      expect(window.spent.tokens).toBe(300);
      expect(window.parts.map((p) => p.spent.tokens)).toEqual([300]);
      expect((yield* call({ _tag: "ReadBudget", missionId: null })).spent.tokens).toBe(300);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("keeps a deleted mission's spending on the global budget", () =>
    Effect.gen(function* () {
      const started = yield* start("spend 400");
      yield* settle(started.missionId, (d) => isIdle(d) && d.mission.budget.spent.tokens === 400);
      const preview = yield* call({ _tag: "PreviewDeletion", threadId: started.threadId });
      yield* call({ _tag: "DeleteThread", confirmation: preview.confirmation, threadId: started.threadId });
      expect((yield* call({ _tag: "ReadBudget", missionId: null })).spent.tokens).toBe(400);
    }).pipe(Effect.provide(setup().layer)),
  );
});

describe("starting a new global period", () => {
  const advance = (millis: number) =>
    Effect.gen(function* () {
      yield* TestClock.adjust(millis);
      for (let i = 0; i < 40; i++) yield* Effect.yieldNow;
    });

  it.effect("releases threads held at the global limit when the period starts over", () =>
    Effect.gen(function* () {
      yield* updateSettings({ globalBudget: { cost: null, tokens: 100 }, globalBudgetPeriod: "Day" });
      const started = yield* start("spend 100");
      for (let i = 0; i < 5; i++) yield* advance(20);
      expect(isHeldByBudget(yield* read(started.missionId))).toBe(true);
      yield* advance(25 * 60 * 60 * 1000);
      const released = yield* read(started.missionId);
      expect(released.thread.state).toBe("Idle");
      expect(released.budgetStop).toBeNull();
    }).pipe(Effect.provide(setup().layer)),
  );
});

describe("holding at a lowered budget", () => {
  it.live("leaves another reason the top thread waits on the owner in place", () => {
    const value = setup();
    const folder = join(value.directory, "work");
    mkdirSync(folder);
    return Effect.gen(function* () {
      const started = yield* start("spend 100", folder);
      yield* settle(started.missionId, (d) => isIdle(d) && d.mission.budget.spent.tokens === 100);
      const child = yield* openRunning(started.missionId, started.threadId);
      rmSync(folder, { recursive: true });
      yield* send(started.threadId, "Again");
      yield* settle(started.missionId, (d) => d.thread.blocker === "MissingWorkspace");
      yield* setBudget(started.missionId, { cost: null, tokens: 50 });
      yield* settle(started.missionId, isHeldByBudget, child.threadId);
      expect((yield* read(started.missionId)).thread.blocker).toBe("MissingWorkspace");
    }).pipe(Effect.provide(value.layer));
  });
});
