import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { TestClock } from "effect/testing";
import { afterEach } from "vitest";
import type { Placement } from "../src/intel.ts";
import { owner, readSnapshot, type Snapshot, threadActor } from "../src/intelHistory.ts";
import {
  correctIntel,
  countUses,
  deleteIntel,
  eraseThreadsIntel,
  insertIntel,
  mergeIntels,
  moveIntel,
  pinIntel,
  replaceIntel,
  restoreIntel,
} from "../src/intelStore.ts";
import { undoIntelChange } from "../src/intelUndo.ts";
import { storeLayer } from "../src/store.ts";

// The intel store's interface (scoped-intel, History and undo), on real temporary SQLite and the test clock.

const directories: Array<string> = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});
/** Runs a test against a fresh migrated store. */
const inStore = <A, E>(test: Effect.Effect<A, E, SqlClient.SqlClient>) => {
  const directory = mkdtempSync(join(tmpdir(), "canopy-intel-store-"));
  directories.push(directory);
  return test.pipe(Effect.provide(storeLayer(join(directory, "store.sqlite"))));
};

const day = 24 * 60 * 60 * 1000;
const global: Placement = { scope: "Global", threadId: null, workspaceId: null };
const workspace = (workspaceId: string): Placement => ({ scope: "Workspace", threadId: null, workspaceId });

const save = (text: string, placement: Placement = global, kind: Snapshot["kind"] = "Fact") =>
  insertIntel({ kind, origin: null, placement, text, threadId: "thread-1" });

interface StoredEntry {
  readonly actor: string;
  readonly afterState: string | null;
  readonly beforeState: string | null;
  readonly id: string;
  readonly kind: string;
}
/** An intel's history in the order recorded. */
const historyOf = (intelId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    return yield* sql<StoredEntry>`SELECT id, kind, actor, before_state AS beforeState, after_state AS afterState
      FROM intel_history WHERE intel_id = ${intelId} ORDER BY rowid`;
  });
const latestOf = (intelId: string) =>
  historyOf(intelId).pipe(Effect.map((entries) => entries.filter((entry) => entry.actor !== "Fading").at(-1) ?? null));
const stateOf = (json: string | null) => (json === null ? null : (JSON.parse(json) as Snapshot));
/** A state without its update time, which an undo sets to its own time. */
const restorable = (state: Snapshot | null) => (state === null ? null : { ...state, updatedAt: 0 });

/**
 * Runs one operation on an intel, then checks it is recorded with the states before and after, and that
 * undoing it puts the state before back.
 */
const checkRecordedAndUndone = (
  intelId: string,
  kind: string,
  operation: Effect.Effect<unknown, unknown, SqlClient.SqlClient>,
) =>
  Effect.gen(function* () {
    const before = yield* readSnapshot(intelId);
    yield* TestClock.adjust(1000);
    yield* operation;
    const after = yield* readSnapshot(intelId);
    const entry = yield* latestOf(intelId);
    expect(entry?.kind).toBe(kind);
    expect(stateOf(entry?.beforeState ?? null)).toEqual(before);
    expect(stateOf(entry?.afterState ?? null)).toEqual(after);
    yield* TestClock.adjust(1000);
    yield* undoIntelChange(entry?.id ?? "");
    expect(restorable(yield* readSnapshot(intelId))).toEqual(restorable(before));
    expect((yield* latestOf(intelId))?.kind).toBe("Undone");
  });

