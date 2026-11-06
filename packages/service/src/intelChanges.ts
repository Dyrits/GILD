import type { IntelChangeKind, IntelChangeStatus } from "@openmission/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, notFound } from "./errors.ts";
import {
  type IntelRow,
  intelLimit,
  listInScope,
  type Placement,
  readIntel,
  readScopeChain,
  type ScopeChain,
  widthOf,
} from "./intel.ts";
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
  readonly kind: IntelChangeKind;
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
    yield* sql`INSERT INTO intel_changes (id, thread_id, kind, status, intel_id, scope, scope_thread_id,
        scope_workspace_id, text, previous_text, at, resolved_at)
      VALUES (${crypto.randomUUID()}, ${change.threadId}, ${change.kind}, ${change.status}, ${change.intelId},
        ${change.placement.scope}, ${change.placement.threadId}, ${change.placement.workspaceId}, ${change.text},
        ${change.previousText}, ${now}, ${change.status === "Done" ? now : null})`;
  });

/** Stores a new intel, saved by a thread or, with null, by the owner. Callers run it in a transaction. */
const insertIntel = (placement: Placement, text: string, savedBy: string | null) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const now = yield* Clock.currentTimeMillis;
    const id = crypto.randomUUID();
    yield* sql`INSERT INTO intels (id, scope, thread_id, workspace_id, text, saved_by_thread_id, saved_by_title,
        saved_at, updated_at)
      VALUES (${id}, ${placement.scope}, ${placement.threadId}, ${placement.workspaceId}, ${text.trim()}, ${savedBy},
        (SELECT title FROM threads WHERE id = ${savedBy}), ${now}, ${now})`;
    return id;
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

/** `save_intel`: saves thread and workspace intel at once; a global save waits for the owner. */
export const saveIntel = (threadId: string, text: string, scope: ToolScope) =>
  Effect.gen(function* () {
    const problem = textProblemOf(text);
    if (problem !== null) return answer(`Not saved: ${problem}.`, true);
    const chain = yield* readScopeChain(threadId);
    const placement = placementOf(chain, scope);
    if (typeof placement === "string") return answer(`Not saved: ${placement}.`, true);
    const change = { kind: "Save", placement, previousText: null, text: text.trim(), threadId } as const;
    if (placement.scope === "Global") {
      yield* insertChange({ ...change, intelId: null, status: "Awaiting" });
      return answer(awaitingText);
    }
    const intelId = yield* insertIntel(placement, text, threadId);
    yield* insertChange({ ...change, intelId, status: "Done" });
    return answer(`Saved intel ${intelId} (${scope}).`);
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
      kind: "Update",
      placement,
      previousText: row.text,
      text: (text ?? row.text).trim(),
      threadId,
    } as const;
    if (isWidening || row.scope === "Global") {
      yield* insertChange({ ...change, status: "Awaiting" });
      return answer(awaitingText);
    }
    yield* writeIntel(intelId, placement, change.text);
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
      kind: "Forget",
      placement: placementOfRow(row),
      previousText: row.text,
      text: row.text,
      threadId,
    } as const;
    if (row.scope === "Global") {
      yield* insertChange({ ...change, status: "Awaiting" });
      return answer(awaitingText);
    }
    yield* sql`DELETE FROM intels WHERE id = ${intelId}`;
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
      kind: IntelChangeKind;
      status: IntelChangeStatus;
      intelId: string | null;
      scope: Placement["scope"];
      scopeThreadId: string | null;
      scopeWorkspaceId: string | null;
      text: string;
      threadId: string;
    }>`
      SELECT kind, status, intel_id AS intelId, scope, scope_thread_id AS scopeThreadId,
        scope_workspace_id AS scopeWorkspaceId, text, thread_id AS threadId
      FROM intel_changes WHERE id = ${changeId}`;
    if (change === undefined) return yield* notFound("No such change to intel.");
    if (change.status !== "Awaiting") return yield* invalid("This change was already decided.");
    const placement = { scope: change.scope, threadId: change.scopeThreadId, workspaceId: change.scopeWorkspaceId };
    const target = change.intelId === null ? null : yield* readIntel(change.intelId);
    const isApplied = isApproved && (change.kind === "Save" || target !== null);
    if (isApplied && change.kind === "Save") {
      const intelId = yield* insertIntel(placement, change.text, change.threadId);
      yield* sql`UPDATE intel_changes SET intel_id = ${intelId} WHERE id = ${changeId}`;
    }
    if (isApplied && change.kind === "Update" && change.intelId !== null) {
      yield* writeIntel(change.intelId, placement, change.text);
    }
    if (isApplied && change.kind === "Forget") yield* sql`DELETE FROM intels WHERE id = ${change.intelId}`;
    const now = yield* Clock.currentTimeMillis;
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
    yield* writeIntel(intelId, placementOfRow(row), text);
    return null;
  });

/** The owner deletes an intel; changes awaiting approval on it go with it. Callers run it in a transaction. */
export const deleteIntelByOwner = (intelId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    if ((yield* readIntel(intelId)) === null) return yield* notFound("No such intel.");
    yield* sql`DELETE FROM intels WHERE id = ${intelId}`;
    const now = yield* Clock.currentTimeMillis;
    yield* sql`UPDATE intel_changes SET status = 'Declined', resolved_at = ${now}
      WHERE intel_id = ${intelId} AND status = 'Awaiting'`;
    return null;
  });
