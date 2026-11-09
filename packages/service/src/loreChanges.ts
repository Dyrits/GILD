import type { LoreChangeKind, LoreChangeStatus, LoreKind, LoreOrigin } from "@gild/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { tokensOf } from "./journal.ts";
import {
  type LoreEntryRow,
  listInScope,
  loreLimit,
  type Placement,
  readScopeChain,
  type ScopeChain,
  widthOf,
} from "./lore.ts";
import { duplicatesOf } from "./loreDuplicates.ts";
import { kindOfTool, readFading, summaryOf, type ToolKind } from "./loreFading.ts";
import { threadActor } from "./loreHistory.ts";
import { originColumnsOf, readOrigin } from "./loreOrigins.ts";
import { correctLoreEntry, deleteLoreEntry, insertLoreEntry, replaceLoreEntry } from "./loreStore.ts";
import type { ToolAnswer } from "./threadTools.ts";

// Stored and wire names keep `intel` so existing data and agents still work: table and column names (`intels`, `intel_id`, ...) and thread tool names (`save_intel`, ...).

// Changes to lore (scoped-intel, Saving, Correcting and deleting, Widening): threads change thread and
// workspace lore on their own; a global save, change, or deletion and every widening wait for the owner
// (loreDecisions.ts). The lore store writes the lore and its history.

/** The scopes a thread names in its lore tools; mission is the top thread's scope. */
export type ToolScope = "thread" | "mission" | "workspace" | "global";

const answer = (text: string, isError = false): ToolAnswer => ({ isError, text });

/** Where a thread's chosen scope puts a lore entry, or why it cannot. */
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

