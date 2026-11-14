import { Effect } from "effect";
import { SqlClient } from "effect/sql";

/** Additive recent migrations, kept apart from the historical schema to keep it readable. */
export const recentStoreMigrations = {
  "0045_own_account_labels": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE own_account_labels (harness TEXT PRIMARY KEY, label TEXT NOT NULL)`;
  }),
  "0046_realm_archives": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE workspaces ADD COLUMN archived_at INTEGER`;
    // Only quests archived with the realm are restored with it; earlier individual archives stay archived.
    yield* sql`CREATE TABLE realm_archived_quests (
      workspace_id TEXT NOT NULL REFERENCES workspaces(id),
      mission_id TEXT PRIMARY KEY REFERENCES missions(id) ON DELETE CASCADE,
      previous_ending TEXT
    )`;
  }),
};
