// The folder picker's search (device-pairing, CHG-0253): the folders a typed path or name leads to, ranked, and the
// folders quests already used. A paired device reaches only what lies under the browsable roots; the host's own window
// may name any folder by its path, but a search by name still looks only under the roots (the home folder first).
import { execFile } from "node:child_process";
import { readdir, realpath, stat } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, sep } from "node:path";
import type { Folder } from "@iskios/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { type FolderAccess, isWithin, listBrowsableRoots, rootOf } from "./folders.ts";

const MAX_RESULTS = 20;
const MAX_SUGGESTIONS = 12;
const MAX_DEPTH = 5;
const MAX_FOLDERS_READ = 4000;
const DEADLINE_MS = 3000;
const SKIPPED_NAMES = new Set(["node_modules", "dist", "build", "out", "target", "coverage", "__pycache__"]);

// Reading a folder on a stuck drive can wait forever, so at most two reads run at once across all searches and a
// search answers with what it found when its time is up.
const MAX_AT_ONCE = 2;
let active = 0;
const waiting: Array<() => void> = [];
const limited = async <T>(task: () => Promise<T>): Promise<T> => {
  if (active >= MAX_AT_ONCE) await new Promise<void>((resume) => waiting.push(resume));
  else active++;
  try {
    return await task();
  } finally {
    const next = waiting.shift();
    if (next === undefined) active--;
    else next();
  }
};

/** The real path of a folder, or null when it is not an existing folder or cannot be read. */
const realDirectoryOf = (path: string) =>
  limited(async () => {
    try {
      const real = await realpath(path);
      return (await stat(real)).isDirectory() ? real : null;
    } catch {
      return null;
    }
  });

const isAllowed = (roots: ReadonlyArray<string>, real: string, access: FolderAccess) =>
  access === "anywhere" || rootOf(roots, real) !== undefined;

const folderOf = (path: string): Folder => ({ name: basename(path) || path, path });

/** How well a folder's name matches what was typed: 0 exact, 1 prefix, 2 part, 3 loose (in order, with gaps); null for none. */
const tierOf = (name: string, query: string): number | null => {
  const lower = name.toLowerCase();
  const wanted = query.toLowerCase();
  if (lower === wanted) return 0;
  if (lower.startsWith(wanted)) return 1;
  if (lower.includes(wanted)) return 2;
  let at = 0;
  for (const letter of lower) if (letter === wanted[at]) at++;
  return at === wanted.length ? 3 : null;
};

const isPathQuery = (query: string) => isAbsolute(query) || query.startsWith("~") || /^[A-Za-z]:[\\/]/.test(query);

/** The untracked folders Git ignores in a repository, relative to it with a trailing slash. */
const ignoredFoldersOf = (repository: string) =>
  new Promise<ReadonlySet<string>>((resolve) => {
    execFile(
      "git",
      ["-C", repository, "ls-files", "--others", "--ignored", "--exclude-standard", "--directory", "-z"],
      { encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 5000 },
      (error, output) =>
        resolve(error === null ? new Set(output.split("\0").filter((entry) => entry.endsWith("/"))) : new Set()),
    );
  });

type Repository = { ignored: ReadonlySet<string>; root: string };
type Pending = { depth: number; path: string; repositories: ReadonlyArray<Repository> };

const isIgnored = (repositories: ReadonlyArray<Repository>, path: string) =>
  repositories.some(({ ignored, root }) => ignored.has(`${relative(root, path).split(sep).join("/")}/`));

