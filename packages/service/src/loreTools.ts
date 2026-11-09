import { Effect } from "effect";
import type { SqlClient } from "effect/sql";
import { forgetLoreEntry, saveLoreEntry, updateLoreEntry } from "./loreChanges.ts";
import { relyOnLore, searchLoreText } from "./loreViews.ts";
import { searchInvalid, type ToolHandlers } from "./threadTools.ts";

// Stored and wire names keep `intel` so existing data and agents still work: thread tool names (`save_intel`, ...).

/** Answers the lore thread tools (scoped-intel, External contract); `commit` runs a change in one transaction and announces it. */
export const loreToolsOf = (
  commit: <A, E>(work: Effect.Effect<A, E, SqlClient.SqlClient>) => Effect.Effect<A>,
): Pick<ToolHandlers, "forget_intel" | "relied_on_intel" | "save_intel" | "search_intel" | "update_intel"> => ({
  forget_intel: (threadId, { id }) => commit(forgetLoreEntry(threadId, id)),
  relied_on_intel: (threadId, { ids }) => commit(relyOnLore(threadId, ids)),
  save_intel: (threadId, { journalEntry, kind, scope, text }) =>
    commit(saveLoreEntry(threadId, text, scope, kind, journalEntry ?? null)),
  search_intel: (threadId, { ids, query, scope }) =>
    query === undefined && (ids === undefined || ids.length === 0)
      ? Effect.succeed(searchInvalid)
      : commit(searchLoreText(threadId, query ?? null, ids ?? [], scope ?? null)).pipe(
          Effect.map((text) => ({ isError: false, text })),
        ),
  update_intel: (threadId, { id, scope, text }) => commit(updateLoreEntry(threadId, id, text ?? null, scope ?? null)),
});
