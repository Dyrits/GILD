import { Effect } from "effect";
import type { SqlClient } from "effect/sql";
import { forgetIntel, saveIntel, updateIntel } from "./intelChanges.ts";
import { searchIntelText } from "./intelViews.ts";
import type { ToolHandlers } from "./threadTools.ts";

/** Answers the intel thread tools (scoped-intel, External contract); `commit` runs a change in one transaction and announces it. */
export const intelToolsOf = (
  commit: <A, E>(work: Effect.Effect<A, E, SqlClient.SqlClient>) => Effect.Effect<A>,
): Pick<ToolHandlers, "forget_intel" | "save_intel" | "search_intel" | "update_intel"> => ({
  forget_intel: (threadId, { id }) => commit(forgetIntel(threadId, id)),
  save_intel: (threadId, { scope, text }) => commit(saveIntel(threadId, text, scope)),
  search_intel: (threadId, { query, scope }) =>
    commit(searchIntelText(threadId, query, scope ?? null)).pipe(Effect.map((text) => ({ isError: false, text }))),
  update_intel: (threadId, { id, scope, text }) => commit(updateIntel(threadId, id, text ?? null, scope ?? null)),
});
