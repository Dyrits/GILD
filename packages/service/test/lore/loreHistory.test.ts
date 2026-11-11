import { describe, expect, it } from "@effect/vitest";
import type { LoreEntryId, LoreHistoryEntry, ThreadId } from "@iskios/contracts";
import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { afterEach } from "vitest";
import { call, entryOf, fixture, open, start, tool } from "../fixtures/service.ts";

// Stored and wire names keep `intel` so existing data and agents still work: request tags (`"ListIntel"`, ...) and thread tool names (`save_intel`, ...).

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
const idOf = (answer: string) => (/lore entry (\S+?)[ .:]/.exec(answer)?.[1] ?? "") as LoreEntryId;
const panel = (state: "Deleted" | null = null) => call({ _tag: "ListIntel", scope: null, state, threadId: null });
const loreEntryOf = (id: string) =>
  panel().pipe(Effect.map((view) => view.loreEntries.find((loreEntry) => loreEntry.id === id)));
const historyOf = (loreEntryId: LoreEntryId) => call({ _tag: "ReadIntelHistory", loreEntryId });
const kindsOf = (entries: ReadonlyArray<LoreHistoryEntry>) => entries.map((entry) => entry.kind);
const undo = (entry: LoreHistoryEntry) => call({ _tag: "UndoIntelChange", entryId: entry.id });
const approveAll = Effect.gen(function* () {
  for (const change of (yield* panel()).awaiting) {
    yield* call({ _tag: "ResolveIntelChange", changeId: change.id, isApproved: true });
  }
});

describe("recording a lore entry's history", () => {
  it.effect("records each change, newest first, with who made it and when", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      const id = idOf(yield* save(threadId, "The build takes two minutes.", "mission", "fact"));
      yield* advance(1000);
      yield* tool(threadId, "update_intel", { id, text: "The build takes three minutes." });
      yield* advance(1000);
      yield* call({ _tag: "EditIntel", loreEntryId: id, text: "The build takes four minutes." });
      yield* call({ _tag: "PinIntel", isPinned: true, loreEntryId: id });
      yield* call({ _tag: "PinIntel", isPinned: false, loreEntryId: id });
      yield* advance(1000);
      yield* call({ _tag: "DeleteIntel", loreEntryId: id });
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
      const global = (yield* panel()).loreEntries.find(
        (loreEntry) => loreEntry.text === "The owner writes in British English.",
      );
      const saved = entryOf((yield* historyOf(global?.id ?? ("" as LoreEntryId))).entries, "Saved");
      expect(saved.approvedAt).not.toBeNull();
    }).pipe(Effect.provide(layer));
  });

  it.effect("leaves a declined change out of the history", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      yield* save(threadId, "The owner writes in British English.", "global", "preference");
      yield* approveAll;
      const [loreEntry] = (yield* panel()).loreEntries;
      yield* tool(threadId, "forget_intel", { id: loreEntry?.id });
      for (const change of (yield* panel()).awaiting) {
        yield* call({ _tag: "ResolveIntelChange", changeId: change.id, isApproved: false });
      }
      expect(kindsOf((yield* historyOf(loreEntry?.id ?? ("" as LoreEntryId))).entries)).toEqual(["Saved"]);
    }).pipe(Effect.provide(live().layer)),
  );
});

