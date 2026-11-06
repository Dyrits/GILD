// Browsing the computer's folders under the browsable roots, kept for phone browsing
// (workspace-attachment). The desktop chooses folders in the system's dialog instead (CHG-0035).
import { mkdirSync, readdirSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, sep } from "node:path";
import type { Folder, FolderListing } from "@openmission/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid } from "./errors.ts";

/** The folder's real path with symbolic links resolved, or null when it is not an existing folder. */
export const realFolderOf = (path: string) =>
  Effect.sync(() => {
    if (!isAbsolute(path)) return null;
    try {
      const real = realpathSync(path);
      return statSync(real).isDirectory() ? real : null;
    } catch {
      return null;
    }
  });

const isWithin = (root: string, path: string) =>
  path === root || path.startsWith(root.endsWith(sep) ? root : root + sep);

/** The browsable roots, in the order they were added. */
const listBrowsableRoots = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{ path: string }>`SELECT path FROM browsable_roots ORDER BY added_at, rowid`;
  return rows.map((row) => row.path);
});

/** Starts the browsable roots with the owner's home folder the first time (workspace-attachment). */
export const seedBrowsableRoots = (homeFolder: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const home = (yield* realFolderOf(homeFolder)) ?? homeFolder;
    const now = yield* Clock.currentTimeMillis;
    yield* sql`INSERT INTO browsable_roots (path, added_at)
      SELECT ${home}, ${now} WHERE NOT EXISTS (SELECT 1 FROM browsable_roots)`;
  });

/** The browsable roots as a folder listing. */
const listRootFolders = Effect.gen(function* () {
  const roots = yield* listBrowsableRoots;
  return { folders: roots.map((path) => ({ name: path, path })), parent: null, path: null } satisfies FolderListing;
});

/** The existing folder at the path when it lies under a browsable root; refused otherwise. */
const requireBrowsable = (path: string) =>
  Effect.gen(function* () {
    const real = yield* realFolderOf(path);
    if (real === null) return yield* invalid(`No folder at ${path}.`);
    const roots = yield* listBrowsableRoots;
    const root = roots.find((candidate) => isWithin(candidate, real));
    if (root === undefined) return yield* invalid(`${path} is outside the browsable roots in Settings.`);
    return { path: real, root };
  });

const subfoldersOf = (path: string, shouldIncludeHidden: boolean) =>
  Effect.sync(() => {
    try {
      return (
        readdirSync(path, { withFileTypes: true })
          // Hidden folders such as `.git` are offered only on Show hidden (CHG-0034).
          .filter((entry) => entry.isDirectory() && (shouldIncludeHidden || !entry.name.startsWith(".")))
          .map((entry) => ({ name: entry.name, path: join(path, entry.name) }) satisfies Folder)
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch {
      return [];
    }
  });

/** A folder's subfolders when it is under a browsable root; the roots themselves for null. */
export const browseFolders = (path: string | null, shouldIncludeHidden: boolean) =>
  path === null
    ? listRootFolders
    : Effect.gen(function* () {
        const folder = yield* requireBrowsable(path);
        const folders = yield* subfoldersOf(folder.path, shouldIncludeHidden);
        const parent = folder.path === folder.root ? null : dirname(folder.path);
        return { folders, parent, path: folder.path } satisfies FolderListing;
      });

/** Makes a new folder inside a browsable folder (New folder). */
export const createFolder = (parent: string, name: string) =>
  Effect.gen(function* () {
    const trimmed = name.trim();
    if (trimmed === "" || trimmed === "." || trimmed === ".." || /[/\\]/.test(trimmed)) {
      return yield* invalid("A folder name cannot be empty or contain a slash.");
    }
    const folder = yield* requireBrowsable(parent);
    const path = join(folder.path, trimmed);
    const isCreated = yield* Effect.sync(() => {
      try {
        mkdirSync(path);
        return true;
      } catch {
        return false;
      }
    });
    if (!isCreated) return yield* invalid(`Could not create ${path}; it may already exist.`);
    return { name: trimmed, path } satisfies Folder;
  });

/** Adds an existing folder to the browsable roots and returns them all. */
export const addBrowsableRoot = (path: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const real = yield* realFolderOf(path.trim());
    if (real === null) return yield* invalid(`No folder at ${path}; give a full path to an existing folder.`);
    const now = yield* Clock.currentTimeMillis;
    yield* sql`INSERT INTO browsable_roots (path, added_at) VALUES (${real}, ${now}) ON CONFLICT (path) DO NOTHING`;
    return yield* listRootFolders;
  });
