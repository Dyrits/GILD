import { describe, expect, it } from "@effect/vitest";
import type { LoreScope, MissionId, ThreadId } from "@gild/contracts";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { call, fixture, open, read, send, settle, start, tool } from "./fixtures/service.ts";

// Stored and wire names keep `intel` so existing data and agents still work: request tags (`"ListIntel"`, ...), thread tool names (`save_intel`, ...) and settings keys (`intelHalfLives`, `intelWarningPercent`).

const fixtures: ReturnType<typeof fixture>[] = [];
const live = () => {
  const value = fixture();
  fixtures.push(value);
  return value;
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

const save = (threadId: ThreadId, text: string, scope: string) =>
  tool(threadId, "save_intel", { kind: "fact", scope, text });
const panel = (threadId: ThreadId | null = null, scope: LoreScope | null = null) =>
  call({ _tag: "ListIntel", scope, state: null, threadId });
/** A mission whose top thread has finished its first turn, in a workspace or the scratch folder. */
const idle = (workspacePath: string | null = null, text = "Hello") =>
  Effect.gen(function* () {
    const started = yield* start(text, workspacePath);
    yield* settle(started.missionId, (d) => d.thread.state === "Idle");
    return started;
  });
/** The context a thread's next turn receives, as the fake harness echoes it. */
const contextOf = (missionId: MissionId, threadId: ThreadId) =>
  Effect.gen(function* () {
    const before = (yield* read(missionId, threadId)).messages.filter((m) => m.sender === "agent").length;
    yield* send(threadId, "context");
    const detail = yield* settle(
      missionId,
      (d) => d.thread.state === "Idle" && d.messages.filter((m) => m.sender === "agent").length > before,
      threadId,
    );
    return detail.messages.findLast((m) => m.sender === "agent")?.text ?? "";
  });
/** A thread opened beneath `parentId` that has finished its first turn. */
const child = (missionId: MissionId, parentId: ThreadId) =>
  Effect.gen(function* () {
    const opened = yield* open(parentId, "Hello");
    yield* settle(missionId, (d) => d.thread.state === "Idle", opened.threadId);
    return opened.threadId;
  });
const approveAll = (isApproved = true) =>
  Effect.gen(function* () {
    for (const change of (yield* panel()).awaiting) {
      yield* call({ _tag: "ResolveIntelChange", changeId: change.id, isApproved });
    }
  });
const idOf = (answer: string) => /lore entry (\S+?)[ .]/.exec(answer)?.[1] ?? "";

describe("saving lore", () => {
  it.live("saves thread lore without approval and shows the save in the thread", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      const answer = yield* save(threadId, "The owner prefers short replies.", "thread");
      expect(answer).toContain("Saved lore entry");
      const detail = yield* read(missionId, threadId);
      expect(detail.loreChanges).toMatchObject([
        { kind: "Save", scope: "Thread", status: "Done", text: "The owner prefers short replies." },
      ]);
      expect((yield* panel(threadId)).loreEntries.map((loreEntry) => loreEntry.text)).toEqual([
        "The owner prefers short replies.",
      ]);
    }).pipe(Effect.provide(layer));
  });

  it.live("refuses a lore entry over 200 tokens with its reason", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { threadId } = yield* idle();
      const answer = yield* save(threadId, "x".repeat(801), "thread");
      expect(answer).toContain("201 tokens");
      expect((yield* panel()).loreEntries).toEqual([]);
      expect(yield* save(threadId, "x".repeat(800), "thread")).toContain("Saved lore entry");
    }).pipe(Effect.provide(layer));
  });

  it.live("refuses workspace lore for a thread without a workspace", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { threadId } = yield* idle();
      expect(yield* save(threadId, "Tests run with bun.", "workspace")).toContain("no workspace");
      expect((yield* panel()).loreEntries).toEqual([]);
    }).pipe(Effect.provide(layer));
  });

  it.live("holds a global save until the owner approves it", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      const answer = yield* save(threadId, "The owner writes in British English.", "global");
      expect(answer).toContain("Awaiting approval");
      expect((yield* panel()).loreEntries).toEqual([]);
      expect((yield* panel()).awaiting).toMatchObject([{ kind: "Save", scope: "Global", status: "Awaiting" }]);
      expect(yield* contextOf(missionId, threadId)).not.toContain("British English");
      yield* approveAll();
      expect((yield* panel()).loreEntries).toMatchObject([
        { scope: "Global", text: "The owner writes in British English." },
      ]);
      expect((yield* read(missionId, threadId)).loreChanges).toMatchObject([{ status: "Approved" }]);
      expect(yield* contextOf(missionId, threadId)).toContain("British English");
    }).pipe(Effect.provide(layer));
  });

  it.live("saves nothing when the owner declines a global save", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      yield* save(threadId, "The owner writes in British English.", "global");
      yield* approveAll(false);
      expect((yield* panel()).loreEntries).toEqual([]);
      expect((yield* panel()).awaiting).toEqual([]);
      expect((yield* read(missionId, threadId)).loreChanges).toMatchObject([{ status: "Declined" }]);
    }).pipe(Effect.provide(layer));
  });

  it.live("tells every thread to save a rule the owner gives in a chat", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      const context = yield* contextOf(missionId, threadId);
      expect(context).toContain("# Lore");
      expect(context).toContain("always run the tests before a commit");
      expect(context).toContain("save_intel");
    }).pipe(Effect.provide(layer));
  });
});