/** The folders under the roots whose names match the query, best first. */
const searchByName = async (query: string, home: string, roots: ReadonlyArray<string>): Promise<Folder[]> => {
  const needsPath = query.includes("/");
  const found: Array<{ depth: number; path: string; tier: number }> = [];
  const visited = new Set<string>();
  const queue: Pending[] = roots.map((path) => ({ depth: 0, path, repositories: [] }));
  const state = { expired: false };

  const walk = async () => {
    for (let item = queue.shift(); item !== undefined && !state.expired; item = queue.shift()) {
      if (visited.has(item.path) || visited.size >= MAX_FOLDERS_READ) continue;
      visited.add(item.path);
      const root = rootOf(roots, item.path) ?? item.path;
      const label = needsPath ? relative(root, item.path).split(sep).join("/") : basename(item.path);
      const tier = tierOf(label, query);
      if (tier !== null) found.push({ depth: item.depth, path: item.path, tier });
      if (item.depth >= MAX_DEPTH) continue;
      const entries = await limited(() => readdir(item.path, { withFileTypes: true })).catch(() => []);
      const repositories = entries.some((entry) => entry.name === ".git")
        ? [...item.repositories, { ignored: await ignoredFoldersOf(item.path), root: item.path }]
        : item.repositories;
      for (const entry of entries) {
        if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
        if (entry.name.startsWith(".") || SKIPPED_NAMES.has(entry.name)) continue;
        let path = join(item.path, entry.name);
        if (path === join(home, "Library")) continue;
        if (isIgnored(repositories, path)) continue;
        if (entry.isSymbolicLink()) {
          // A link is followed only when it leads to a folder inside the same root, and is then named by its target.
          const target = await realDirectoryOf(path);
          if (target === null || !isWithin(root, target)) continue;
          path = target;
        }
        queue.push({ depth: item.depth + 1, path, repositories });
      }
    }
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    walk(),
    new Promise<void>((resolve) => {
      timer = setTimeout(() => {
        state.expired = true;
        resolve();
      }, DEADLINE_MS);
    }),
  ]);
  clearTimeout(timer);
  return found
    .sort((a, b) => a.tier - b.tier || a.depth - b.depth || a.path.localeCompare(b.path))
    .slice(0, MAX_RESULTS)
    .map((match) => folderOf(match.path));
};

/** A typed path: the folder it names when the caller may reach it, then the subfolders of its parent it completes. */
const completePath = async (
  typed: string,
  home: string,
  roots: ReadonlyArray<string>,
  access: FolderAccess,
): Promise<Folder[]> => {
  const expanded = typed === "~" || typed.startsWith("~/") ? join(home, typed.slice(1)) : typed;
  const isStepIn = /[\\/]$/.test(typed);
  const exact = isStepIn ? null : await realDirectoryOf(expanded);
  const parent = await realDirectoryOf(isStepIn ? expanded : dirname(expanded));
  const found: string[] = [];
  if (exact !== null && isAllowed(roots, exact, access)) found.push(exact);
  if (parent !== null && isAllowed(roots, parent, access)) {
    const term = isStepIn || typed === "~" ? "" : basename(expanded).toLowerCase();
    const entries = await limited(() => readdir(parent, { withFileTypes: true })).catch(() => []);
    const names = entries
      .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
      .map((entry) => entry.name)
      .filter((name) => name.toLowerCase().startsWith(term) && (term.startsWith(".") || !name.startsWith(".")))
      .sort((a, b) => a.localeCompare(b));
    for (const name of names) {
      const real = await realDirectoryOf(join(parent, name));
      if (real !== null && isAllowed(roots, real, access) && !found.includes(real)) found.push(real);
      if (found.length >= MAX_RESULTS) break;
    }
  }
  return found.map(folderOf);
};

/** The folders quests used, newest first, that still exist and the caller may reach. */
const usedFolders = async (
  paths: ReadonlyArray<string>,
  roots: ReadonlyArray<string>,
  access: FolderAccess,
): Promise<Folder[]> => {
  const found: string[] = [];
  for (const path of paths) {
    if (found.length >= MAX_SUGGESTIONS) break;
    const real = await realDirectoryOf(path);
    if (real !== null && isAllowed(roots, real, access) && !found.includes(real)) found.push(real);
  }
  return found.map(folderOf);
};

/**
 * Folders for what was typed: a path (starting with `/`, `~`, or a drive) leads to that folder and its completions; a
 * name is searched under the browsable roots, best match first; nothing typed lists the folders quests already used.
 */
export const searchFolders = (query: string, access: FolderAccess, home: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const roots = yield* listBrowsableRoots;
    const typed = query.trim();
    if (typed === "") {
      const rows = yield* sql<{
        path: string;
      }>`SELECT path FROM workspaces ORDER BY created_at DESC, rowid DESC LIMIT 100`;
      const paths = rows.map((row) => row.path);
      return yield* Effect.promise(() => usedFolders(paths, roots, access));
    }
    return yield* Effect.promise(() =>
      isPathQuery(typed) ? completePath(typed, home, roots, access) : searchByName(typed, home, roots),
    );
  });
