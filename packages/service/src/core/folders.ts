// Browsing the computer's folders for the folder picker (device-pairing, CHG-0253). A paired device reaches only what
// lies under the browsable roots the host set in the Workshop; the host's own window reaches any folder.
import { lstatSync, mkdirSync, readdirSync, readlinkSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
import type { Folder, FolderListing } from "@iskios/contracts";
import { Clock, Context, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid } from "./errors.ts";

/** The owner's home folder: what `~` means in a typed path, and the first browsable root. */
export class HomeFolder extends Context.Service<HomeFolder, string>()("iskios/HomeFolder") {}

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

export const isWithin = (root: string, path: string) =>
  path === root || path.startsWith(root.endsWith(sep) ? root : root + sep);

/**
 * A path with symbolic links resolved through its deepest existing folder, so a file not yet written still resolves.
 * A link to nothing is followed to the path it names, since a write through it creates that path. `depth` stops a
 * ring of links.
 */
const realPathOf = (path: string, depth = 0): string => {
  try {
    return realpathSync(path);
  } catch {
    const found = lstatSync(path, { throwIfNoEntry: false });
    if (found?.isSymbolicLink() === true) {
      if (depth >= 32) return path;
      return realPathOf(resolve(dirname(path), readlinkSync(path)), depth + 1);
    }
    const parent = dirname(path);
    return parent === path ? path : join(realPathOf(parent, depth), basename(path));
  }
};

/**
 * Whether a file path, relative to the folder or absolute, lies inside the folder once `..` and symbolic links
 * are resolved: a link inside the workspace that points outside it counts as outside (workspace-attachment).
 */
export const isInsideFolder = (folder: string, path: string) =>
  Effect.sync(() => isWithin(realPathOf(resolve(folder)), realPathOf(resolve(folder, path))));

/** How far a caller may look: a paired device only under the browsable roots, the host's own window anywhere. */
export type FolderAccess = "anywhere" | "roots";

/** The browsable roots, in the order they were added. */
export const listBrowsableRoots = Effect.gen(function* () {
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

/** The root a real folder lies under, or undefined when it is under none. */
export const rootOf = (roots: ReadonlyArray<string>, real: string) =>
  roots.find((candidate) => isWithin(candidate, real));

/** The existing folder at the path when the caller may reach it; refused otherwise. `root` is null outside every root. */
const requireBrowsable = (path: string, access: FolderAccess) =>
  Effect.gen(function* () {
    const real = yield* realFolderOf(path);
    if (real === null) return yield* invalid(`No folder at ${path}.`);
    const root = rootOf(yield* listBrowsableRoots, real) ?? null;
    if (root === null && access === "roots") {
      return yield* invalid(`${path} is outside the browsable roots in the Workshop.`);
    }
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

/** A folder's subfolders when the caller may reach it; the roots themselves for null. */
export const browseFolders = (path: string | null, shouldIncludeHidden: boolean, access: FolderAccess) =>
  path === null
    ? listRootFolders
    : Effect.gen(function* () {
        const folder = yield* requireBrowsable(path, access);
        const folders = yield* subfoldersOf(folder.path, shouldIncludeHidden);
        // A root has no parent in the picker; outside every root (the host's window only) the parent is the folder above.
        const above = dirname(folder.path);
        const parent = folder.path === folder.root || above === folder.path ? null : above;
        return { folders, parent, path: folder.path } satisfies FolderListing;
      });

/** Makes a new folder inside a folder the caller may reach (New folder). */
export const createFolder = (parent: string, name: string, access: FolderAccess) =>
  Effect.gen(function* () {
    const trimmed = name.trim();
    if (trimmed === "" || trimmed === "." || trimmed === ".." || /[/\\]/.test(trimmed)) {
      return yield* invalid("A folder name cannot be empty or contain a slash.");
    }
    const folder = yield* requireBrowsable(parent, access);
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

/** Removes a folder from the browsable roots and returns those left; refused for a path that is not one. */
export const removeBrowsableRoot = (path: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const trimmed = path.trim();
    const roots = yield* listBrowsableRoots;
    const real = (yield* realFolderOf(trimmed)) ?? trimmed;
    const root = roots.find((candidate) => candidate === trimmed || candidate === real);
    if (root === undefined) return yield* invalid(`${path} is not one of the browsable roots.`);
    yield* sql`DELETE FROM browsable_roots WHERE path = ${root}`;
    return yield* listRootFolders;
  });
