import { Effect } from "effect";
import type { SqlClient } from "effect/sql";
import { forgetIntel, saveIntel, updateIntel } from "./intelChanges.ts";
import { relyOnIntel, searchIntelText } from "./intelViews.ts";
import { searchInvalid, type ToolHandlers } from "./threadTools.ts";

/** Answers the intel thread tools (scoped-intel, External contract); `commit` runs a change in one transaction and announces it. */
export const intelToolsOf = (
  commit: <A, E>(work: Effect.Effect<A, E, SqlClient.SqlClient>) => Effect.Effect<A>,
): Pick<ToolHandlers, "forget_intel" | "relied_on_intel" | "save_intel" | "search_intel" | "update_intel"> => ({
  forget_intel: (threadId, { id }) => commit(forgetIntel(threadId, id)),
  relied_on_intel: (threadId, { ids }) => commit(relyOnIntel(threadId, ids)),
  save_intel: (threadId, { journalEntry, kind, scope, text }) =>
    commit(saveIntel(threadId, text, scope, kind, journalEntry ?? null)),
  search_intel: (threadId, { ids, query, scope }) =>
    query === undefined && (ids === undefined || ids.length === 0)
      ? Effect.succeed(searchInvalid)
      : commit(searchIntelText(threadId, query ?? null, ids ?? [], scope ?? null)).pipe(
          Effect.map((text) => ({ isError: false, text })),
        ),
  update_intel: (threadId, { id, scope, text }) => commit(updateIntel(threadId, id, text ?? null, scope ?? null)),
});
