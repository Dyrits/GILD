import { describe, expect, it } from "@effect/vitest";
import type { ThreadId } from "@gild/contracts";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { call, fixture, open, send, settle, start } from "./fixtures/service.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
const live = () => {
  const value = fixture();
  fixtures.push(value);
  return value;
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

const panelOf = (threadId: ThreadId) => call({ _tag: "ReadThreadPanel", threadId });
const kindsOf = (parts: ReadonlyArray<{ kind: string }>) => parts.map((part) => part.kind);

describe("reading a thread's panel", () => {
  it.live("shows no context and no spending for a thread that reported no usage", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* start("Hello");
      yield* settle(missionId, (d) => d.thread.state === "Idle");
      expect(yield* panelOf(threadId)).toMatchObject({
        context: null,
        spending: { cost: 0, tokens: 0 },
        turnCount: 0,
      });
    }).pipe(Effect.provide(layer));
  });

  it.live("splits the reported context into parts that add up to the total", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* start("spend 100000");
      yield* settle(missionId, (d) => d.thread.state === "Idle");
      const { context } = yield* panelOf(threadId);
      expect(context).not.toBeNull();
      expect(context?.tokens).toBe(100_000);
      expect(context?.windowTokens).toBe(200_000);
      expect(kindsOf(context?.parts ?? [])).toEqual(["Instructions", "Lore", "Journal", "Messages", "ToolsAndResults"]);
      expect(context?.parts.reduce((sum, part) => sum + part.tokens, 0)).toBe(100_000);
      expect(context?.parts.every((part) => part.tokens >= 0)).toBe(true);
      expect(context?.parts.find((part) => part.kind === "Instructions")?.tokens).toBeGreaterThan(0);
      expect(context?.parts.find((part) => part.kind === "ToolsAndResults")?.tokens).toBeGreaterThan(0);
    }).pipe(Effect.provide(layer));
  });

  it.live("scales the counted parts down when they exceed the reported total", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* start("spend 10");
      yield* settle(missionId, (d) => d.thread.state === "Idle");
      const { context } = yield* panelOf(threadId);
      expect(context?.tokens).toBe(10);
      expect(context?.parts.reduce((sum, part) => sum + part.tokens, 0)).toBe(10);
      expect(context?.parts.every((part) => part.tokens >= 0)).toBe(true);
    }).pipe(Effect.provide(layer));
  });

  it.live("keeps the latest turn's measure, not a sum over turns", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* start("spend 5000");
      yield* settle(missionId, (d) => d.thread.state === "Idle");
      yield* send(threadId, "spend 7000");
      yield* settle(missionId, (d) => d.thread.state === "Idle" && d.messages.length >= 4);
      const panel = yield* panelOf(threadId);
      expect(panel.context?.tokens).toBe(7000);
      expect(panel.turnCount).toBe(2);
    }).pipe(Effect.provide(layer));
  });

  it.live("counts what only this thread spent, beside the mission's budget", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* start("spend 1000 1.5");
      yield* settle(missionId, (d) => d.thread.state === "Idle");
      const opened = yield* open(threadId, "spend 400");
      yield* settle(missionId, (d) => d.thread.state === "Idle", opened.threadId);
      const parent = yield* panelOf(threadId);
      const side = yield* panelOf(opened.threadId);
      expect(parent.spending).toEqual({ cost: 1.5, tokens: 0 });
      expect(side.spending).toEqual({ cost: 0, tokens: 400 });
      expect(side.context?.tokens).toBe(400);
      expect(side.budget.spent).toEqual({ cost: 1.5, tokens: 400 });
      expect(parent.budget.spent).toEqual(side.budget.spent);
    }).pipe(Effect.provide(layer));
  });

  it.live("refuses a thread that does not exist", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const failure = yield* panelOf("no-such-thread" as ThreadId).pipe(Effect.flip);
      expect(JSON.stringify(failure)).toContain("No such thread");
    }).pipe(Effect.provide(layer));
  });
});
