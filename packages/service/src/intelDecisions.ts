import type { IntelChangeKind, IntelChangeStatus, IntelKind, IntelOrigin } from "@canopy/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, notFound } from "./errors.ts";
import { originOf, type Placement, readIntel } from "./intel.ts";
import { textProblemOf } from "./intelChanges.ts";
import { owner, threadActor } from "./intelHistory.ts";
import {
  correctIntel,
  deleteIntel,
  insertIntel,
  moveIntel,
  pinIntel,
  replaceIntel,
  restoreIntel,
} from "./intelStore.ts";

// The owner's decisions on intel (scoped-intel, Correcting and deleting, Widening, Intel panel): approving or
// declining a thread's change awaiting approval, and editing, deleting, pinning, or restoring any intel.

/** One stored change awaiting the owner, with what applying it needs. */
interface ChangeRow {
  readonly intelId: string | null;
  readonly intelKind: IntelKind;
  readonly kind: IntelChangeKind;
  readonly originEntry: number | null;
  readonly originExcerpt: string | null;
  readonly originFrom: string | null;
  readonly originKind: IntelOrigin["kind"] | null;
  readonly scope: Placement["scope"];
  readonly scopeThreadId: string | null;
  readonly scopeWorkspaceId: string | null;
  readonly status: IntelChangeStatus;
  readonly text: string;
  readonly threadId: string;
}

/**
 * The owner approves or declines a change awaiting approval. An approved change to an intel deleted in the
 * meantime is declined, since there is nothing left to change. Callers run it in a transaction.
 */
export const resolveIntelChange = (changeId: string, isApproved: boolean) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [change] = yield* sql<ChangeRow>`
      SELECT kind, intel_kind AS intelKind, status, intel_id AS intelId, scope, scope_thread_id AS scopeThreadId,
        scope_workspace_id AS scopeWorkspaceId, text, thread_id AS threadId, origin_kind AS originKind,
        origin_entry AS originEntry, origin_from AS originFrom, origin_excerpt AS originExcerpt
      FROM intel_changes WHERE id = ${changeId}`;
    if (change === undefined) return yield* notFound("No such change to intel.");
    if (change.status !== "Awaiting") return yield* invalid("This change was already decided.");
    const placement = { scope: change.scope, threadId: change.scopeThreadId, workspaceId: change.scopeWorkspaceId };
    const target = change.intelId === null ? null : yield* readIntel(change.intelId);
    const isApplied = isApproved && (change.kind === "Save" || target !== null);
    const now = yield* Clock.currentTimeMillis;
    // An approved change is recorded in the intel's history as the thread's, with the owner's approval.
    const actor = threadActor(change.threadId);
    // Every change but Save acts on its target intel.
    const applyToTarget = {
      Forget: (intel: NonNullable<typeof target>) => deleteIntel(intel.id, actor, now),
      Replace: (intel: NonNullable<typeof target>) =>
        replaceIntel(intel.id, { kind: change.intelKind, origin: originOf(change), text: change.text }, actor, now),
      Update: (intel: NonNullable<typeof target>) => {
        const isWidening = intel.scope !== placement.scope || intel.threadId !== placement.threadId;
        return isWidening
          ? moveIntel(intel.id, placement, change.text, "Widened", actor, now)
          : correctIntel(intel.id, change.text, actor, now);
      },
    } satisfies Record<Exclude<IntelChangeKind, "Save">, unknown>;
    if (isApplied && change.kind === "Save") {
      const intel = { kind: change.intelKind, origin: originOf(change), placement, text: change.text };
      const intelId = yield* insertIntel({ ...intel, threadId: change.threadId }, now);
      yield* sql`UPDATE intel_changes SET intel_id = ${intelId} WHERE id = ${changeId}`;
    } else if (isApplied && target !== null && change.kind !== "Save") {
      yield* applyToTarget[change.kind](target);
    }
    yield* sql`UPDATE intel_changes SET status = ${isApplied ? "Approved" : "Declined"}, resolved_at = ${now}
      WHERE id = ${changeId}`;
    return null;
  });

/** Fails when there is no intel with that identifier. */
const requireIntel = (intelId: string) =>
  readIntel(intelId).pipe(Effect.flatMap((row) => (row === null ? notFound("No such intel.") : Effect.succeed(row))));

/** The owner corrects an intel's text. Callers run it in a transaction. */
export const editIntelByOwner = (intelId: string, text: string) =>
  Effect.gen(function* () {
    const problem = textProblemOf(text);
    if (problem !== null) return yield* invalid(`Not saved: ${problem}.`);
    yield* requireIntel(intelId);
    yield* correctIntel(intelId, text, owner);
    return null;
  });

/** The owner deletes an intel; changes awaiting approval on it go with it. Callers run it in a transaction. */
export const deleteIntelByOwner = (intelId: string) =>
  Effect.gen(function* () {
    yield* requireIntel(intelId);
    yield* deleteIntel(intelId, owner);
    return null;
  });

/** The owner pins an intel so it never fades, or unpins it. Callers run it in a transaction. */
export const pinIntelByOwner = (intelId: string, isPinned: boolean) =>
  Effect.gen(function* () {
    yield* requireIntel(intelId);
    yield* pinIntel(intelId, isPinned);
    return null;
  });

/** The owner makes a dormant or archived intel active again. Callers run it in a transaction. */
export const restoreIntelByOwner = (intelId: string) =>
  Effect.gen(function* () {
    yield* requireIntel(intelId);
    yield* restoreIntel(intelId);
    return null;
  });