describe("recalling lore", () => {
  it.live("starts a new thread with all the lore in its scope", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      yield* save(threadId, "The release ships on Friday.", "thread");
      const beneath = yield* child(missionId, threadId);
      const context = yield* contextOf(missionId, beneath);
      expect(context).toContain("The release ships on Friday.");
    }).pipe(Effect.provide(layer));
  });

  it.live("keeps a thread's lore from the threads above and beside it", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      const first = yield* child(missionId, threadId);
      const second = yield* child(missionId, threadId);
      yield* save(first, "Only the first child knows this.", "thread");
      expect(yield* contextOf(missionId, threadId)).not.toContain("Only the first child");
      expect(yield* contextOf(missionId, second)).not.toContain("Only the first child");
    }).pipe(Effect.provide(layer));
  });

  it.live("shares workspace lore with another mission in the same workspace only", () => {
    const { directory, layer } = live();
    return Effect.gen(function* () {
      const first = yield* idle(directory);
      expect(yield* save(first.threadId, "Run the tests before a commit.", "workspace")).toContain("Saved lore entry");
      const second = yield* idle(directory);
      expect(yield* contextOf(second.missionId, second.threadId)).toContain("Run the tests before a commit.");
      const elsewhere = yield* idle();
      expect(yield* contextOf(elsewhere.missionId, elsewhere.threadId)).not.toContain("Run the tests");
    }).pipe(Effect.provide(layer));
  });

  it.live("saves mission lore on the top thread from a thread beneath", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      const first = yield* child(missionId, threadId);
      const second = yield* child(missionId, threadId);
      yield* save(first, "The mission targets macOS first.", "mission");
      expect(yield* contextOf(missionId, second)).toContain("The mission targets macOS first.");
      expect((yield* panel()).loreEntries).toMatchObject([{ scope: "Thread" }]);
    }).pipe(Effect.provide(layer));
  });

  it.live("searches the thread, the threads above, the workspace, then globally, most specific first", () => {
    const { directory, layer } = live();
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* idle(directory);
      yield* save(threadId, "Deploy target: global default.", "global");
      yield* approveAll();
      yield* save(threadId, "Deploy target: the workspace staging server.", "workspace");
      yield* save(threadId, "Deploy target: the mission's preview server.", "thread");
      const beneath = yield* child(missionId, threadId);
      yield* save(beneath, "Deploy target: this thread's local machine.", "thread");
      const found = yield* tool(beneath, "search_intel", { query: "deploy target" });
      const order = ["local machine", "preview server", "staging server", "global default"];
      const positions = order.map((part) => found.indexOf(part));
      expect(positions.every((position) => position >= 0)).toBe(true);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
      expect(yield* tool(beneath, "search_intel", { query: "deploy", scope: "workspace" })).not.toContain("preview");
      expect(yield* tool(beneath, "search_intel", { query: "unrelated words" })).toContain("No lore");
      const context = yield* contextOf(missionId, beneath);
      expect(context.indexOf("local machine")).toBeLessThan(context.indexOf("global default"));
      expect(context).toContain("listed first wins");
    }).pipe(Effect.provide(layer));
  });
});

