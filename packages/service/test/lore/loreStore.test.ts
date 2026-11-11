import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { TestClock } from "effect/testing";
import { afterEach } from "vitest";
import { storeLayer } from "../../src/core/index.ts";
import { undoLoreChange } from "../../src/lore/index.ts";
import type { Placement } from "../../src/lore/lore.ts";
import { owner, readSnapshot, type Snapshot, threadActor } from "../../src/lore/loreHistory.ts";
import {
  correctLoreEntry,
  countUses,
  deleteLoreEntry,
  eraseThreadsLore,
  insertLoreEntry,
  mergeLoreEntries,
  moveLoreEntry,
  pinLoreEntry,
  replaceLoreEntry,
  restoreLoreEntry,
} from "../../src/lore/loreStore.ts";

// Stored and wire names keep `intel` so existing data and agents still work: table and column names (`intels`, `intel_id`, ...).

// The lore store's interface (scoped-intel, History and undo), on real temporary SQLite and the test clock.

const directories: Array<string> = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});
/** Runs a test against a fresh migrated store. */
const inStore = <A, E>(test: Effect.Effect<A, E, SqlClient.SqlClient>) => {
  const directory = mkdtempSync(join(tmpdir(), "iskios-lore-store-"));
  directories.push(directory);
  return test.pipe(Effect.provide(storeLayer(join(directory, "store.sqlite"))));
};

const day = 24 * 60 * 60 * 1000;
const global: Placement = { scope: "Global", threadId: null, workspaceId: null };
const workspace = (workspaceId: string): Placement => ({ scope: "Workspace", threadId: null, workspaceId });

const save = (text: string, placement: Placement = global, kind: Snapshot["kind"] = "Fact") =>
  insertLoreEntry({ kind, origin: null, placement, text, threadId: "thread-1" });

interface StoredEntry {
  readonly actor: string;
  readonly afterState: string | null;
  readonly beforeState: string | null;
  readonly id: string;
  readonly kind: string;
}
/** A lore entry's history in the order recorded. */
const historyOf = (loreEntryId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    return yield* sql<StoredEntry>`SELECT id, kind, actor, before_state AS beforeState, after_state AS afterState
      FROM intel_history WHERE intel_id = ${loreEntryId} ORDER BY rowid`;
  });
const latestOf = (loreEntryId: string) =>
  historyOf(loreEntryId).pipe(
    Effect.map((entries) => entries.filter((entry) => entry.actor !== "Fading").at(-1) ?? null),
  );
const stateOf = (json: string | null) => (json === null ? null : (JSON.parse(json) as Snapshot));
/** A state without its update time, which an undo sets to its own time. */
const restorable = (state: Snapshot | null) => (state === null ? null : { ...state, updatedAt: 0 });

/**
 * Runs one operation on a lore entry, then checks it is recorded with the states before and after, and that
 * undoing it puts the state before back.
 */
const checkRecordedAndUndone = (
  loreEntryId: string,
  kind: string,
  operation: Effect.Effect<unknown, unknown, SqlClient.SqlClient>,
) =>
  Effect.gen(function* () {
    const before = yield* readSnapshot(loreEntryId);
    yield* TestClock.adjust(1000);
    yield* operation;
    const after = yield* readSnapshot(loreEntryId);
    const entry = yield* latestOf(loreEntryId);
    expect(entry?.kind).toBe(kind);
    expect(stateOf(entry?.beforeState ?? null)).toEqual(before);
    expect(stateOf(entry?.afterState ?? null)).toEqual(after);
    yield* TestClock.adjust(1000);
    yield* undoLoreChange(entry?.id ?? "");
    expect(restorable(yield* readSnapshot(loreEntryId))).toEqual(restorable(before));
    expect((yield* latestOf(loreEntryId))?.kind).toBe("Undone");
  });

