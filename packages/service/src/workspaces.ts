import { mkdirSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, sep } from "node:path";
import type { Folder, FolderListing, Workspace, WorkspaceId } from "@openmission/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid } from "./errors.ts";

/** The folder's real path with symbolic links resolved, or null when it is not an existing folder. */
const realFolderOf = (path: string) =>
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

const subfoldersOf = (path: string) =>
  Effect.sync(() => {
    try {
      return (
        readdirSync(path, { withFileTypes: true })
          // Hidden folders such as `.git` are not offered as workspaces.
          .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
          .map((entry) => ({ name: entry.name, path: join(path, entry.name) }) satisfies Folder)
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch {
      return [];
    }
  });

/** A folder's subfolders when it is under a browsable root; the roots themselves for null. */
export const browseFolders = (path: string | null) =>
  path === null
    ? listRootFolders
    : Effect.gen(function* () {
        const folder = yield* requireBrowsable(path);
        const folders = yield* subfoldersOf(folder.path);
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

/**
 * The workspace for a chosen folder: the existing one for that folder, or a new one,
 * since a folder becomes a workspace the first time it is chosen. Callers run it in a transaction.
 */
export const attachWorkspace = (path: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const folder = yield* requireBrowsable(path);
    const [existing] = yield* sql<{ id: string }>`SELECT id FROM workspaces WHERE path = ${folder.path}`;
    if (existing !== undefined) return existing.id;
    const id = crypto.randomUUID();
    const now = yield* Clock.currentTimeMillis;
    yield* sql`INSERT INTO workspaces (id, name, path, created_at)
      VALUES (${id}, ${basename(folder.path) || folder.path}, ${folder.path}, ${now})`;
    return id;
  });

/** A thread's workspace with whether its folder still exists, or null for the scratch folder. */
export const readThreadWorkspace = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql<{ id: string; name: string; path: string }>`
      SELECT w.id, w.name, w.path FROM threads t JOIN workspaces w ON w.id = t.workspace_id WHERE t.id = ${threadId}`;
    if (row === undefined) return null;
    const isMissing = (yield* realFolderOf(row.path)) === null;
    return { id: row.id as WorkspaceId, isMissing, name: row.name, path: row.path } satisfies Workspace;
  });

// Instruction files a harness started without its own settings does not read (probe, 2026-11-06:
// Claude Code 2.1.302 with `--setting-sources ""` ignores the folder's CLAUDE.md).
const instructionFiles = ["AGENTS.md", "CLAUDE.md"];
/** Keeps the harness's command line well under the system's argument limit. */
const instructionLimit = 50_000;

const readInstructions = (folder: string) =>
  Effect.sync(() =>
    instructionFiles.flatMap((name) => {
      let text: string;
      try {
        text = readFileSync(join(folder, name), "utf8").trim();
      } catch {
        return [];
      }
      if (text === "") return [];
      const body =
        text.length > instructionLimit ? `${text.slice(0, instructionLimit)}\n[cut: the file is longer]` : text;
      return [`## ${name}\n${body}`];
    }),
  );

/** The starting context naming the thread's workspace, with the folder's own instructions. */
const workspaceContextOf = (workspace: Workspace) =>
  Effect.gen(function* () {
    const instructions = yield* readInstructions(workspace.path);
    return [
      "# Your workspace",
      `You work in the workspace "${workspace.name}" at ${workspace.path}. It is your working folder.`,
      ...(instructions.length === 0
        ? []
        : ["The workspace's own instructions follow; follow them for work in this folder.", ...instructions]),
    ].join("\n");
  });

/**
 * Where a thread works and the starting context saying so: its workspace's folder, or its
 * mission's scratch folder, made on first use, when it has none.
 */
export const prepareWorkingFolder = (workspace: Workspace | null, scratchFolder: string) =>
  workspace === null
    ? Effect.sync(() => {
        mkdirSync(scratchFolder, { recursive: true });
        return {
          context: [
            "# Your working folder",
            `You have no workspace. You work in your mission's scratch folder, ${scratchFolder}, shared with the mission's other threads that have none.`,
          ].join("\n"),
          cwd: scratchFolder,
        };
      })
    : workspaceContextOf(workspace).pipe(Effect.map((context) => ({ context, cwd: workspace.path })));