describe("correcting and deleting lore", () => {
  it.live("lets a thread correct and delete thread and workspace lore on its own", () => {
    const { directory, layer } = live();
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* idle(directory);
      const id = idOf(yield* save(threadId, "Tests run with npm.", "workspace"));
      expect(yield* tool(threadId, "update_intel", { id, text: "Tests run with bun." })).toContain("Updated");
      expect((yield* panel()).loreEntries.map((loreEntry) => loreEntry.text)).toEqual(["Tests run with bun."]);
      expect(yield* tool(threadId, "forget_intel", { id })).toContain("Deleted");
      expect((yield* panel()).loreEntries).toEqual([]);
      expect((yield* read(missionId, threadId)).loreChanges.map((change) => change.kind)).toEqual([
        "Save",
        "Update",
        "Forget",
      ]);
    }).pipe(Effect.provide(layer));
  });

  it.live("holds a change or deletion of global lore until the owner approves it", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { threadId } = yield* idle();
      yield* save(threadId, "The owner's name is Sam.", "global");
      yield* approveAll();
      const id = (yield* panel()).loreEntries[0]?.id ?? "";
      expect(yield* tool(threadId, "update_intel", { id, text: "The owner's name is Alex." })).toContain(
        "Awaiting approval",
      );
      expect((yield* panel()).loreEntries[0]?.text).toBe("The owner's name is Sam.");
      yield* approveAll();
      expect((yield* panel()).loreEntries[0]?.text).toBe("The owner's name is Alex.");
      expect(yield* tool(threadId, "forget_intel", { id })).toContain("Awaiting approval");
      expect((yield* panel()).loreEntries).toHaveLength(1);
      yield* approveAll();
      expect((yield* panel()).loreEntries).toEqual([]);
    }).pipe(Effect.provide(layer));
  });

  it.live("refuses a change to lore outside the thread's scope", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      const first = yield* child(missionId, threadId);
      const second = yield* child(missionId, threadId);
      const id = idOf(yield* save(first, "A fact of the first child.", "thread"));
      expect(yield* tool(second, "update_intel", { id, text: "Changed." })).toContain("Not changed");
      expect(yield* tool(second, "forget_intel", { id })).toContain("Not deleted");
      expect((yield* panel()).loreEntries.map((loreEntry) => loreEntry.text)).toEqual(["A fact of the first child."]);
    }).pipe(Effect.provide(layer));
  });

  it.live("holds a widening until the owner approves it", () => {
    const { directory, layer } = live();
    return Effect.gen(function* () {
      const { threadId } = yield* idle(directory);
      const id = idOf(yield* save(threadId, "The owner likes tables.", "thread"));
      expect(yield* tool(threadId, "update_intel", { id, scope: "global" })).toContain("Awaiting approval");
      expect((yield* panel()).loreEntries[0]?.scope).toBe("Thread");
      expect(yield* tool(threadId, "update_intel", { id, scope: "thread" })).toContain("Not changed");
      yield* approveAll();
      expect((yield* panel()).loreEntries[0]?.scope).toBe("Global");
    }).pipe(Effect.provide(layer));
  });
});

