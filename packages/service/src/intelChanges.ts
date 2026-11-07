import type {
  IntelChangeKind,
  IntelChangeStatus,
  IntelHistoryKind,
  IntelKind,
  IntelOrigin,
} from "@openmission/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, notFound } from "./errors.ts";
import {
  type IntelRow,
  intelLimit,
  listInScope,
  originOf,
  type Placement,
  readIntel,
  readScopeChain,
  type ScopeChain,
  widthOf,
} from "./intel.ts";
import { duplicatesOf } from "./intelDuplicates.ts";
import { kindOfTool, readFading, summaryOf, type ToolKind } from "./intelFading.ts";
import { owner, recordSaved, threadActor, trackChange } from "./intelHistory.ts";
import { originColumnsOf, readOrigin } from "./intelOrigins.ts";
import { tokensOf } from "./journal.ts";
import type { ToolAnswer } from "./threadTools.ts";

// Changes to intel (scoped-intel, Saving, Correcting and deleting, Widening): threads change thread and
// workspace intel on their own; a global save, change, or deletion and every widening wait for the owner.

/** The scopes a thread names in its intel tools; mission is the top thread's scope. */
export type ToolScope = "thread" | "mission" | "workspace" | "global";

const answer = (text: string, isError = false): ToolAnswer => ({ isError, text });

/** Where a thread's chosen scope puts an intel, or why it cannot. */
const placementOf = (chain: ScopeChain, scope: ToolScope): Placement | string => {
  const placements = {
    global: { scope: "Global", threadId: null, workspaceId: null },
    mission: { scope: "Thread", threadId: chain.topThreadId, workspaceId: null },
    thread: { scope: "Thread", threadId: chain.threads[0] ?? null, workspaceId: null },
    workspace:
      chain.workspaceId === null
        ? "you have no workspace: choose thread or mission instead"
        : { scope: "Workspace", threadId: null, workspaceId: chain.workspaceId },
  } as const satisfies Record<ToolScope, Placement | string>;
  return placements[scope];
};

const placementOfRow = (row: IntelRow): Placement => ({
  scope: row.scope,
  threadId: row.threadId,
  workspaceId: row.workspaceId,
});

const toolScopeOf = (placement: Placement, chain: ScopeChain) =>
  placement.scope === "Thread"
    ? placement.threadId === chain.topThreadId
      ? "mission"
      : "thread"
    : placement.scope.toLowerCase();

/** Why a text cannot be an intel, or null when it can. */
export const textProblemOf = (text: string) => {
  if (text.trim() === "") return "the intel is empty";
  const tokens = tokensOf(text);
  return tokens > intelLimit
    ? `the intel is about ${tokens} tokens, over the limit of ${intelLimit}: save one fact per intel`
    : null;
};

interface ChangeRecord {
  readonly intelId: string | null;
  readonly intelKind: IntelKind;
  readonly kind: IntelChangeKind;
  /** What a save or replacement rests on; null for other changes. */
  readonly origin: IntelOrigin | null;
  readonly placement: Placement;
  readonly previousText: string | null;
  readonly status: IntelChangeStatus;
  readonly text: string;
  readonly threadId: string;
}

const insertChange = (change: ChangeRecord) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const now = yield* Clock.currentTimeMillis;
    const origin = originColumnsOf(change.origin);
    yield* sql`INSERT INTO intel_changes (id, thread_id, kind, status, intel_id, intel_kind, scope, scope_thread_id,
        scope_workspace_id, text, previous_text, at, resolved_at, origin_kind, origin_entry, origin_from, origin_excerpt)
      VALUES (${crypto.randomUUID()}, ${change.threadId}, ${change.kind}, ${change.status}, ${change.intelId},
        ${change.intelKind},
        ${change.placement.scope}, ${change.placement.threadId}, ${change.placement.workspaceId}, ${change.text},
        ${change.previousText}, ${now}, ${change.status === "Done" ? now : null}, ${origin.originKind},
        ${origin.originEntry}, ${origin.originFrom}, ${origin.originExcerpt})`;
  });

