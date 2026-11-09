import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import type { ModelChoice, StartingContext, ThreadId } from "@gild/contracts";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { approvalInstructionsOf } from "../src/instructions.ts";
import { tokensOf } from "../src/journal.ts";
import { sandboxProblem } from "../src/sandbox.ts";
import { prepareStartingContext } from "../src/startingContext.ts";
import { call, fixture, open, read, send, settle, start, tool } from "./fixtures/service.ts";

// Stored and wire names keep `intel` so existing data and agents still work: request tags (`"ListIntel"`, ...) and thread tool names (`save_intel`, ...).

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
/** The whole starting context as the sum of its parts. */
const sumOf = (context: StartingContext) => Object.values(context.parts).reduce((sum, part) => sum + part, 0);
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
  it.live("counts the request, the journal, the lore in scope, and the opener's messages", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      yield* tool(threadId, "save_intel", { kind: "fact", scope: "thread", text: "The owner prefers short replies." });
      const shown = yield* preview(threadId, "y".repeat(400));
      expect(shown.parts.request).toBe(100);
      // The new thread recalls its opener's lore, as its opener's own turns carry it.
      const { note } = yield* prepareStartingContext(threadId);
      expect(shown.parts.lore).toBe(tokensOf(note.slice(note.indexOf("# Lore at this turn"))));
      expect(shown.parts.lore).toBeGreaterThan((yield* read(missionId, threadId)).loreGauge.tokens);
      expect(shown.parts.journal).toBeGreaterThan(0);
      expect(shown.parts.openerMessages).toBeGreaterThan(0);
      expect(shown.tokens).toBe(sumOf(shown));
      expect(shown).toMatchObject({ isOverWarning: false, warningPercent: 25, windowTokens: 200_000 });
    }).pipe(Effect.provide(layer));
  });

  it.live("counts global lore as its index line", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { threadId } = yield* idle();
      const before = (yield* preview(threadId, "Go on.")).parts.lore;
      yield* tool(threadId, "save_intel", { kind: "fact", scope: "global", text: "The owner works in Europe." });
      const [change] = (yield* call({ _tag: "ListIntel", scope: null, state: null, threadId: null })).awaiting;
      if (change === undefined) return yield* Effect.die(new Error("The global save awaits no approval."));
      yield* call({ _tag: "ResolveIntelChange", changeId: change.id, isApproved: true });
      const after = (yield* preview(threadId, "Go on.")).parts.lore;
      expect(after - before).toBeGreaterThanOrEqual(tokensOf("The owner works in Europe."));
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

  it.live("counts the workspace's own instructions", () => {
    const { directory, layer } = live();
    const app = join(directory, "app");
    mkdirSync(app);
    writeFileSync(join(app, "AGENTS.md"), "a".repeat(8_000));
    return Effect.gen(function* () {
      const started = yield* start("Hello", app);
      yield* settle(started.missionId, (d) => d.thread.state === "Idle");
      const shown = yield* preview(started.threadId, "Go on.");
      expect(shown.parts.workspace).toBeGreaterThan(2_000);
      expect(shown.tokens).toBe(sumOf(shown));
    }).pipe(Effect.provide(layer));
  });

  it.live("counts the instructions every thread receives, its title line, and the budget line", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      const bare = yield* preview(threadId, "Go on.");
      expect(bare.parts.instructions).toBeGreaterThan(1_000);
      expect(bare.parts.position).toBeGreaterThan(0);
      expect(bare.parts.budget).toBe(0);
      yield* call({ _tag: "SetMissionBudget", limits: { cost: null, tokens: 1000 }, missionId });
      const budgeted = yield* preview(threadId, "Go on.");
      expect(budgeted.parts.budget).toBeGreaterThan(0);
      expect(budgeted.tokens).toBe(sumOf(budgeted));
    }).pipe(Effect.provide(layer));
  });

  it.live("measures the starting context the new thread then receives", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      yield* tool(threadId, "save_intel", { kind: "fact", scope: "thread", text: "The owner prefers short replies." });
      yield* call({ _tag: "SetMissionBudget", limits: { cost: null, tokens: 1000 }, missionId });
      const request = "Summarize what the owner said.";
      const shown = yield* preview(threadId, request);
      const child = yield* open(threadId, request);
      const received = yield* prepareStartingContext(child.threadId);
      const { approvalLevel } = yield* call({ _tag: "ReadSettings" });
      const isSandboxed = approvalLevel === "RiskyOnly" && (yield* sandboxProblem) === null;
      const access = { approvalLevel, isInWorkspace: false, mcpUrl: "", permissions: [] };
      const approval = approvalInstructionsOf(access, isSandboxed, "claude");
      const tokens = tokensOf(received.context) + tokensOf(approval) + tokensOf(received.note) + tokensOf(request);
      // Each part is rounded up and the separators between parts are left out.
      expect(Math.abs(shown.tokens - tokens)).toBeLessThanOrEqual(Object.keys(shown.parts).length);
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

describe("assembling a thread's starting context", () => {
  it.live("puts the working folder and the fixed instructions in the system part, and the title in the note", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      yield* call({ _tag: "RenameMission", missionId, title: "Release planning" });
      const { context, cwd, isInWorkspace, note } = yield* prepareStartingContext(threadId);
      expect(isInWorkspace).toBe(false);
      expect(context).toContain(
        `# Your working folder\nYou have no workspace. You work in your quest's scratch folder, ${cwd},`,
      );
      expect(context).toContain(`You are thread ${threadId} in a Gild quest`);
      expect(context).toContain("# Quest journal\n");
      expect(context).toContain("# Lore\n");
      expect(context).not.toContain("Release planning");
      expect(note.startsWith('Your title: "Release planning".\n\n# Quest journal at this turn\n')).toBe(true);
      expect(note).toContain("# Lore at this turn");
      expect(note).not.toContain("Budget:");
    }).pipe(Effect.provide(layer));
  });

  it.live("gives a thread beneath its opener's messages and the budget line", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* idle("Plan the release.");
      yield* call({ _tag: "SetMissionBudget", limits: { cost: null, tokens: 1000 }, missionId });
      const child = yield* open(threadId, "Draft the notes.");
      const { context, note } = yield* prepareStartingContext(child.threadId);
      expect(context).toContain(`Thread ${threadId} opened you.`);
      expect(note).toContain(`thread ${threadId}, which opened you, is "`);
      expect(note).toContain("# Your opener's messages since the latest journal entry\n");
      expect(note).toContain("Owner:\nPlan the release.");
      expect(note.endsWith("At a limit, Gild stops the work under it and asks the owner.")).toBe(true);
    }).pipe(Effect.provide(layer));
  });

  it.live("keeps the system part the same across a rename", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      const before = yield* prepareStartingContext(threadId);
      yield* call({ _tag: "RenameMission", missionId, title: "Renamed mission" });
      const after = yield* prepareStartingContext(threadId);
      expect(after.context).toBe(before.context);
      expect(after.note).not.toBe(before.note);
    }).pipe(Effect.provide(layer));
  });
});
