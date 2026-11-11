import type { LoreChangeKind, LoreChangeStatus, LoreKind, LoreOrigin } from "@iskios/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, notFound } from "../core/index.ts";
import { originOf, type Placement, readLoreEntry } from "./lore.ts";
import { textProblemOf } from "./loreChanges.ts";
import { owner, threadActor } from "./loreHistory.ts";
import {
  correctLoreEntry,
  deleteLoreEntry,
  insertLoreEntry,
  moveLoreEntry,
  pinLoreEntry,
  replaceLoreEntry,
  restoreLoreEntry,
} from "./loreStore.ts";

// Stored and wire names keep `intel` so existing data and agents still work: table and column names (`intels`, `intel_id`, ...).

// The owner's decisions on lore (scoped-intel, Correcting and deleting, Widening, Lore panel): approving or
// declining a thread's change awaiting approval, and editing, deleting, pinning, or restoring any lore.

/** One stored change awaiting the owner, with what applying it needs. */
interface ChangeRow {
  readonly kind: LoreChangeKind;
  readonly loreEntryId: string | null;
  readonly loreKind: LoreKind;
  readonly originEntry: number | null;
  readonly originExcerpt: string | null;
  readonly originFrom: string | null;
  readonly originKind: LoreOrigin["kind"] | null;
  readonly scope: Placement["scope"];
  readonly scopeThreadId: string | null;
  readonly scopeWorkspaceId: string | null;
  readonly status: LoreChangeStatus;
  readonly text: string;
  readonly threadId: string;
}

/**
 * The owner approves or declines a change awaiting approval. An approved change to a lore entry deleted in the
 * meantime is declined, since there is nothing left to change. Callers run it in a transaction.
 */
export const resolveLoreChange = (changeId: string, isApproved: boolean) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [change] = yield* sql<ChangeRow>`
      SELECT kind, intel_kind AS loreKind, status, intel_id AS loreEntryId, scope, scope_thread_id AS scopeThreadId,
        scope_workspace_id AS scopeWorkspaceId, text, thread_id AS threadId, origin_kind AS originKind,
        origin_entry AS originEntry, origin_from AS originFrom, origin_excerpt AS originExcerpt
      FROM intel_changes WHERE id = ${changeId}`;
    if (change === undefined) return yield* notFound("No such change to lore.");
    if (change.status !== "Awaiting") return yield* invalid("This change was already decided.");
    const placement = { scope: change.scope, threadId: change.scopeThreadId, workspaceId: change.scopeWorkspaceId };
    const target = change.loreEntryId === null ? null : yield* readLoreEntry(change.loreEntryId);
    const isApplied = isApproved && (change.kind === "Save" || target !== null);
    const now = yield* Clock.currentTimeMillis;
    // An approved change is recorded in the lore entry's history as the thread's, with the owner's approval.
    const actor = threadActor(change.threadId);
    // Every change but Save acts on its target lore.
    const applyToTarget = {
      Forget: (loreEntry: NonNullable<typeof target>) => deleteLoreEntry(loreEntry.id, actor, now),
      Replace: (loreEntry: NonNullable<typeof target>) =>
        replaceLoreEntry(
          loreEntry.id,
          { kind: change.loreKind, origin: originOf(change), text: change.text },
          actor,
          now,
        ),
      Update: (loreEntry: NonNullable<typeof target>) => {
        const isWidening = loreEntry.scope !== placement.scope || loreEntry.threadId !== placement.threadId;
        return isWidening
          ? moveLoreEntry(loreEntry.id, placement, change.text, "Widened", actor, now)
          : correctLoreEntry(loreEntry.id, change.text, actor, now);
      },
    } satisfies Record<Exclude<LoreChangeKind, "Save">, unknown>;
    if (isApplied && change.kind === "Save") {
      const loreEntry = { kind: change.loreKind, origin: originOf(change), placement, text: change.text };
      const loreEntryId = yield* insertLoreEntry({ ...loreEntry, threadId: change.threadId }, now);
      yield* sql`UPDATE intel_changes SET intel_id = ${loreEntryId} WHERE id = ${changeId}`;
    } else if (isApplied && target !== null && change.kind !== "Save") {
      yield* applyToTarget[change.kind](target);
    }
    yield* sql`UPDATE intel_changes SET status = ${isApplied ? "Approved" : "Declined"}, resolved_at = ${now}
      WHERE id = ${changeId}`;
    return null;
  });

/** Fails when there is no lore with that identifier. */
const requireLoreEntry = (loreEntryId: string) =>
  readLoreEntry(loreEntryId).pipe(
    Effect.flatMap((row) => (row === null ? notFound("No such lore entry.") : Effect.succeed(row))),
  );

/** The owner corrects a lore entry's text. Callers run it in a transaction. */
export const editLoreEntryByOwner = (loreEntryId: string, text: string) =>
  Effect.gen(function* () {
    const problem = textProblemOf(text);
    if (problem !== null) return yield* invalid(`Not saved: ${problem}.`);
    yield* requireLoreEntry(loreEntryId);
    yield* correctLoreEntry(loreEntryId, text, owner);
    return null;
  });

/** The owner deletes a lore entry; changes awaiting approval on it go with it. Callers run it in a transaction. */
export const deleteLoreEntryByOwner = (loreEntryId: string) =>
  Effect.gen(function* () {
    yield* requireLoreEntry(loreEntryId);
    yield* deleteLoreEntry(loreEntryId, owner);
    return null;
  });

/** The owner pins a lore entry so it never fades, or unpins it. Callers run it in a transaction. */
export const pinLoreEntryByOwner = (loreEntryId: string, isPinned: boolean) =>
  Effect.gen(function* () {
    yield* requireLoreEntry(loreEntryId);
    yield* pinLoreEntry(loreEntryId, isPinned);
    return null;
  });

/** The owner makes a dormant or archived lore active again. Callers run it in a transaction. */
export const restoreLoreEntryByOwner = (loreEntryId: string) =>
  Effect.gen(function* () {
    yield* requireLoreEntry(loreEntryId);
    yield* restoreLoreEntry(loreEntryId);
    return null;
  });
