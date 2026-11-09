import type { LoreActor, LoreHistoryKind, LoreKind, LoreOrigin, LoreScope } from "@gild/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { type Fading, fadingStepsOf } from "./loreFading.ts";

// Stored and wire names keep `intel` so existing data and agents still work: table and column names (`intels`, `intel_id`, ...).

// A lore entry's history (scoped-intel, History and undo): every save, replacement, change, widening, deletion,
// and fading step, with who or what made it and when, and each change's state before and after so it can
// be undone. The lore store (loreStore.ts) writes it; this module reads it.

/** A lore entry's stored state, kept with each history entry so the owner can undo the change. */
export interface Snapshot {
  readonly id: string;
  readonly isPinned: number;
  readonly kind: LoreKind;
  readonly lastUsedAt: number;
  readonly originEntry: number | null;
  readonly originExcerpt: string | null;
  readonly originFrom: string | null;
  readonly originKind: LoreOrigin["kind"] | null;
  readonly savedAt: number;
  readonly savedByThreadId: string | null;
  readonly savedByTitle: string | null;
  readonly scope: LoreScope;
  readonly text: string;
  readonly threadId: string | null;
  readonly updatedAt: number;
  readonly uses: number;
  readonly workspaceId: string | null;
}

/** Who made a change: a thread, or the owner. */
export type Actor = { readonly kind: "Thread"; readonly threadId: string } | { readonly kind: "Owner" };

/** The owner, as the actor of a change. */
export const owner: Actor = { kind: "Owner" };
/** A thread, as the actor of a change. */
export const threadActor = (threadId: string): Actor => ({ kind: "Thread", threadId });

/** A lore entry's stored state, or null when it does not exist. */
export const readSnapshot = (loreEntryId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql<Snapshot>`
      SELECT id, scope, kind, thread_id AS threadId, workspace_id AS workspaceId, text,
        saved_by_thread_id AS savedByThreadId, saved_by_title AS savedByTitle, saved_at AS savedAt,
        updated_at AS updatedAt, last_used_at AS lastUsedAt, uses, is_pinned AS isPinned,
        origin_kind AS originKind, origin_entry AS originEntry, origin_from AS originFrom,
        origin_excerpt AS originExcerpt
      FROM intels WHERE id = ${loreEntryId}`;
    return row ?? null;
  });

/** A fading step's identifier: one per lore entry, step, and time, so a step shown before it is stored keeps it. */
export const fadingEntryIdOf = (loreEntryId: string, kind: string, at: number) => `${loreEntryId}:${kind}:${at}`;

/** Whether an identifier names a fading step, which has no Undo. */
export const isFadingEntryId = (entryId: string) => /:(Dormant|Archived):\d+$/.test(entryId);

/** The fading steps a lore entry took since its last use and that are not stored yet. */
export const unrecordedStepsOf = (state: Snapshot, fading: Fading) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const steps = fadingStepsOf(state, fading);
    if (steps.length === 0) return [];
    const stored = yield* sql<{ id: string }>`SELECT id FROM intel_history
      WHERE id IN ${sql.in(steps.map((step) => fadingEntryIdOf(state.id, step.kind, step.at)))}`;
    return steps.filter((step) => !stored.some((row) => row.id === fadingEntryIdOf(state.id, step.kind, step.at)));
  });

/** One stored history entry, its states still as JSON. */
export interface EntryRow {
  readonly actor: LoreActor;
  readonly actorTitle: string | null;
  readonly afterState: string | null;
  readonly approvedAt: number | null;
  readonly at: number;
  readonly beforeState: string | null;
  readonly id: string;
  readonly kind: LoreHistoryKind;
  readonly loreEntryId: string;
  readonly undid: LoreHistoryKind | null;
  readonly undoneAt: number | null;
}

/** A state stored as JSON, or null. */
export const stateOf = (json: string | null): Snapshot | null =>
  json === null ? null : (JSON.parse(json) as Snapshot);

/** Selects history entries; callers add the condition and order. */
export const selectEntries = (sql: SqlClient.SqlClient) => sql`
  SELECT id, intel_id AS loreEntryId, kind, actor, actor_title AS actorTitle, at, approved_at AS approvedAt,
    before_state AS beforeState, after_state AS afterState, undid, undone_at AS undoneAt
  FROM intel_history`;

/** One stored entry, or null when there is none with that identifier. */
export const readEntry = (entryId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql<EntryRow>`${selectEntries(sql)} WHERE id = ${entryId}`;
    return row === undefined ? null : { ...row, after: stateOf(row.afterState), before: stateOf(row.beforeState) };
  });
