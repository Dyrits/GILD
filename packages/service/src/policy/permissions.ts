import type { StandingPermission } from "@iskios/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { notFound } from "../core/index.ts";
import { kindOfPermission, matchesPattern } from "./patterns.ts";

const selectPermissions = (sql: SqlClient.SqlClient) => sql`
  SELECT p.id, p.mission_id AS missionId, m.title AS missionTitle, p.sentence, p.pattern, p.created_at AS createdAt,
    p.workspace_id AS workspaceId, w.name AS workspaceName
  FROM standing_permissions p LEFT JOIN missions m ON m.id = p.mission_id LEFT JOIN workspaces w ON w.id = p.workspace_id`;

/** Every standing permission, newest first. */
export const listPermissions = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  return yield* sql<StandingPermission>`${selectPermissions(sql)} ORDER BY p.created_at DESC, p.rowid DESC`;
});

/**
 * The standing permissions that apply to a thread: those of its workspace, or of its mission
 * when it has none, and those widened to everywhere (workspace-attachment, Requirements).
 */
export const listThreadPermissions = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    return yield* sql<StandingPermission>`${selectPermissions(sql)}
      JOIN threads t ON t.id = ${threadId}
      WHERE (p.mission_id IS NULL AND p.workspace_id IS NULL)
        OR (t.workspace_id IS NOT NULL AND p.workspace_id = t.workspace_id)
        OR (t.workspace_id IS NULL AND p.workspace_id IS NULL AND p.mission_id = t.mission_id)
      ORDER BY p.created_at`;
  });

/**
 * The first standing permission applying to a thread whose pattern covers the target and whose kind is the
 * target's: its sensitive kind, such as "Push code", or null for an ordinary action (action-approval, Always allow).
 */
export const findCoveringPermission = (threadId: string, target: string, kind: string | null) =>
  listThreadPermissions(threadId).pipe(
    Effect.map(
      (permissions) =>
        permissions.find(
          (permission) => kindOfPermission(permission.sentence) === kind && matchesPattern(permission.pattern, target),
        ) ?? null,
    ),
  );

/** Saves a standing permission for the thread's workspace, or its mission when it has none. Callers run it in a transaction. */
export const insertPermission = (threadId: string, sentence: string, pattern: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const now = yield* Clock.currentTimeMillis;
    yield* sql`INSERT INTO standing_permissions (id, mission_id, workspace_id, sentence, pattern, created_at)
      SELECT ${crypto.randomUUID()}, CASE WHEN workspace_id IS NULL THEN mission_id END, workspace_id,
        ${sentence}, ${pattern}, ${now}
      FROM threads WHERE id = ${threadId}`;
  });

const requirePermission = (sql: SqlClient.SqlClient, permissionId: string) =>
  Effect.gen(function* () {
    const [row] = yield* sql<{ id: string }>`SELECT id FROM standing_permissions WHERE id = ${permissionId}`;
    if (row === undefined) return yield* notFound("No such permission.");
  });

/** Widens a standing permission to every mission and workspace. */
export const widenPermission = (permissionId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* requirePermission(sql, permissionId);
    yield* sql`UPDATE standing_permissions SET mission_id = NULL, workspace_id = NULL WHERE id = ${permissionId}`;
    return null;
  });

/** Removes a standing permission; covered actions ask again. */
export const removePermission = (permissionId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* requirePermission(sql, permissionId);
    yield* sql`DELETE FROM standing_permissions WHERE id = ${permissionId}`;
    return null;
  });