describe("keeping lore in the store", () => {
  it.effect("records a save, and undoing it deletes the lore", () =>
    inStore(
      Effect.gen(function* () {
        const id = yield* save("The build takes two minutes.");
        const entry = yield* latestOf(id);
        expect(entry?.kind).toBe("Saved");
        expect(stateOf(entry?.afterState ?? null)).toEqual(yield* readSnapshot(id));
        yield* undoLoreChange(entry?.id ?? "");
        expect(yield* readSnapshot(id)).toBeNull();
      }),
    ),
  );

  it.effect("records every change with the states before and after, and undo puts the state before back", () =>
    inStore(
      Effect.gen(function* () {
        const id = yield* save("The build takes two minutes.");
        const local = yield* save("Tabs are two spaces.", workspace("workspace-1"));
        yield* checkRecordedAndUndone(id, "Corrected", correctLoreEntry(id, "Three minutes.", threadActor("thread-1")));
        yield* checkRecordedAndUndone(id, "Edited", correctLoreEntry(id, "Four minutes.", owner));
        yield* checkRecordedAndUndone(
          id,
          "Narrowed",
          moveLoreEntry(id, workspace("workspace-1"), null, "Narrowed", owner),
        );
        yield* checkRecordedAndUndone(
          local,
          "Widened",
          moveLoreEntry(local, global, "Tabs are four spaces.", "Widened", threadActor("thread-1"), 5),
        );
        yield* checkRecordedAndUndone(
          id,
          "Replaced",
          replaceLoreEntry(id, { kind: "Decision", origin: null, text: "Five minutes." }, threadActor("thread-1")),
        );
        yield* checkRecordedAndUndone(id, "Pinned", pinLoreEntry(id, true));
        yield* pinLoreEntry(id, true);
        yield* checkRecordedAndUndone(id, "Unpinned", pinLoreEntry(id, false));
        yield* checkRecordedAndUndone(id, "Restored", restoreLoreEntry(id));
        yield* checkRecordedAndUndone(id, "Deleted", deleteLoreEntry(id, owner));
        yield* checkRecordedAndUndone(id, "Deleted", deleteLoreEntry(id, threadActor("thread-1")));
      }),
    ),
  );

  it.effect("records a merge on each merged lore entry and the kept one, each undone on its own", () =>
    inStore(
      Effect.gen(function* () {
        const kept = yield* save("Use pnpm.", workspace("workspace-1"));
        const merged = yield* save("Use pnpm.", workspace("workspace-2"));
        yield* countUses("thread-1", [merged]);
        const keptBefore = yield* readSnapshot(kept);
        const mergedBefore = yield* readSnapshot(merged);
        yield* TestClock.adjust(1000);
        yield* mergeLoreEntries(kept, [merged]);
        expect(yield* readSnapshot(merged)).toBeNull();
        expect(yield* readSnapshot(kept)).toMatchObject({ scope: "Global", uses: 1, workspaceId: null });
        const mergeEntry = yield* latestOf(merged);
        const widenEntry = yield* latestOf(kept);
        expect(mergeEntry?.kind).toBe("Merged");
        expect(stateOf(mergeEntry?.beforeState ?? null)).toEqual(mergedBefore);
        expect(widenEntry?.kind).toBe("Widened");
        expect(stateOf(widenEntry?.beforeState ?? null)).toEqual(keptBefore);
        yield* undoLoreChange(mergeEntry?.id ?? "");
        expect(yield* readSnapshot(merged)).toEqual(mergedBefore);
        yield* undoLoreChange(widenEntry?.id ?? "");
        expect(yield* readSnapshot(kept)).toMatchObject({ scope: "Workspace", workspaceId: "workspace-1" });
      }),
    ),
  );

  it.effect("stores the fading steps before a change resets them, and a use adds no other entry", () =>
    inStore(
      Effect.gen(function* () {
        const used = yield* save("Deploy is frozen.", global, "Temporary");
        const pinned = yield* save("Staging is down.", global, "Temporary");
        yield* TestClock.adjust(365 * day);
        yield* countUses("thread-1", [used]);
        yield* pinLoreEntry(pinned, true);
        expect((yield* historyOf(used)).map((entry) => entry.kind)).toEqual(["Saved", "Dormant", "Archived"]);
        expect((yield* historyOf(pinned)).map((entry) => entry.kind)).toEqual([
          "Saved",
          "Dormant",
          "Archived",
          "Pinned",
        ]);
        expect(yield* readSnapshot(used)).toMatchObject({ lastUsedAt: 365 * day, uses: 1 });
      }),
    ),
  );

  it.effect("declines the changes awaiting approval on a lore entry the owner deletes, not one a thread deletes", () =>
    inStore(
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const byOwner = yield* save("Owner deletes this.");
        const byThread = yield* save("A thread deletes this.");
        for (const loreEntryId of [byOwner, byThread]) {
          yield* sql`INSERT INTO intel_changes (id, thread_id, kind, status, intel_id, scope, text, at)
            VALUES (${`change-${loreEntryId}`}, 'thread-2', 'Update', 'Awaiting', ${loreEntryId}, 'Global', 'New text', 0)`;
        }
        yield* deleteLoreEntry(byOwner, owner);
        yield* deleteLoreEntry(byThread, threadActor("thread-1"));
        const statuses = yield* sql<{ loreEntryId: string; status: string }>`
          SELECT intel_id AS loreEntryId, status FROM intel_changes`;
        expect(statuses.find((row) => row.loreEntryId === byOwner)?.status).toBe("Declined");
        expect(statuses.find((row) => row.loreEntryId === byThread)?.status).toBe("Awaiting");
      }),
    ),
  );

  it.effect("erases threads' own lore with its history and uses, deleted lore included, and keeps the rest", () =>
    inStore(
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const own = yield* save("Thread fact.", { scope: "Thread", threadId: "thread-1", workspaceId: null });
        const gone = yield* save("Deleted thread fact.", { scope: "Thread", threadId: "thread-1", workspaceId: null });
        const kept = yield* save("Global fact.");
        // Uses are counted with the using thread's workspace; with no thread stored here, they are added as such.
        for (const loreEntryId of [own, kept])
          yield* sql`INSERT INTO intel_uses (intel_id, at) VALUES (${loreEntryId}, 0)`;
        yield* deleteLoreEntry(gone, threadActor("thread-1"));
        yield* eraseThreadsLore(["thread-1"]);
        expect(yield* readSnapshot(own)).toBeNull();
        expect(yield* historyOf(own)).toEqual([]);
        expect(yield* historyOf(gone)).toEqual([]);
        expect((yield* historyOf(kept)).map((entry) => entry.kind)).toEqual(["Saved"]);
        const uses = yield* sql<{ loreEntryId: string }>`SELECT intel_id AS loreEntryId FROM intel_uses`;
        expect(uses.map((row) => row.loreEntryId)).toEqual([kept]);
      }),
    ),
  );
});
