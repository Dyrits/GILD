// The folders a request names, and whether a paired device may name them (device-pairing, audit SA-08). A paired device
// reaches only the browsable roots, or a folder the owner already attached as a realm; the host's own window any folder.
import type { Request } from "@iskios/contracts";
import { Effect, Match } from "effect";
import { SqlClient } from "effect/sql";
import { type FolderAccess, invalid, listBrowsableRoots, realFolderOf, rootOf } from "../core/index.ts";

/** The folder each request names, where it names one. */
export const folderOfRequest = (request: Request): string | null =>
  Match.value(request).pipe(
    Match.tags({
      AnswerSuggestion: ({ answer }) =>
        Match.valueTags(answer, {
          Aside: () => null,
          Continue: () => null,
          NewMission: (given) => given.realmPath ?? null,
        }),
      CreateRealm: (given) => given.path,
      CreateRitual: (given) => given.workspacePath,
      FindArchivedRealm: (given) => given.path,
      ListSkills: (given) => given.workspacePath,
      ListWorkspaceEntries: (given) => given.workspacePath,
      StartMission: (given) => given.workspacePath,
    }),
    // Requests without a folder have no folder-access decision.
    Match.orElse(() => null),
  );

/** Refuses a request that names a folder outside the browsable roots and outside every realm, unless the caller is the host. */
export const requireReachableFolder = Effect.fnUntraced(function* (request: Request, access: FolderAccess) {
  if (access === "anywhere") return;
  const named = folderOfRequest(request);
  if (named === null || named.trim() === "") return;
  // A folder that does not exist is refused by the request's own checks, with their own words.
  const real = yield* realFolderOf(named.trim());
  if (real === null) return;
  if (rootOf(yield* listBrowsableRoots, real) !== undefined) return;
  const sql = yield* SqlClient.SqlClient;
  const [attached] = yield* sql<{ id: string }>`SELECT id FROM workspaces WHERE path = ${real} LIMIT 1`;
  if (attached === undefined) return yield* invalid(`${named} is outside the browsable roots in the Workshop.`);
});
