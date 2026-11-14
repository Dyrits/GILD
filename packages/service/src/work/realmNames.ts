import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid } from "../core/index.ts";

/** Names are labels: an active collision needs acknowledgement, never a uniqueness constraint. */
export const validateRealmName = Effect.fn("validateRealmName")(function* (
  name: string,
  exceptId: string | null,
  shouldAllowDuplicateName: boolean,
) {
  const trimmed = name.trim();
  if (trimmed === "" || trimmed.length > 80) return yield* invalid("A realm needs a name of 1 to 80 characters.");
  const sql = yield* SqlClient.SqlClient;
  if (!shouldAllowDuplicateName) {
    const duplicates = yield* sql`SELECT id FROM workspaces WHERE archived_at IS NULL
      AND lower(name) = lower(${trimmed}) AND id IS NOT ${exceptId}`;
    if (duplicates.length > 0)
      return yield* invalid(`Another active realm is named "${trimmed}". Confirm to use this name.`);
  }
  return trimmed;
});