const placementOfRow = (row: LoreEntryRow): Placement => ({
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

/** Why a text cannot be a lore entry, or null when it can. */
export const textProblemOf = (text: string) => {
  if (text.trim() === "") return "the lore entry is empty";
  const tokens = tokensOf(text);
  return tokens > loreLimit
    ? `the lore entry is about ${tokens} tokens, over the limit of ${loreLimit}: save one fact per lore entry`
    : null;
};

interface ChangeRecord {
  readonly kind: LoreChangeKind;
  readonly loreEntryId: string | null;
  readonly loreKind: LoreKind;
  /** What a save or replacement rests on; null for other changes. */
  readonly origin: LoreOrigin | null;
  readonly placement: Placement;
  readonly previousText: string | null;
  readonly status: LoreChangeStatus;
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
      VALUES (${crypto.randomUUID()}, ${change.threadId}, ${change.kind}, ${change.status}, ${change.loreEntryId},
        ${change.loreKind},
        ${change.placement.scope}, ${change.placement.threadId}, ${change.placement.workspaceId}, ${change.text},
        ${change.previousText}, ${now}, ${change.status === "Done" ? now : null}, ${origin.originKind},
        ${origin.originEntry}, ${origin.originFrom}, ${origin.originExcerpt})`;
  });

const awaitingText =
  "Awaiting approval: the owner decides on it. Carry on with your work; do not make the same change again.";

/** The close lore entries a save did not replace, for the thread to correct or delete if one is outdated. */
const closeNoteOf = (close: ReadonlyArray<LoreEntryRow>) =>
  close.length === 0
    ? ""
    : ` Close lore entries, in case one is outdated: ${close.map((row) => `[${row.id}] ${summaryOf(row.text)}`).join("; ")}.`;

/**
 * `save_intel`: saves thread and workspace lore at once; a global save waits for the owner. A save repeating
 * a lore entry in its scope or a wider one replaces that lore entry instead; a global replacement waits for the owner.
 */
export const saveLoreEntry = (
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
    const loreKind = kindOfTool[toolKind];
    const { close, replaced } = duplicatesOf(text, placement, chain, yield* listInScope(chain), yield* readFading);
    const note = closeNoteOf(close);
    if (replaced !== null) {
      const replacement = {
        kind: "Replace",
        loreEntryId: replaced.id,
        loreKind,
        origin,
        placement: placementOfRow(replaced),
        previousText: replaced.text,
        text: text.trim(),
        threadId,
      } as const;
      if (replaced.scope === "Global") {
        yield* insertChange({ ...replacement, status: "Awaiting" });
        return answer(
          `It repeats global lore entry ${replaced.id}, "${replaced.text}", so it replaces it. ${awaitingText}`,
        );
      }
      yield* replaceLoreEntry(replaced.id, { kind: loreKind, origin, text }, threadActor(threadId));
      yield* insertChange({ ...replacement, status: "Done" });
      return answer(`Replaced lore entry ${replaced.id}: it said "${replaced.text}"; it now says the new text.${note}`);
    }
    const change = {
      kind: "Save",
      loreKind,
      origin,
      placement,
      previousText: null,
      text: text.trim(),
      threadId,
    } as const;
    if (placement.scope === "Global") {
      yield* insertChange({ ...change, loreEntryId: null, status: "Awaiting" });
      return answer(`${awaitingText}${note}`);
    }
    const loreEntryId = yield* insertLoreEntry({ kind: loreKind, origin, placement, text, threadId });
    yield* insertChange({ ...change, loreEntryId, status: "Done" });
    return answer(`Saved lore entry ${loreEntryId} (${scope}, ${toolKind}).${note}`);
  });

/** The lore with that identifier in the thread's scope, or null. */
const readInScope = (chain: ScopeChain, loreEntryId: string) =>
  listInScope(chain).pipe(Effect.map((rows) => rows.find((row) => row.id === loreEntryId) ?? null));

/** `update_intel`: corrects thread and workspace lore at once; a global change or a widening waits for the owner. */
export const updateLoreEntry = (threadId: string, loreEntryId: string, text: string | null, scope: ToolScope | null) =>
  Effect.gen(function* () {
    if (text === null && scope === null) return answer("Not changed: give text, scope, or both.", true);
    const problem = text === null ? null : textProblemOf(text);
    if (problem !== null) return answer(`Not changed: ${problem}.`, true);
    const chain = yield* readScopeChain(threadId);
    const row = yield* readInScope(chain, loreEntryId);
    if (row === null) return answer(`Not changed: no lore entry ${loreEntryId} in your scope.`, true);
    const current = placementOfRow(row);
    const placement = scope === null ? current : placementOf(chain, scope);
    if (typeof placement === "string") return answer(`Not changed: ${placement}.`, true);
    const isWidening = widthOf(placement, chain.topThreadId) > widthOf(current, chain.topThreadId);
    if (scope !== null && !isWidening) {
      return answer(
        `Not changed: lore entry ${loreEntryId} is ${toolScopeOf(current, chain)} lore; update_intel only widens a scope.`,
        true,
      );
    }
    const change = {
      kind: "Update",
      loreEntryId,
      loreKind: row.kind,
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
    // Only a widening moves a lore entry, and it waits for the owner, so a change done at once is a correction.
    yield* correctLoreEntry(loreEntryId, change.text, threadActor(threadId));
    yield* insertChange({ ...change, status: "Done" });
    return answer(`Updated lore entry ${loreEntryId}.`);
  });

/** `forget_intel`: deletes thread and workspace lore at once; deleting a global lore entry waits for the owner. */
export const forgetLoreEntry = (threadId: string, loreEntryId: string) =>
  Effect.gen(function* () {
    const chain = yield* readScopeChain(threadId);
    const row = yield* readInScope(chain, loreEntryId);
    if (row === null) return answer(`Not deleted: no lore entry ${loreEntryId} in your scope.`, true);
    const change = {
      kind: "Forget",
      loreEntryId,
      loreKind: row.kind,
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
    yield* deleteLoreEntry(loreEntryId, threadActor(threadId));
    yield* insertChange({ ...change, status: "Done" });
    return answer(`Deleted lore entry ${loreEntryId}.`);
  });
