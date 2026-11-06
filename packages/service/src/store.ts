import { SqliteClient, SqliteMigrator } from "@effect/sql-sqlite-node";
import { Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";

const migrations = {
  "0001_first_slice": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE missions (
      id TEXT PRIMARY KEY,
      top_thread_id TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_activity_at INTEGER NOT NULL
    )`;
    yield* sql`CREATE TABLE threads (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id),
      parent_id TEXT REFERENCES threads(id),
      state TEXT NOT NULL,
      generation INTEGER NOT NULL DEFAULT 0
    )`;
    yield* sql`CREATE TABLE turns (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL REFERENCES threads(id),
      status TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER
    )`;
    yield* sql`CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id),
      thread_id TEXT NOT NULL REFERENCES threads(id),
      sender_kind TEXT NOT NULL,
      text TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      sent_at INTEGER NOT NULL,
      delivered_turn_id TEXT REFERENCES turns(id),
      UNIQUE (thread_id, sequence)
    )`;
    yield* sql`CREATE TABLE command_outcomes (
      request_id TEXT PRIMARY KEY,
      request_tag TEXT NOT NULL,
      outcome TEXT NOT NULL
    )`;
  }),
  "0002_claude_code_chat": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE threads ADD COLUMN model TEXT NOT NULL DEFAULT 'default'`;
    yield* sql`ALTER TABLE threads ADD COLUMN effort TEXT NOT NULL DEFAULT 'default'`;
    yield* sql`ALTER TABLE threads ADD COLUMN session_id TEXT`;
    yield* sql`ALTER TABLE threads ADD COLUMN failure TEXT`;
    yield* sql`CREATE TABLE usage (
      turn_id TEXT PRIMARY KEY REFERENCES turns(id),
      mission_id TEXT NOT NULL REFERENCES missions(id),
      input INTEGER NOT NULL,
      output INTEGER NOT NULL,
      cache_read INTEGER NOT NULL,
      cache_creation INTEGER NOT NULL
    )`;
    yield* sql`CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`;
  }),
  // Boolean names carry a prefix (documentation/conventions.md); keeps the saved choice.
  "0003_boolean_setting_names": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`UPDATE settings SET value = json_set(json_remove(value, '$.streamReplies'), '$.shouldStreamReplies',
        json(CASE WHEN json_extract(value, '$.streamReplies') THEN 'true' ELSE 'false' END))
      WHERE key = 'settings' AND json_type(value, '$.streamReplies') IS NOT NULL`;
  }),
  // Batch 3 (CHG-0031): approval questions, standing permissions, and the approval level.
  "0004_action_approval": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE questions (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id),
      thread_id TEXT NOT NULL REFERENCES threads(id),
      source TEXT NOT NULL,
      summary TEXT NOT NULL,
      details TEXT NOT NULL,
      pattern TEXT,
      permission TEXT,
      asked_at INTEGER NOT NULL,
      outcome TEXT,
      message TEXT,
      device TEXT,
      resolved_at INTEGER
    )`;
    yield* sql`CREATE INDEX questions_by_thread ON questions (thread_id, asked_at)`;
    yield* sql`CREATE TABLE standing_permissions (
      id TEXT PRIMARY KEY,
      mission_id TEXT REFERENCES missions(id),
      sentence TEXT NOT NULL,
      pattern TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`;
    yield* sql`UPDATE settings SET value = json_set(value, '$.approvalLevel', 'RiskyOnly')
      WHERE key = 'settings' AND json_type(value, '$.approvalLevel') IS NULL`;
  }),
  // Workspace batch: folders threads work in, the roots they are chosen from, and workspace-scoped permissions.
  "0005_workspaces": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE browsable_roots (path TEXT PRIMARY KEY, added_at INTEGER NOT NULL)`;
    yield* sql`CREATE TABLE workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    )`;
    yield* sql`ALTER TABLE threads ADD COLUMN workspace_id TEXT REFERENCES workspaces(id)`;
    yield* sql`ALTER TABLE standing_permissions ADD COLUMN workspace_id TEXT REFERENCES workspaces(id)`;
  }),
  // Retry on a missing workspace folder (CHG-0034): what holds a thread in Attention besides a question.
  "0006_thread_blocker": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE threads ADD COLUMN blocker TEXT`;
  }),
};

/** The service's one SQLite database, migrated before use. */
export const storeLayer = (filename: string) =>
  Layer.effectDiscard(SqliteMigrator.run({ loader: SqliteMigrator.fromRecord(migrations) })).pipe(
    Layer.provideMerge(SqliteClient.layer({ filename })),
  );