/** Stores a new intel saved by a thread, with what it rests on. Callers run it in a transaction. */
const insertIntel = (
  placement: Placement,
  kind: IntelKind,
  text: string,
  savedBy: string | null,
  given: IntelOrigin | null,
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const now = yield* Clock.currentTimeMillis;
    const id = crypto.randomUUID();
    const origin = originColumnsOf(given);
    yield* sql`INSERT INTO intels (id, scope, kind, thread_id, workspace_id, text, saved_by_thread_id, saved_by_title,
        saved_at, updated_at, last_used_at, origin_kind, origin_entry, origin_from, origin_excerpt)
      VALUES (${id}, ${placement.scope}, ${kind}, ${placement.threadId}, ${placement.workspaceId}, ${text.trim()},
        ${savedBy}, (SELECT title FROM threads WHERE id = ${savedBy}), ${now}, ${now}, ${now}, ${origin.originKind},
        ${origin.originEntry}, ${origin.originFrom}, ${origin.originExcerpt})`;
    return id;
  });

/**
 * A replacement's new text, kind, and origin on the intel it replaces, which keeps its identifier, scope, and
 * uses. Restating it makes it active again at full strength (provisional, work-in-progress Batch 14).
 */
const replaceIntel = (intelId: string, kind: IntelKind, text: string, given: IntelOrigin | null) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const now = yield* Clock.currentTimeMillis;
    const origin = originColumnsOf(given);
    yield* sql`UPDATE intels SET kind = ${kind}, text = ${text.trim()}, updated_at = ${now}, last_used_at = ${now},
        origin_kind = ${origin.originKind}, origin_entry = ${origin.originEntry}, origin_from = ${origin.originFrom},
        origin_excerpt = ${origin.originExcerpt}
      WHERE id = ${intelId}`;
  });

const writeIntel = (intelId: string, placement: Placement, text: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const now = yield* Clock.currentTimeMillis;
    yield* sql`UPDATE intels SET scope = ${placement.scope}, thread_id = ${placement.threadId},
      workspace_id = ${placement.workspaceId}, text = ${text.trim()}, updated_at = ${now} WHERE id = ${intelId}`;
  });

const awaitingText =
  "Awaiting approval: the owner decides on it. Carry on with your work; do not make the same change again.";

/** The close intels a save did not replace, for the thread to correct or delete if one is outdated. */
const closeNoteOf = (close: ReadonlyArray<IntelRow>) =>
  close.length === 0
    ? ""
    : ` Close intels, in case one is outdated: ${close.map((row) => `[${row.id}] ${summaryOf(row.text)}`).join("; ")}.`;

/**
 * `save_intel`: saves thread and workspace intel at once; a global save waits for the owner. A save repeating
 * an intel in its scope or a wider one replaces that intel instead; a global replacement waits for the owner.
 */
export const saveIntel = (
  threadId: string,
  text: string,
  scope: ToolScope,
  toolKind: ToolKind,
  journalEntry: number | null,
) =>
  Effect.gen(function* () {
    const problem = textProblemOf(text);
    if (problem !== null) return answer(`Not saved: ${problem}.`, true);
    const chain = yield* readScopeChain(threadId);
    const placement = placementOf(chain, scope);
    if (typeof placement === "string") return answer(`Not saved: ${placement}.`, true);
    const origin = yield* readOrigin(threadId, journalEntry);
    if (typeof origin === "string") return answer(`Not saved: ${origin}.`, true);
    const intelKind = kindOfTool[toolKind];
    const { close, replaced } = duplicatesOf(text, placement, chain, yield* listInScope(chain), yield* readFading);
    const note = closeNoteOf(close);
    if (replaced !== null) {
      const replacement = {
        intelId: replaced.id,
        intelKind,
        kind: "Replace",
        origin,
        placement: placementOfRow(replaced),
        previousText: replaced.text,
        text: text.trim(),
        threadId,
      } as const;
      if (replaced.scope === "Global") {
        yield* insertChange({ ...replacement, status: "Awaiting" });
        return answer(`It repeats global intel ${replaced.id}, "${replaced.text}", so it replaces it. ${awaitingText}`);
      }
      yield* trackChange(
        replaced.id,
        "Replaced",
        threadActor(threadId),
        replaceIntel(replaced.id, intelKind, text, origin),
      );
      yield* insertChange({ ...replacement, status: "Done" });
      return answer(`Replaced intel ${replaced.id}: it said "${replaced.text}"; it now says the new text.${note}`);
    }
    const change = {
      intelKind,
      kind: "Save",
      origin,
      placement,
      previousText: null,
      text: text.trim(),
      threadId,
    } as const;
    if (placement.scope === "Global") {
      yield* insertChange({ ...change, intelId: null, status: "Awaiting" });
      return answer(`${awaitingText}${note}`);
    }
    const intelId = yield* insertIntel(placement, intelKind, text, threadId, origin);
    yield* recordSaved(intelId, threadActor(threadId));
    yield* insertChange({ ...change, intelId, status: "Done" });
    return answer(`Saved intel ${intelId} (${scope}, ${toolKind}).${note}`);
  });

