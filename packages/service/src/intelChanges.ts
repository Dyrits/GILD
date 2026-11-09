import type { IntelChangeKind, IntelChangeStatus, IntelKind, IntelOrigin } from "@gild/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import {
  type IntelRow,
  intelLimit,
  listInScope,
  type Placement,
  readScopeChain,
  type ScopeChain,
  widthOf,
} from "./intel.ts";
import { duplicatesOf } from "./intelDuplicates.ts";
import { kindOfTool, readFading, summaryOf, type ToolKind } from "./intelFading.ts";
import { threadActor } from "./intelHistory.ts";
import { originColumnsOf, readOrigin } from "./intelOrigins.ts";
import { correctIntel, deleteIntel, insertIntel, replaceIntel } from "./intelStore.ts";
import { tokensOf } from "./journal.ts";
import type { ToolAnswer } from "./threadTools.ts";

// Changes to intel (scoped-intel, Saving, Correcting and deleting, Widening): threads change thread and
// workspace intel on their own; a global save, change, or deletion and every widening wait for the owner
// (intelDecisions.ts). The intel store writes the intel and its history.

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
      yield* replaceIntel(replaced.id, { kind: intelKind, origin, text }, threadActor(threadId));
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
    const intelId = yield* insertIntel({ kind: intelKind, origin, placement, text, threadId });
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
    // Only a widening moves an intel, and it waits for the owner, so a change done at once is a correction.
    yield* correctIntel(intelId, change.text, threadActor(threadId));
    yield* insertChange({ ...change, status: "Done" });
    return answer(`Updated intel ${intelId}.`);
  });

/** `forget_intel`: deletes thread and workspace intel at once; deleting a global intel waits for the owner. */
export const forgetIntel = (threadId: string, intelId: string) =>
  Effect.gen(function* () {
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
    yield* deleteIntel(intelId, threadActor(threadId));
    yield* insertChange({ ...change, status: "Done" });
    return answer(`Deleted intel ${intelId}.`);
  });
