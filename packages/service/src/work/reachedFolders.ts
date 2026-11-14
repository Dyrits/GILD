// The folders a request names, and whether a paired device may name them (device-pairing, audit SA-08). A paired device
// reaches only the browsable roots, or a folder the owner already attached as a realm; the host's own window any folder.
import type { Request } from "@iskios/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { type FolderAccess, invalid, listBrowsableRoots, realFolderOf, rootOf } from "../core/index.ts";

/** The folder each request names, where it names one. */
const folderOfRequest = {
  AnswerSuggestion: (request: Extract<Request, { _tag: "AnswerSuggestion" }>) =>
    request.answer._tag === "NewMission" ? (request.answer.realmPath ?? null) : null,
  CreateRealm: (request: Extract<Request, { _tag: "CreateRealm" }>) => request.path,
  CreateRitual: (request: Extract<Request, { _tag: "CreateRitual" }>) => request.workspacePath,
  FindArchivedRealm: (request: Extract<Request, { _tag: "FindArchivedRealm" }>) => request.path,
  ListSkills: (request: Extract<Request, { _tag: "ListSkills" }>) => request.workspacePath,
  ListWorkspaceEntries: (request: Extract<Request, { _tag: "ListWorkspaceEntries" }>) => request.workspacePath,
  StartMission: (request: Extract<Request, { _tag: "StartMission" }>) => request.workspacePath,
} satisfies Partial<{ [Tag in Request["_tag"]]: (request: Extract<Request, { _tag: Tag }>) => string | null }>;

/** Refuses a request that names a folder outside the browsable roots and outside every realm, unless the caller is the host. */
export const requireReachableFolder = (request: Request, access: FolderAccess) =>
  Effect.gen(function* () {
    if (access === "anywhere" || !Object.hasOwn(folderOfRequest, request._tag)) return;
    const named =
      (folderOfRequest as Record<string, (given: Request) => string | null>)[request._tag]?.(request) ?? null;
    if (named === null || named.trim() === "") return;
    // A folder that does not exist is refused by the request's own checks, with their own words.
    const real = yield* realFolderOf(named.trim());
    if (real === null) return;
    if (rootOf(yield* listBrowsableRoots, real) !== undefined) return;
    const sql = yield* SqlClient.SqlClient;
    const [attached] = yield* sql<{ id: string }>`SELECT id FROM workspaces WHERE path = ${real} LIMIT 1`;
    if (attached === undefined) return yield* invalid(`${named} is outside the browsable roots in the Workshop.`);
  });
