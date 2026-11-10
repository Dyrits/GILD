import { realpath, rm } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { ServiceFailure } from "./errors.ts";

const isWithin = (parent: string, child: string) => {
  const path = relative(parent, child);
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path));
};

/** Removes only a service-owned scratch folder; a folder also registered as a workspace takes precedence. */
export const removeScratch = Effect.fn("removeScratch")(function* (path: string) {
  const sql = yield* SqlClient.SqlClient;
  const workspaces = yield* sql<{ path: string }>`SELECT path FROM workspaces`;
  yield* Effect.tryPromise({
    catch: (error) =>
      new ServiceFailure({
        kind: "ExecutionFailure",
        message: `Could not remove the mission's scratch folder: ${String(error)}`,
      }),
    try: async () => {
      // Resolve aliases too: selecting a symlink as a workspace must protect its target.
      const scratch = await realpath(path).catch(() => resolve(path));
      for (const workspace of workspaces) {
        const folder = await realpath(workspace.path).catch(() => resolve(workspace.path));
        if (isWithin(folder, scratch) || isWithin(scratch, folder)) return;
      }
      await rm(path, { force: true, recursive: true });
    },
  });
});