describe("keeping intel in the store", () => {
  it.effect("records a save, and undoing it deletes the intel", () =>
    inStore(
      Effect.gen(function* () {
        const id = yield* save("The build takes two minutes.");
        const entry = yield* latestOf(id);
        expect(entry?.kind).toBe("Saved");
        expect(stateOf(entry?.afterState ?? null)).toEqual(yield* readSnapshot(id));
        yield* undoIntelChange(entry?.id ?? "");
        expect(yield* readSnapshot(id)).toBeNull();
      }),
    ),
  );

  it.effect("records every change with the states before and after, and undo puts the state before back", () =>
    inStore(
      Effect.gen(function* () {
        const id = yield* save("The build takes two minutes.");
        const local = yield* save("Tabs are two spaces.", workspace("workspace-1"));
        yield* checkRecordedAndUndone(id, "Corrected", correctIntel(id, "Three minutes.", threadActor("thread-1")));
        yield* checkRecordedAndUndone(id, "Edited", correctIntel(id, "Four minutes.", owner));
        yield* checkRecordedAndUndone(id, "Narrowed", moveIntel(id, workspace("workspace-1"), null, "Narrowed", owner));
        yield* checkRecordedAndUndone(
          local,
          "Widened",
          moveIntel(local, global, "Tabs are four spaces.", "Widened", threadActor("thread-1"), 5),
        );
        yield* checkRecordedAndUndone(
          id,
          "Replaced",
          replaceIntel(id, { kind: "Decision", origin: null, text: "Five minutes." }, threadActor("thread-1")),
        );
        yield* checkRecordedAndUndone(id, "Pinned", pinIntel(id, true));
        yield* pinIntel(id, true);
        yield* checkRecordedAndUndone(id, "Unpinned", pinIntel(id, false));
        yield* checkRecordedAndUndone(id, "Restored", restoreIntel(id));
        yield* checkRecordedAndUndone(id, "Deleted", deleteIntel(id, owner));
        yield* checkRecordedAndUndone(id, "Deleted", deleteIntel(id, threadActor("thread-1")));
      }),
    ),
  );

  it.effect("records a merge on each merged intel and the kept one, each undone on its own", () =>
    inStore(
      Effect.gen(function* () {
        const kept = yield* save("Use pnpm.", workspace("workspace-1"));
        const merged = yield* save("Use pnpm.", workspace("workspace-2"));
        yield* countUses("thread-1", [merged]);
        const keptBefore = yield* readSnapshot(kept);
        const mergedBefore = yield* readSnapshot(merged);
        yield* TestClock.adjust(1000);
        yield* mergeIntels(kept, [merged]);
        expect(yield* readSnapshot(merged)).toBeNull();
        expect(yield* readSnapshot(kept)).toMatchObject({ scope: "Global", uses: 1, workspaceId: null });
        const mergeEntry = yield* latestOf(merged);
        const widenEntry = yield* latestOf(kept);
        expect(mergeEntry?.kind).toBe("Merged");
        expect(stateOf(mergeEntry?.beforeState ?? null)).toEqual(mergedBefore);
        expect(widenEntry?.kind).toBe("Widened");
        expect(stateOf(widenEntry?.beforeState ?? null)).toEqual(keptBefore);
        yield* undoIntelChange(mergeEntry?.id ?? "");
        expect(yield* readSnapshot(merged)).toEqual(mergedBefore);
        yield* undoIntelChange(widenEntry?.id ?? "");
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
        yield* pinIntel(pinned, true);
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

  it.effect("declines the changes awaiting approval on an intel the owner deletes, not one a thread deletes", () =>
    inStore(
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const byOwner = yield* save("Owner deletes this.");
        const byThread = yield* save("A thread deletes this.");
        for (const intelId of [byOwner, byThread]) {
          yield* sql`INSERT INTO intel_changes (id, thread_id, kind, status, intel_id, scope, text, at)
            VALUES (${`change-${intelId}`}, 'thread-2', 'Update', 'Awaiting', ${intelId}, 'Global', 'New text', 0)`;
        }
        yield* deleteIntel(byOwner, owner);
        yield* deleteIntel(byThread, threadActor("thread-1"));
        const statuses = yield* sql<{ intelId: string; status: string }>`
          SELECT intel_id AS intelId, status FROM intel_changes`;
        expect(statuses.find((row) => row.intelId === byOwner)?.status).toBe("Declined");
        expect(statuses.find((row) => row.intelId === byThread)?.status).toBe("Awaiting");
      }),
    ),
  );

  it.effect("erases threads' own intel with its history and uses, deleted intel included, and keeps the rest", () =>
    inStore(
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const own = yield* save("Thread fact.", { scope: "Thread", threadId: "thread-1", workspaceId: null });
        const gone = yield* save("Deleted thread fact.", { scope: "Thread", threadId: "thread-1", workspaceId: null });
        const kept = yield* save("Global fact.");
        // Uses are counted with the using thread's workspace; with no thread stored here, they are added as such.
        for (const intelId of [own, kept]) yield* sql`INSERT INTO intel_uses (intel_id, at) VALUES (${intelId}, 0)`;
        yield* deleteIntel(gone, threadActor("thread-1"));
        yield* eraseThreadsIntel(["thread-1"]);
        expect(yield* readSnapshot(own)).toBeNull();
        expect(yield* historyOf(own)).toEqual([]);
        expect(yield* historyOf(gone)).toEqual([]);
        expect((yield* historyOf(kept)).map((entry) => entry.kind)).toEqual(["Saved"]);
        const uses = yield* sql<{ intelId: string }>`SELECT intel_id AS intelId FROM intel_uses`;
        expect(uses.map((row) => row.intelId)).toEqual([kept]);
      }),
    ),
  );
});
