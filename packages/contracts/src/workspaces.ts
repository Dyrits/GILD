import { Schema } from "effect";
import { Crest } from "./crest.ts";
import { FreeRealmId, WorkspaceId } from "./ids.ts";

// Workspaces and the folder browser (workspace-attachment).

/** A folder a thread works in, kept by identity rather than by path (workspace-attachment). */
export const Workspace = Schema.Struct({
  id: WorkspaceId,
  /** Whether the folder still exists at its path. */
  isMissing: Schema.Boolean,
  name: Schema.String,
  path: Schema.String,
});
export type Workspace = typeof Workspace.Type;

/** One folder shown by the folder browser. */
export const Folder = Schema.Struct({ name: Schema.String, path: Schema.String });
export type Folder = typeof Folder.Type;

/** A folder's subfolders, or the browsable roots when `path` is null. */
export const FolderListing = Schema.Struct({
  folders: Schema.Array(Folder),
  /** The folder above, or null at a browsable root and at the list of roots. */
  parent: Schema.NullOr(Schema.String),
  path: Schema.NullOr(Schema.String),
});
export type FolderListing = typeof FolderListing.Type;

/** One workspace the dashboard can filter by, with its folder, where a mission started from its board works. */
export const WorkspaceChoice = Schema.Struct({
  /** The crest the owner designed for the realm, or null until then; its quests wear it. */
  crest: Schema.NullOr(Crest),
  id: WorkspaceId,
  name: Schema.String,
  path: Schema.String,
});
export type WorkspaceChoice = typeof WorkspaceChoice.Type;

/** A Free Realm: a name and a crest, and no folder. */
export const FreeRealm = Schema.Struct({
  crest: Schema.NullOr(Crest),
  id: FreeRealmId,
  name: Schema.String,
});
export type FreeRealm = typeof FreeRealm.Type;
