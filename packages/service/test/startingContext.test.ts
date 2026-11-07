import { describe, expect, it } from "@effect/vitest";
import type { ModelChoice, ThreadId } from "@openmission/contracts";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { call, fixture, read, send, settle, start, tool } from "./fixtures/batch7.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
const live = () => {
  const value = fixture();
  fixtures.push(value);
  return value;
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

const preview = (parentThreadId: ThreadId, text: string, model: ModelChoice = "default") =>
  call({ _tag: "PreviewStartingContext", model, parentThreadId, text });
const openBeneath = (parentThreadId: ThreadId, text: string, shouldStartAnyway: boolean) =>
  call({
    _tag: "OpenThread",
    effort: "default",
    model: "default",
    parentThreadId,
    requestId: crypto.randomUUID(),
    shouldStartAnyway,
    text,
  }).pipe(
    Effect.flip,
    Effect.map((failure) => failure.message),
    Effect.orElseSucceed(() => "opened"),
  );
/** A mission whose top thread has finished its first turn. */
const idle = (text = "Hello") =>
  Effect.gen(function* () {
    const started = yield* start(text);
    yield* settle(started.missionId, (d) => d.thread.state === "Idle");
    return started;
  });
/** A mission whose top thread holds three long owner messages since the journal's latest entry. */
const crowded = () =>
  Effect.gen(function* () {
    const started = yield* idle();
    for (let index = 0; index < 3; index++) {
      const before = (yield* read(started.missionId, started.threadId)).messages.length;
      yield* send(started.threadId, `${index} ${"x".repeat(80_000)}`);
      yield* settle(
        started.missionId,
        (d) => d.thread.state === "Idle" && d.messages.length >= before + 2,
        started.threadId,
      );
    }
    return started;
  });

describe("previewing a new thread's starting context", () => {
  it.live("counts the request, the journal, the intel in scope, and the opener's messages", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      yield* tool(threadId, "save_intel", { kind: "fact", scope: "thread", text: "The owner prefers short replies." });
      const shown = yield* preview(threadId, "y".repeat(400));
      expect(shown.parts.request).toBe(100);
      expect(shown.parts.intel).toBe((yield* read(missionId, threadId)).intelGauge.tokens);
      expect(shown.parts.intel).toBeGreaterThan(0);
      expect(shown.parts.journal).toBeGreaterThan(0);
      expect(shown.parts.openerMessages).toBeGreaterThan(0);
      expect(shown.tokens).toBe(
        shown.parts.request + shown.parts.journal + shown.parts.intel + shown.parts.openerMessages,
      );
      expect(shown).toMatchObject({ isOverWarning: false, warningPercent: 25, windowTokens: 200_000 });
    }).pipe(Effect.provide(layer));
  });

  it.live("counts global intel as its index line", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { threadId } = yield* idle();
      expect((yield* preview(threadId, "Go on.")).parts.intel).toBe(0);
      yield* tool(threadId, "save_intel", { kind: "fact", scope: "global", text: "The owner works in Europe." });
      const [change] = (yield* call({ _tag: "ListIntel", scope: null, state: null, threadId: null })).awaiting;
      if (change === undefined) return yield* Effect.die(new Error("The global save awaits no approval."));
      yield* call({ _tag: "ResolveIntelChange", changeId: change.id, isApproved: true });
      expect((yield* preview(threadId, "Go on.")).parts.intel).toBeGreaterThan(0);
    }).pipe(Effect.provide(layer));
  });

  it.live("warns past a quarter of the chosen model's context window", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { threadId } = yield* crowded();
      const shown = yield* preview(threadId, "Summarize the long messages.", "sonnet");
      expect(shown.parts.openerMessages).toBeGreaterThan(50_000);
      expect(shown).toMatchObject({ isOverWarning: true, windowTokens: 200_000 });
    }).pipe(Effect.provide(layer));
  });

  it.live("offers no larger model while every model has the same context window", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { threadId } = yield* crowded();
      expect((yield* preview(threadId, "Go on.")).largerModels).toEqual([]);
    }).pipe(Effect.provide(layer));
  });

  it.live("refuses an unknown parent thread", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const failure = yield* preview(crypto.randomUUID() as ThreadId, "Go on.").pipe(Effect.flip);
      expect(failure.message).toBe("No such thread.");
    }).pipe(Effect.provide(layer));
  });
});

describe("opening a thread with a large starting context", () => {
  it.live("refuses to start it until the owner chooses to start anyway", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* crowded();
      const refusal = yield* openBeneath(threadId, "Summarize the long messages.", false);
      expect(refusal).toMatch(/^Not started: its starting context takes about \d+% of the model's context window/);
      expect((yield* read(missionId, threadId)).threads).toHaveLength(1);
      expect(yield* openBeneath(threadId, "Summarize the long messages.", true)).toBe("opened");
      expect((yield* read(missionId, threadId)).threads).toHaveLength(2);
    }).pipe(Effect.provide(layer));
  });

  it.live("starts a thread whose starting context stays under the warning without asking", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      expect(yield* openBeneath(threadId, "A small request.", false)).toBe("opened");
      expect((yield* read(missionId, threadId)).threads).toHaveLength(2);
    }).pipe(Effect.provide(layer));
  });
});
