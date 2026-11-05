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
};

/** The service's one SQLite database, migrated before use. */
export const storeLayer = (filename: string) =>
  Layer.effectDiscard(SqliteMigrator.run({ loader: SqliteMigrator.fromRecord(migrations) })).pipe(
    Layer.provideMerge(SqliteClient.layer({ filename })),
  );