describe("recording fading steps", () => {
  it.effect("shows when a lore entry became dormant and archived, and keeps them after a restore", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      const id = idOf(yield* save(threadId, "The API is flaky this week.", "mission", "temporary"));
      const savedAt = entryOf((yield* historyOf(id)).entries, "Saved").at;
      yield* advance(20 * day);
      const faded = (yield* historyOf(id)).entries;
      expect(kindsOf(faded)).toEqual(["Archived", "Dormant", "Saved"]);
      const dormant = entryOf(faded, "Dormant");
      // A temporary lore entry's half-life is 3 days: dormant below 0.15 after 3 × log2(1 / 0.15) days.
      expect((dormant.at - savedAt) / day).toBeCloseTo(3 * Math.log2(1 / 0.15), 3);
      expect((entryOf(faded, "Archived").at - savedAt) / day).toBeCloseTo(3 * Math.log2(1 / 0.05), 3);
      expect(dormant).toMatchObject({ actor: "Fading", canUndo: false });
      yield* call({ _tag: "RestoreIntel", loreEntryId: id });
      expect(kindsOf((yield* historyOf(id)).entries)).toEqual(["Restored", "Archived", "Dormant", "Saved"]);
      expect(yield* undo(dormant).pipe(Effect.flip)).toMatchObject({ kind: "InvalidInput" });
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("keeps a dormant step after a use made the lore active again", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      const id = idOf(yield* save(threadId, "The API is flaky this week.", "mission", "temporary"));
      yield* advance(10 * day);
      yield* tool(threadId, "search_intel", { ids: [id] });
      yield* advance(1 * day);
      expect(kindsOf((yield* historyOf(id)).entries)).toEqual(["Dormant", "Saved"]);
      expect((yield* loreEntryOf(id))?.state).toBe("Active");
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
      expect((yield* loreEntryOf(id))?.text).toBe("The build takes two minutes.");
      const entries = (yield* historyOf(id)).entries;
      expect(entries[0]).toMatchObject({ actor: "Owner", canUndo: true, kind: "Undone", undid: "Corrected" });
      const corrected = entryOf(entries, "Corrected");
      expect(corrected.canUndo).toBe(false);
      expect(corrected.undoneAt).not.toBeNull();
      expect(yield* undo(corrected).pipe(Effect.flip)).toMatchObject({ kind: "InvalidInput" });
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("puts back a replaced lore entry's text and kind, keeping its id and uses", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      const id = idOf(yield* save(threadId, "The owner prefers pnpm.", "mission", "preference"));
      yield* tool(threadId, "search_intel", { ids: [id] });
      yield* save(threadId, "The owner prefers Bun.", "mission", "decision");
      yield* undo(entryOf((yield* historyOf(id)).entries, "Replaced"));
      expect(yield* loreEntryOf(id)).toMatchObject({ kind: "Preference", text: "The owner prefers pnpm.", uses: 1 });
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("puts back a widened lore entry's scope", () => {
    const { directory, layer } = live();
    return Effect.gen(function* () {
      const { threadId } = yield* idle("Hello", directory);
      const id = idOf(yield* save(threadId, "Tests run with Vitest here.", "workspace", "fact"));
      yield* tool(threadId, "update_intel", { id, scope: "global" });
      yield* approveAll;
      yield* undo(entryOf((yield* historyOf(id)).entries, "Widened"));
      expect((yield* loreEntryOf(id))?.scope).toBe("Workspace");
    }).pipe(Effect.provide(layer));
  });

  it.effect("restores a deleted lore entry with its id, uses, and origin, from the Deleted filter", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle("Keep the build under a minute.");
      const id = idOf(yield* save(threadId, "The build must stay under a minute.", "mission", "rule"));
      yield* tool(threadId, "relied_on_intel", { ids: [id] });
      yield* tool(threadId, "forget_intel", { id });
      expect(yield* loreEntryOf(id)).toBeUndefined();
      const view = yield* panel("Deleted");
      expect(view.loreEntries).toEqual([]);
      expect(view.deleted).toMatchObject([{ id, kind: "Rule", text: "The build must stay under a minute." }]);
      yield* call({ _tag: "UndoIntelChange", entryId: view.deleted[0]?.entryId ?? ("" as never) });
      expect(yield* loreEntryOf(id)).toMatchObject({
        origin: { excerpt: "Keep the build under a minute.", kind: "Message" },
        text: "The build must stay under a minute.",
        uses: 1,
      });
      expect((yield* panel("Deleted")).deleted).toEqual([]);
      expect((yield* historyOf(id)).isDeleted).toBe(false);
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("lists only deleted lore under the Deleted filter", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      const kept = idOf(yield* save(threadId, "The staging server runs Linux.", "mission", "fact"));
      yield* call({ _tag: "EditIntel", loreEntryId: kept, text: "The staging server runs FreeBSD." });
      const gone = idOf(yield* save(threadId, "Releases ship on Fridays only.", "mission", "decision"));
      yield* call({ _tag: "DeleteIntel", loreEntryId: gone });
      expect((yield* panel("Deleted")).deleted.map((loreEntry) => loreEntry.id)).toEqual([gone]);
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("deletes a lore entry when its save is undone, and brings it back when that undo is undone", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      const id = idOf(yield* save(threadId, "The staging server runs Linux.", "mission", "fact"));
      yield* undo(entryOf((yield* historyOf(id)).entries, "Saved"));
      expect(yield* loreEntryOf(id)).toBeUndefined();
      expect((yield* panel("Deleted")).deleted.map((loreEntry) => loreEntry.id)).toEqual([id]);
      yield* undo(entryOf((yield* historyOf(id)).entries, "Undone"));
      expect((yield* loreEntryOf(id))?.text).toBe("The staging server runs Linux.");
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("refuses to undo a change to a deleted lore entry until its deletion is undone", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      const id = idOf(yield* save(threadId, "The build takes two minutes.", "mission", "fact"));
      yield* call({ _tag: "EditIntel", loreEntryId: id, text: "The build takes ten minutes." });
      yield* call({ _tag: "DeleteIntel", loreEntryId: id });
      const entries = (yield* historyOf(id)).entries;
      expect(yield* undo(entryOf(entries, "Edited")).pipe(Effect.flip)).toMatchObject({ kind: "InvalidInput" });
      yield* undo(entryOf(entries, "Deleted"));
      yield* undo(entryOf(entries, "Edited"));
      expect((yield* loreEntryOf(id))?.text).toBe("The build takes two minutes.");
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("puts back a restored lore entry's fading when no use came after", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      const id = idOf(yield* save(threadId, "The API is flaky this week.", "mission", "temporary"));
      yield* advance(10 * day);
      yield* call({ _tag: "RestoreIntel", loreEntryId: id });
      expect((yield* loreEntryOf(id))?.state).toBe("Active");
      yield* undo(entryOf((yield* historyOf(id)).entries, "Restored"));
      expect((yield* loreEntryOf(id))?.state).toBe("Dormant");
    }).pipe(Effect.provide(live().layer)),
  );
});

describe("deleting a thread", () => {
  it.effect("erases the history of its own lore, deleted ones included", () =>
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
