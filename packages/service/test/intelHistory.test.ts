import { describe, expect, it } from "@effect/vitest";
import type { IntelHistoryEntry, IntelId, ThreadId } from "@openmission/contracts";
import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { afterEach } from "vitest";
import { call, fixture, open, start, tool } from "./fixtures/batch7.ts";

// Batch 15 (scoped-intel: History and undo), on the test clock.

const fixtures: ReturnType<typeof fixture>[] = [];
const live = () => {
  const value = fixture();
  fixtures.push(value);
  return value;
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

const day = 24 * 60 * 60 * 1000;
const advance = (millis: number) =>
  Effect.gen(function* () {
    yield* TestClock.adjust(millis);
    for (let i = 0; i < 40; i++) yield* Effect.yieldNow;
  });
const settleTurns = Effect.gen(function* () {
  for (let i = 0; i < 5; i++) yield* advance(20);
});
const idle = (text = "Hello", workspacePath: string | null = null) =>
  Effect.gen(function* () {
    const started = yield* start(text, workspacePath);
    yield* settleTurns;
    return started;
  });
const save = (threadId: ThreadId, text: string, scope: string, kind: string) =>
  tool(threadId, "save_intel", { kind, scope, text });
const idOf = (answer: string) => (/intel (\S+?)[ .:]/.exec(answer)?.[1] ?? "") as IntelId;
const panel = (state: "Deleted" | null = null) => call({ _tag: "ListIntel", scope: null, state, threadId: null });
const intelOf = (id: string) => panel().pipe(Effect.map((view) => view.intels.find((intel) => intel.id === id)));
const historyOf = (intelId: IntelId) => call({ _tag: "ReadIntelHistory", intelId });
const kindsOf = (entries: ReadonlyArray<IntelHistoryEntry>) => entries.map((entry) => entry.kind);
const entryOf = (entries: ReadonlyArray<IntelHistoryEntry>, kind: IntelHistoryEntry["kind"]) => {
  const found = entries.find((entry) => entry.kind === kind);
  if (found === undefined) throw new Error(`no ${kind} entry in ${kindsOf(entries).join(", ")}`);
  return found;
};
const undo = (entry: IntelHistoryEntry) => call({ _tag: "UndoIntelChange", entryId: entry.id });
const approveAll = Effect.gen(function* () {
  for (const change of (yield* panel()).awaiting) {
    yield* call({ _tag: "ResolveIntelChange", changeId: change.id, isApproved: true });
  }
});

describe("recording an intel's history", () => {
  it.effect("records each change, newest first, with who made it and when", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      const id = idOf(yield* save(threadId, "The build takes two minutes.", "mission", "fact"));
      yield* advance(1000);
      yield* tool(threadId, "update_intel", { id, text: "The build takes three minutes." });
      yield* advance(1000);
      yield* call({ _tag: "EditIntel", intelId: id, text: "The build takes four minutes." });
      yield* call({ _tag: "PinIntel", intelId: id, isPinned: true });
      yield* call({ _tag: "PinIntel", intelId: id, isPinned: false });
      yield* advance(1000);
      yield* call({ _tag: "DeleteIntel", intelId: id });
      const history = yield* historyOf(id);
      expect(history.isDeleted).toBe(true);
      expect(kindsOf(history.entries)).toEqual(["Deleted", "Unpinned", "Pinned", "Edited", "Corrected", "Saved"]);
      const [deleted, , , edited, corrected, saved] = history.entries;
      expect(saved).toMatchObject({ actor: "Thread", previousText: null, text: "The build takes two minutes." });
      expect(saved?.actorTitle).not.toBeNull();
      expect(corrected).toMatchObject({
        actor: "Thread",
        previousText: "The build takes two minutes.",
        text: "The build takes three minutes.",
      });
      expect(edited).toMatchObject({ actor: "Owner", actorTitle: null, text: "The build takes four minutes." });
      expect(deleted).toMatchObject({ actor: "Owner", previousText: "The build takes four minutes.", text: null });
      expect((deleted?.at ?? 0) - (saved?.at ?? 0)).toBeGreaterThanOrEqual(3000);
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("names the text a replacement replaced and the thread whose save replaced it", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      const id = idOf(yield* save(threadId, "The owner prefers pnpm.", "mission", "preference"));
      yield* save(threadId, "The owner prefers Bun.", "mission", "preference");
      const replaced = entryOf((yield* historyOf(id)).entries, "Replaced");
      expect(replaced).toMatchObject({
        actor: "Thread",
        previousText: "The owner prefers pnpm.",
        text: "The owner prefers Bun.",
      });
      expect(replaced.actorTitle).not.toBeNull();
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("records when the owner approved a global save and a widening", () => {
    const { directory, layer } = live();
    return Effect.gen(function* () {
      const { threadId } = yield* idle("Hello", directory);
      const id = idOf(yield* save(threadId, "Tests run with Vitest here.", "workspace", "fact"));
      yield* tool(threadId, "update_intel", { id, scope: "global" });
      expect(kindsOf((yield* historyOf(id)).entries)).toEqual(["Saved"]);
      yield* approveAll;
      const widened = entryOf((yield* historyOf(id)).entries, "Widened");
      expect(widened).toMatchObject({ actor: "Thread", scopeLabel: "Global" });
      expect(widened.approvedAt).not.toBeNull();
      yield* save(threadId, "The owner writes in British English.", "global", "preference");
      yield* approveAll;
      const global = (yield* panel()).intels.find((intel) => intel.text === "The owner writes in British English.");
      const saved = entryOf((yield* historyOf(global?.id ?? ("" as IntelId))).entries, "Saved");
      expect(saved.approvedAt).not.toBeNull();
    }).pipe(Effect.provide(layer));
  });

  it.effect("leaves a declined change out of the history", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      yield* save(threadId, "The owner writes in British English.", "global", "preference");
      yield* approveAll;
      const [intel] = (yield* panel()).intels;
      yield* tool(threadId, "forget_intel", { id: intel?.id });
      for (const change of (yield* panel()).awaiting) {
        yield* call({ _tag: "ResolveIntelChange", changeId: change.id, isApproved: false });
      }
      expect(kindsOf((yield* historyOf(intel?.id ?? ("" as IntelId))).entries)).toEqual(["Saved"]);
    }).pipe(Effect.provide(live().layer)),
  );
});

describe("recording fading steps", () => {
  it.effect("shows when an intel became dormant and archived, and keeps them after a restore", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      const id = idOf(yield* save(threadId, "The API is flaky this week.", "mission", "temporary"));
      const savedAt = entryOf((yield* historyOf(id)).entries, "Saved").at;
      yield* advance(20 * day);
      const faded = (yield* historyOf(id)).entries;
      expect(kindsOf(faded)).toEqual(["Archived", "Dormant", "Saved"]);
      const dormant = entryOf(faded, "Dormant");
      // A temporary intel's half-life is 3 days: dormant below 0.15 after 3 × log2(1 / 0.15) days.
      expect((dormant.at - savedAt) / day).toBeCloseTo(3 * Math.log2(1 / 0.15), 3);
      expect((entryOf(faded, "Archived").at - savedAt) / day).toBeCloseTo(3 * Math.log2(1 / 0.05), 3);
      expect(dormant).toMatchObject({ actor: "Fading", canUndo: false });
      yield* call({ _tag: "RestoreIntel", intelId: id });
      expect(kindsOf((yield* historyOf(id)).entries)).toEqual(["Restored", "Archived", "Dormant", "Saved"]);
      expect(yield* undo(dormant).pipe(Effect.flip)).toMatchObject({ kind: "InvalidInput" });
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("keeps a dormant step after a use made the intel active again", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      const id = idOf(yield* save(threadId, "The API is flaky this week.", "mission", "temporary"));
      yield* advance(10 * day);
      yield* tool(threadId, "search_intel", { ids: [id] });
      yield* advance(1 * day);
      expect(kindsOf((yield* historyOf(id)).entries)).toEqual(["Dormant", "Saved"]);
      expect((yield* intelOf(id))?.state).toBe("Active");
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect(
    "records no fading step for a rule",
    () =>
      Effect.gen(function* () {
        const { threadId } = yield* idle();
        const id = idOf(yield* save(threadId, "Always run the tests before a commit.", "mission", "rule"));
        yield* advance(400 * day);
        expect(kindsOf((yield* historyOf(id)).entries)).toEqual(["Saved"]);
      }).pipe(Effect.provide(live().layer)),
    // A thousand days on the test clock take seconds of real fading steps; the default 5 s is too tight in a full run.
    20_000,
  );
});

describe("undoing a change", () => {
  it.effect("puts back the text a correction changed, and records the undo", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      const id = idOf(yield* save(threadId, "The build takes two minutes.", "mission", "fact"));
      yield* tool(threadId, "update_intel", { id, text: "The build takes ten minutes." });
      yield* undo(entryOf((yield* historyOf(id)).entries, "Corrected"));
      expect((yield* intelOf(id))?.text).toBe("The build takes two minutes.");
      const entries = (yield* historyOf(id)).entries;
      expect(entries[0]).toMatchObject({ actor: "Owner", canUndo: true, kind: "Undone", undid: "Corrected" });
      const corrected = entryOf(entries, "Corrected");
      expect(corrected.canUndo).toBe(false);
      expect(corrected.undoneAt).not.toBeNull();
      expect(yield* undo(corrected).pipe(Effect.flip)).toMatchObject({ kind: "InvalidInput" });
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("puts back a replaced intel's text and kind, keeping its id and uses", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      const id = idOf(yield* save(threadId, "The owner prefers pnpm.", "mission", "preference"));
      yield* tool(threadId, "search_intel", { ids: [id] });
      yield* save(threadId, "The owner prefers Bun.", "mission", "decision");
      yield* undo(entryOf((yield* historyOf(id)).entries, "Replaced"));
      expect(yield* intelOf(id)).toMatchObject({ kind: "Preference", text: "The owner prefers pnpm.", uses: 1 });
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("puts back a widened intel's scope", () => {
    const { directory, layer } = live();
    return Effect.gen(function* () {
      const { threadId } = yield* idle("Hello", directory);
      const id = idOf(yield* save(threadId, "Tests run with Vitest here.", "workspace", "fact"));
      yield* tool(threadId, "update_intel", { id, scope: "global" });
      yield* approveAll;
      yield* undo(entryOf((yield* historyOf(id)).entries, "Widened"));
      expect((yield* intelOf(id))?.scope).toBe("Workspace");
    }).pipe(Effect.provide(layer));
  });

  it.effect("restores a deleted intel with its id, uses, and origin, from the Deleted filter", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle("Keep the build under a minute.");
      const id = idOf(yield* save(threadId, "The build must stay under a minute.", "mission", "rule"));
      yield* tool(threadId, "relied_on_intel", { ids: [id] });
      yield* tool(threadId, "forget_intel", { id });
      expect(yield* intelOf(id)).toBeUndefined();
      const view = yield* panel("Deleted");
      expect(view.intels).toEqual([]);
      expect(view.deleted).toMatchObject([{ id, kind: "Rule", text: "The build must stay under a minute." }]);
      yield* call({ _tag: "UndoIntelChange", entryId: view.deleted[0]?.entryId ?? ("" as never) });
      expect(yield* intelOf(id)).toMatchObject({
        origin: { excerpt: "Keep the build under a minute.", kind: "Message" },
        text: "The build must stay under a minute.",
        uses: 1,
      });
      expect((yield* panel("Deleted")).deleted).toEqual([]);
      expect((yield* historyOf(id)).isDeleted).toBe(false);
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("lists only deleted intel under the Deleted filter", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      const kept = idOf(yield* save(threadId, "The staging server runs Linux.", "mission", "fact"));
      yield* call({ _tag: "EditIntel", intelId: kept, text: "The staging server runs FreeBSD." });
      const gone = idOf(yield* save(threadId, "Releases ship on Fridays only.", "mission", "decision"));
      yield* call({ _tag: "DeleteIntel", intelId: gone });
      expect((yield* panel("Deleted")).deleted.map((intel) => intel.id)).toEqual([gone]);
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("deletes an intel when its save is undone, and brings it back when that undo is undone", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      const id = idOf(yield* save(threadId, "The staging server runs Linux.", "mission", "fact"));
      yield* undo(entryOf((yield* historyOf(id)).entries, "Saved"));
      expect(yield* intelOf(id)).toBeUndefined();
      expect((yield* panel("Deleted")).deleted.map((intel) => intel.id)).toEqual([id]);
      yield* undo(entryOf((yield* historyOf(id)).entries, "Undone"));
      expect((yield* intelOf(id))?.text).toBe("The staging server runs Linux.");
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("refuses to undo a change to a deleted intel until its deletion is undone", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      const id = idOf(yield* save(threadId, "The build takes two minutes.", "mission", "fact"));
      yield* call({ _tag: "EditIntel", intelId: id, text: "The build takes ten minutes." });
      yield* call({ _tag: "DeleteIntel", intelId: id });
      const entries = (yield* historyOf(id)).entries;
      expect(yield* undo(entryOf(entries, "Edited")).pipe(Effect.flip)).toMatchObject({ kind: "InvalidInput" });
      yield* undo(entryOf(entries, "Deleted"));
      yield* undo(entryOf(entries, "Edited"));
      expect((yield* intelOf(id))?.text).toBe("The build takes two minutes.");
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("puts back a restored intel's fading when no use came after", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      const id = idOf(yield* save(threadId, "The API is flaky this week.", "mission", "temporary"));
      yield* advance(10 * day);
      yield* call({ _tag: "RestoreIntel", intelId: id });
      expect((yield* intelOf(id))?.state).toBe("Active");
      yield* undo(entryOf((yield* historyOf(id)).entries, "Restored"));
      expect((yield* intelOf(id))?.state).toBe("Dormant");
    }).pipe(Effect.provide(live().layer)),
  );
});

describe("deleting a thread", () => {
  it.effect("erases the history of its own intel, deleted ones included", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      const child = (yield* open(threadId)).threadId;
      yield* settleTurns;
      const kept = idOf(yield* save(child, "Only this thread needs this.", "thread", "fact"));
      const forgotten = idOf(yield* save(child, "Another note for this thread.", "thread", "fact"));
      yield* tool(child, "forget_intel", { id: forgotten });
      const preview = yield* call({ _tag: "PreviewDeletion", threadId: child });
      yield* call({ _tag: "DeleteThread", confirmation: preview.confirmation, threadId: child });
      for (const id of [kept, forgotten]) {
        expect(yield* historyOf(id).pipe(Effect.flip)).toMatchObject({ kind: "NotFound" });
      }
      expect((yield* panel("Deleted")).deleted).toEqual([]);
    }).pipe(Effect.provide(live().layer)),
  );
});