describe("managing lore in the panel", () => {
  it.live("lists lore with its scope, saver, and time, filtered by scope", () => {
    const { directory, layer } = live();
    return Effect.gen(function* () {
      const { threadId } = yield* idle(directory, "Plan the release");
      yield* save(threadId, "A workspace fact.", "workspace");
      yield* save(threadId, "A thread fact.", "thread");
      const all = yield* panel();
      expect(all.loreEntries).toHaveLength(2);
      expect(all.loreEntries.find((loreEntry) => loreEntry.scope === "Thread")).toMatchObject({
        savedByTitle: "Plan the release",
        scopeLabel: expect.stringContaining("Plan the release"),
      });
      expect(all.loreEntries.every((loreEntry) => loreEntry.savedAt > 0)).toBe(true);
      expect((yield* panel(null, "Workspace")).loreEntries.map((loreEntry) => loreEntry.text)).toEqual([
        "A workspace fact.",
      ]);
    }).pipe(Effect.provide(layer));
  });

  it.live("lets the owner edit and delete any lore", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { threadId } = yield* idle();
      yield* save(threadId, "The owner's name is Sam.", "global");
      yield* approveAll();
      const id = (yield* panel()).loreEntries[0]?.id;
      if (id === undefined) return expect.unreachable();
      yield* call({ _tag: "EditIntel", loreEntryId: id, text: "The owner's name is Alex." });
      expect((yield* panel()).loreEntries[0]?.text).toBe("The owner's name is Alex.");
      yield* call({ _tag: "DeleteIntel", loreEntryId: id });
      expect((yield* panel()).loreEntries).toEqual([]);
    }).pipe(Effect.provide(layer));
  });

  it.live("erases a deleted thread's lore and its awaiting changes", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      const beneath = yield* child(missionId, threadId);
      yield* save(beneath, "Belongs to the child.", "thread");
      yield* save(beneath, "Proposed by the child.", "global");
      const preview = yield* call({ _tag: "PreviewDeletion", threadId: beneath });
      yield* call({ _tag: "DeleteThread", confirmation: preview.confirmation, threadId: beneath });
      expect((yield* panel()).loreEntries).toEqual([]);
      expect((yield* panel()).awaiting).toEqual([]);
    }).pipe(Effect.provide(layer));
  });
});

describe("warning about lore size", () => {
  it.live("turns the lore icon red past the warning share of the model's context window", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const settings = yield* call({ _tag: "ReadSettings" });
      expect(settings.intelWarningPercent).toBe(10);
      yield* call({ _tag: "UpdateSettings", settings: { ...settings, intelWarningPercent: 1 } });
      const { missionId, threadId } = yield* idle();
      for (let index = 0; index < 10; index++) yield* save(threadId, `${index} ${"x".repeat(790)}`, "thread");
      const under = (yield* read(missionId, threadId)).loreGauge;
      expect(under).toMatchObject({ count: 10, isOverWarning: false, warningPercent: 1, windowTokens: 200_000 });
      yield* save(threadId, "y".repeat(400), "thread");
      const over = (yield* read(missionId, threadId)).loreGauge;
      expect(over.isOverWarning).toBe(true);
      expect(over.tokens).toBeGreaterThan(2000);
      expect((yield* panel(threadId)).gauge).toMatchObject({ isOverWarning: true });
    }).pipe(Effect.provide(layer));
  });
});

describe("a realm's lore", () => {
  it.live("lists the realm's own deleted lore and no other", () => {
    const { directory, layer } = live();
    return Effect.gen(function* () {
      const { threadId } = yield* idle(directory);
      const { workspaces } = yield* call({
        _tag: "ListMissions",
        isArchived: false,
        search: null,
        state: null,
        workspaceId: null,
      });
      const workspaceId = workspaces[0]?.id ?? null;
      const id = idOf(yield* save(threadId, "The realm uses tabs.", "workspace"));
      const otherId = idOf(yield* save(threadId, "A fact of this thread.", "thread"));
      yield* tool(threadId, "forget_intel", { id });
      yield* tool(threadId, "forget_intel", { id: otherId });
      yield* approveAll();
      const view = yield* call({ _tag: "ListIntel", scope: null, state: "Deleted", threadId: null, workspaceId });
      expect(view.deleted.map((loreEntry) => loreEntry.text)).toEqual(["The realm uses tabs."]);
    }).pipe(Effect.provide(layer));
  });
});
