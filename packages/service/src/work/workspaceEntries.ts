import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { WorkspaceEntry } from "@iskios/contracts";
import { Effect } from "effect";
import { invalid, realFolderOf } from "../core/index.ts";

// The files and folders of a workspace that a typed `@` can name. A folder chosen for a first quest is not a workspace until that quest starts, so any existing folder is read, as attaching one accepts any folder the owner chose (CHG-0035).

const MAX_FILES = 20_000;
const MAX_RESULTS = 8;
const SKIPPED_FOLDERS = new Set([".git", "node_modules"]);

/** The tracked and untracked, not ignored, files of a git folder, relative to it; null when it is not a git folder. */
const gitFilesOf = (folder: string): ReadonlyArray<string> | null => {
  try {
    const output = execFileSync("git", ["-C", folder, "ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
    });
    return output.split("\0").filter((path) => path !== "");
  } catch {
    return null;
  }
};

/** The files below a folder without git: links are not followed and `.git` and `node_modules` are skipped. */
const walkedFilesOf = (folder: string): ReadonlyArray<string> => {
  const files: string[] = [];
  const pending = [""];
  for (let next = pending.pop(); next !== undefined && files.length < MAX_FILES; next = pending.pop()) {
    let children: ReadonlyArray<{ name: string; isDirectory(): boolean; isFile(): boolean }>;
    try {
      children = readdirSync(join(folder, next), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const child of children) {
      const path = next === "" ? child.name : `${next}/${child.name}`;
      if (child.isDirectory()) {
        if (!SKIPPED_FOLDERS.has(child.name)) pending.push(path);
      } else if (child.isFile()) {
        files.push(path);
      }
    }
  }
  return files;
};

/** Every file with the folders above each, a folder's path ending with a slash. */
const entriesOf = (files: ReadonlyArray<string>): ReadonlyArray<WorkspaceEntry> => {
  const folders = new Set<string>();
  for (const file of files) {
    const parts = file.split("/");
    for (let depth = 1; depth < parts.length; depth++) folders.add(`${parts.slice(0, depth).join("/")}/`);
  }
  return [
    ...[...folders].map((path) => ({ kind: "folder" as const, path })),
    ...files.map((path) => ({ kind: "file" as const, path })),
  ];
};

const depthOf = (entry: WorkspaceEntry) => entry.path.replace(/\/$/, "").split("/").length;
const nameOf = (entry: WorkspaceEntry) => entry.path.replace(/\/$/, "").split("/").at(-1) ?? "";

/** How well an entry matches the query, lower first: a name starting with it, a path starting with it, then either containing it. */
const rankOf = (entry: WorkspaceEntry, query: string) => {
  const name = nameOf(entry).toLowerCase();
  const path = entry.path.toLowerCase();
  if (name.startsWith(query)) return 0;
  if (path.startsWith(query)) return 1;
  if (name.includes(query)) return 2;
  return path.includes(query) ? 3 : null;
};

/**
 * The entries of the workspace folder that match what follows an `@`, best first; an empty query lists the top level.
 * Refused for a path that is not an existing folder.
 */
export const listWorkspaceEntries = (workspacePath: string, query: string) =>
  Effect.gen(function* () {
    const folder = yield* realFolderOf(workspacePath);
    if (folder === null) return yield* invalid(`No folder at ${workspacePath}.`);
    const entries = entriesOf(gitFilesOf(folder) ?? walkedFilesOf(folder));
    const needle = query.trim().toLowerCase();
    if (needle === "") {
      return entries
        .filter((entry) => depthOf(entry) === 1)
        .sort(
          (first, second) =>
            Number(second.kind === "folder") - Number(first.kind === "folder") || first.path.localeCompare(second.path),
        )
        .slice(0, MAX_RESULTS);
    }
    return entries
      .flatMap((entry) => {
        const rank = rankOf(entry, needle);
        return rank === null ? [] : [{ entry, rank }];
      })
      .sort(
        (first, second) =>
          first.rank - second.rank ||
          first.entry.path.length - second.entry.path.length ||
          first.entry.path.localeCompare(second.entry.path),
      )
      .slice(0, MAX_RESULTS)
      .map(({ entry }) => entry);
  });
