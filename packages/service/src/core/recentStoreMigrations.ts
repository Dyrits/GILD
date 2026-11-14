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
  "0047_thread_activities": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    // The tool calls a harness reported, by the harness's own id. A call that also reached the permission prompt is
    // marked, so the thread shows it once, as its action (action-approval, What a working thread is doing).
    yield* sql`CREATE TABLE thread_activities (
      id TEXT NOT NULL,
      thread_id TEXT NOT NULL REFERENCES threads(id),
      at INTEGER NOT NULL,
      summary TEXT NOT NULL,
      detail TEXT NOT NULL,
      is_prompted INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (thread_id, id)
    )`;
    yield* sql`CREATE INDEX thread_activities_by_thread ON thread_activities (thread_id, at)`;
  }),
  "0048_turn_harness": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    // The harness a turn was admitted on, which keeps its permission authority when the owner picks another harness
    // during it (thread-handover). Turns admitted before this change fall back to the thread's harness.
    yield* sql`ALTER TABLE turns ADD COLUMN harness TEXT`;
  }),
  "0049_suggested_messages": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    // The owner messages that carry a suggestion's text, written by an agent and only routed by the owner: never the
    // owner's own words for structural authority (mission-coordination, audit SA-06). The mark lives as long as the
    // message, whatever becomes of the suggestion or the thread that wrote it.
    yield* sql`CREATE TABLE suggested_messages (message_id TEXT PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE)`;
  }),
};
