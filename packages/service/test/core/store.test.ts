import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteClient, SqliteMigrator } from "@effect/sql-sqlite-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { afterEach } from "vitest";
import { migrations } from "../../src/core/store.ts";

// The store's migrations on a database that already holds data, as the owner's does.

const directories: Array<string> = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

const migrateUntil = (last: string) =>
  SqliteMigrator.run({
    loader: SqliteMigrator.fromRecord(Object.fromEntries(Object.entries(migrations).filter(([id]) => id <= last))),
  });

describe("only Realms and Borderlands (CHG-0161)", () => {
  it.live("keeps realms and their threads, lets a realm have no folder, and drops Free Realms", () => {
    const directory = mkdtempSync(join(tmpdir(), "iskios-store-"));
    directories.push(directory);
    return Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* migrateUntil("0038_mission_free_realm");
      yield* sql`INSERT INTO workspaces (id, name, path, created_at, crest) VALUES ('w1', 'App', '/app', 1, NULL)`;
      yield* sql`INSERT INTO missions (id, top_thread_id, title, created_at, last_activity_at, free_realm_id)
        VALUES ('m1', 't1', 'Quest', 1, 1, NULL)`;
      yield* sql`INSERT INTO threads (id, mission_id, state, harness, model, workspace_id, title)
        VALUES ('t1', 'm1', 'Idle', 'ClaudeCode', 'default', 'w1', 'Quest')`;
      yield* sql`INSERT INTO free_realms (id, name, crest, created_at) VALUES ('f1', 'Garden', NULL, 1)`;

      yield* migrateUntil("0039_realms_and_borderlands");

      const [thread] = yield* sql<{ path: string }>`
        SELECT w.path FROM threads t JOIN workspaces w ON w.id = t.workspace_id WHERE t.id = 't1'`;
      expect(thread?.path).toBe("/app");
      yield* sql`INSERT INTO workspaces (id, name, path, created_at) VALUES ('w2', 'Ideas', NULL, 2)`;
      yield* sql`INSERT INTO workspaces (id, name, path, created_at) VALUES ('w3', 'Notes', NULL, 3)`;
      expect(yield* sql<{ id: string }>`SELECT id FROM workspaces WHERE path IS NULL ORDER BY id`).toEqual([
        { id: "w2" },
        { id: "w3" },
      ]);
      const tables = yield* sql<{ name: string }>`SELECT name FROM sqlite_master WHERE name = 'free_realms'`;
      expect(tables).toEqual([]);
    }).pipe(Effect.provide(SqliteClient.layer({ filename: join(directory, "store.sqlite") })));
  });
});
