import type { StandingPermission } from "@openmission/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { notFound } from "./errors.ts";
import { matchesPattern } from "./patterns.ts";

const selectPermissions = (sql: SqlClient.SqlClient) => sql`
  SELECT p.id, p.mission_id AS missionId, m.title AS missionTitle, p.sentence, p.pattern, p.created_at AS createdAt
  FROM standing_permissions p LEFT JOIN missions m ON m.id = p.mission_id`;

/** Every standing permission, newest first. */
export const listPermissions = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  return yield* sql<StandingPermission>`${selectPermissions(sql)} ORDER BY p.created_at DESC, p.rowid DESC`;
});

/** The standing permissions that apply in a mission: its own and those widened to everywhere. */
export const listMissionPermissions = (missionId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    return yield* sql<StandingPermission>`${selectPermissions(sql)}
      WHERE p.mission_id = ${missionId} OR p.mission_id IS NULL ORDER BY p.created_at`;
  });

/** The first standing permission in a mission whose pattern covers the target, or null. */
export const findCoveringPermission = (missionId: string, target: string) =>
  listMissionPermissions(missionId).pipe(
    Effect.map((permissions) => permissions.find((permission) => matchesPattern(permission.pattern, target)) ?? null),
  );

/** Saves a standing permission for one mission. Callers run it in a transaction. */
export const insertPermission = (missionId: string, sentence: string, pattern: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const now = yield* Clock.currentTimeMillis;
    yield* sql`INSERT INTO standing_permissions (id, mission_id, sentence, pattern, created_at)
      VALUES (${crypto.randomUUID()}, ${missionId}, ${sentence}, ${pattern}, ${now})`;
  });

const requirePermission = (sql: SqlClient.SqlClient, permissionId: string) =>
  Effect.gen(function* () {
    const [row] = yield* sql<{ id: string }>`SELECT id FROM standing_permissions WHERE id = ${permissionId}`;
    if (row === undefined) return yield* notFound("No such permission.");
  });

/** Widens a standing permission to every mission. */
export const widenPermission = (permissionId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* requirePermission(sql, permissionId);
    yield* sql`UPDATE standing_permissions SET mission_id = NULL WHERE id = ${permissionId}`;
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
