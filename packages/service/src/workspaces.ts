import { mkdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { Workspace, WorkspaceId } from "@canopy/contracts";
import { Clock, Context, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid } from "./errors.ts";
import { realFolderOf } from "./folders.ts";

/** Where each mission's threads with no workspace run, one scratch folder per mission. */
export class ScratchRoot extends Context.Service<ScratchRoot, string>()("canopy/ScratchRoot") {}

/** The existing folder at the path, with links resolved; refused otherwise. */
const requireFolder = (path: string) =>
  Effect.gen(function* () {
    const real = yield* realFolderOf(path);
    if (real === null) return yield* invalid(`No folder at ${path}.`);
    return real;
  });

/**
 * The workspace for a chosen folder: the existing one for that folder, or a new one,
 * since a folder becomes a workspace the first time it is chosen. Callers run it in a transaction.
 */
export const attachWorkspace = (path: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    // Any folder the owner chose in the system's folder dialog (CHG-0035).
    const folder = yield* requireFolder(path);
    const [existing] = yield* sql<{ id: string }>`SELECT id FROM workspaces WHERE path = ${folder}`;
    if (existing !== undefined) return existing.id;
    const id = crypto.randomUUID();
    const now = yield* Clock.currentTimeMillis;
    yield* sql`INSERT INTO workspaces (id, name, path, created_at)
      VALUES (${id}, ${basename(folder) || folder}, ${folder}, ${now})`;
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
 * Where a thread works and the starting context saying so: its workspace's folder, or its mission's scratch
 * folder when it has none. Only describes the folder; `prepareWorkingFolder` makes it.
 */
export const workingFolderOf = (workspace: Workspace | null, scratchFolder: string) =>
  workspace === null
    ? Effect.succeed({
        context: [
          "# Your working folder",
          `You have no workspace. You work in your mission's scratch folder, ${scratchFolder}, shared with the mission's other threads that have none.`,
        ].join("\n"),
        cwd: scratchFolder,
      })
    : workspaceContextOf(workspace).pipe(Effect.map((context) => ({ context, cwd: workspace.path })));

/** Where a thread works and the starting context saying so, with the scratch folder made on first use. */
export const prepareWorkingFolder = (workspace: Workspace | null, scratchFolder: string) =>
  (workspace === null ? Effect.sync(() => void mkdirSync(scratchFolder, { recursive: true })) : Effect.void).pipe(
    Effect.andThen(workingFolderOf(workspace, scratchFolder)),
  );