/** The intel with that identifier in the thread's scope, or null. */
const readInScope = (chain: ScopeChain, intelId: string) =>
  listInScope(chain).pipe(Effect.map((rows) => rows.find((row) => row.id === intelId) ?? null));

/** `update_intel`: corrects thread and workspace intel at once; a global change or a widening waits for the owner. */
export const updateIntel = (threadId: string, intelId: string, text: string | null, scope: ToolScope | null) =>
  Effect.gen(function* () {
    if (text === null && scope === null) return answer("Not changed: give text, scope, or both.", true);
    const problem = text === null ? null : textProblemOf(text);
    if (problem !== null) return answer(`Not changed: ${problem}.`, true);
    const chain = yield* readScopeChain(threadId);
    const row = yield* readInScope(chain, intelId);
    if (row === null) return answer(`Not changed: no intel ${intelId} in your scope.`, true);
    const current = placementOfRow(row);
    const placement = scope === null ? current : placementOf(chain, scope);
    if (typeof placement === "string") return answer(`Not changed: ${placement}.`, true);
    const isWidening = widthOf(placement, chain.topThreadId) > widthOf(current, chain.topThreadId);
    if (scope !== null && !isWidening) {
      return answer(
        `Not changed: intel ${intelId} is ${toolScopeOf(current, chain)} intel; update_intel only widens a scope.`,
        true,
      );
    }
    const change = {
      intelId,
      intelKind: row.kind,
      kind: "Update",
      origin: null,
      placement,
      previousText: row.text,
      text: (text ?? row.text).trim(),
      threadId,
    } as const;
    if (isWidening || row.scope === "Global") {
      yield* insertChange({ ...change, status: "Awaiting" });
      return answer(awaitingText);
    }
    yield* trackChange(intelId, "Corrected", threadActor(threadId), writeIntel(intelId, placement, change.text));
    yield* insertChange({ ...change, status: "Done" });
    return answer(`Updated intel ${intelId}.`);
  });

/** `forget_intel`: deletes thread and workspace intel at once; deleting a global intel waits for the owner. */
export const forgetIntel = (threadId: string, intelId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const chain = yield* readScopeChain(threadId);
    const row = yield* readInScope(chain, intelId);
    if (row === null) return answer(`Not deleted: no intel ${intelId} in your scope.`, true);
    const change = {
      intelId,
      intelKind: row.kind,
      kind: "Forget",
      origin: null,
      placement: placementOfRow(row),
      previousText: row.text,
      text: row.text,
      threadId,
    } as const;
    if (row.scope === "Global") {
      yield* insertChange({ ...change, status: "Awaiting" });
      return answer(awaitingText);
    }
    yield* trackChange(intelId, "Deleted", threadActor(threadId), sql`DELETE FROM intels WHERE id = ${intelId}`);
    yield* insertChange({ ...change, status: "Done" });
    return answer(`Deleted intel ${intelId}.`);
  });

/**
 * The owner approves or declines a change awaiting approval. An approved change to an intel deleted in the
 * meantime is declined, since there is nothing left to change. Callers run it in a transaction.
 */
export const resolveIntelChange = (changeId: string, isApproved: boolean) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [change] = yield* sql<{
      intelKind: IntelKind;
      kind: IntelChangeKind;
      originEntry: number | null;
      originExcerpt: string | null;
      originFrom: string | null;
      originKind: IntelOrigin["kind"] | null;
      status: IntelChangeStatus;
      intelId: string | null;
      scope: Placement["scope"];
      scopeThreadId: string | null;
      scopeWorkspaceId: string | null;
      text: string;
      threadId: string;
    }>`
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
    const actor = threadActor(change.threadId);
    // An approved change is recorded in the intel's history as the thread's, with the owner's approval.
    const track = <A, E, R>(intelId: string, kind: IntelHistoryKind, apply: Effect.Effect<A, E, R>) =>
      trackChange(intelId, kind, actor, apply, now);
    if (isApplied && change.kind === "Save") {
      const intelId = yield* insertIntel(placement, change.intelKind, change.text, change.threadId, originOf(change));
      yield* recordSaved(intelId, actor, now);
      yield* sql`UPDATE intel_changes SET intel_id = ${intelId} WHERE id = ${changeId}`;
    }
    if (isApplied && target !== null && change.kind === "Update") {
      const isWidening = target.scope !== placement.scope || target.threadId !== placement.threadId;
      yield* track(target.id, isWidening ? "Widened" : "Corrected", writeIntel(target.id, placement, change.text));
    }
    if (isApplied && target !== null && change.kind === "Replace") {
      yield* track(target.id, "Replaced", replaceIntel(target.id, change.intelKind, change.text, originOf(change)));
    }
    if (isApplied && target !== null && change.kind === "Forget") {
      yield* track(target.id, "Deleted", sql`DELETE FROM intels WHERE id = ${target.id}`);
    }
    yield* sql`UPDATE intel_changes SET status = ${isApplied ? "Approved" : "Declined"}, resolved_at = ${now}
      WHERE id = ${changeId}`;
    return null;
  });

/** The owner corrects an intel's text. Callers run it in a transaction. */
export const editIntelByOwner = (intelId: string, text: string) =>
  Effect.gen(function* () {
    const problem = textProblemOf(text);
    if (problem !== null) return yield* invalid(`Not saved: ${problem}.`);
    const row = yield* readIntel(intelId);
    if (row === null) return yield* notFound("No such intel.");
    yield* trackChange(intelId, "Edited", owner, writeIntel(intelId, placementOfRow(row), text));
    return null;
  });

/** The owner deletes an intel; changes awaiting approval on it go with it. Callers run it in a transaction. */
export const deleteIntelByOwner = (intelId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    if ((yield* readIntel(intelId)) === null) return yield* notFound("No such intel.");
    yield* trackChange(intelId, "Deleted", owner, sql`DELETE FROM intels WHERE id = ${intelId}`);
    const now = yield* Clock.currentTimeMillis;
    yield* sql`UPDATE intel_changes SET status = 'Declined', resolved_at = ${now}
      WHERE intel_id = ${intelId} AND status = 'Awaiting'`;
    return null;
  });

/** The owner pins an intel so it never fades, or unpins it. Callers run it in a transaction. */
export const pinIntelByOwner = (intelId: string, isPinned: boolean) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    if ((yield* readIntel(intelId)) === null) return yield* notFound("No such intel.");
    yield* trackChange(
      intelId,
      isPinned ? "Pinned" : "Unpinned",
      owner,
      sql`UPDATE intels SET is_pinned = ${isPinned ? 1 : 0} WHERE id = ${intelId}`,
    );
    return null;
  });

/**
 * The owner makes a dormant or archived intel active again: its last use becomes now, at full strength,
 * without counting a use (work-in-progress, Batch 13). Callers run it in a transaction.
 */
export const restoreIntelByOwner = (intelId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    if ((yield* readIntel(intelId)) === null) return yield* notFound("No such intel.");
    const now = yield* Clock.currentTimeMillis;
    yield* trackChange(intelId, "Restored", owner, sql`UPDATE intels SET last_used_at = ${now} WHERE id = ${intelId}`);
    return null;
  });
