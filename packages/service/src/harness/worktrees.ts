import { execFileSync } from "node:child_process";
import { lstatSync, realpathSync } from "node:fs";
import { sep } from "node:path";
import type { TurnRequest } from "../core/index.ts";
import { folderEscapeOf } from "./threadFolder.ts";

// The git worktrees of a workspace's own repository, which count as the workspace (CHG-0273): a thread works on a
// branch in a worktree beside the checkout, and a sandbox that wrote only the checkout would make every command and
// edit there ask. Only what git itself lists for this repository counts, never a sibling folder by its name.

const realPathOrNull = (path: string) => {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
};

/** Whether a listed worktree is a folder that is no link and does not hold the workspace itself. */
const isUsableWorktree = (path: string, workspace: string) => {
  const real = realPathOrNull(path);
  // A worktree reached through a link, or one whose folder is gone, is not counted: it would let the sandbox write
  // where the link points, or nothing at all.
  if (real === null || real !== path || lstatSync(path).isSymbolicLink() || !lstatSync(path).isDirectory())
    return false;
  return workspace !== path && !workspace.startsWith(path.endsWith(sep) ? path : path + sep);
};

/**
 * The real paths of the linked git worktrees of the repository whose top folder is the workspace's own folder, as
 * `git worktree list` gives them: none for a folder that is not a repository's top (a subfolder, or a linked worktree
 * such as a thread's own copy, which stays apart from its siblings), and none for a worktree whose folder is missing,
 * prunable, or a link.
 */
export const workspaceWorktreesOf = (folder: string): ReadonlyArray<string> => {
  const workspace = realPathOrNull(folder);
  if (workspace === null) return [];
  let output: string;
  try {
    output = execFileSync("git", ["-C", workspace, "worktree", "list", "--porcelain"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
    });
  } catch {
    return [];
  }
  const [main, ...linked] = output
    .split("\n\n")
    .map((block) => block.split("\n"))
    .filter((lines) => lines.some((line) => line.startsWith("worktree ")));
  const pathOf = (lines: ReadonlyArray<string>) =>
    lines.find((line) => line.startsWith("worktree "))?.slice("worktree ".length) ?? "";
  if (main === undefined || realPathOrNull(pathOf(main)) !== workspace) return [];
  return linked
    .filter((lines) => !lines.some((line) => line === "bare" || line.startsWith("prunable")))
    .map(pathOf)
    .filter((path) => isUsableWorktree(path, workspace));
};

/**
 * The worktrees a harness's sandbox writes besides the thread's folder: those of its workspace's repository, and none
 * for a thread outside a workspace or whose folder is a link or resolves outside its workspace (that start is the
 * owner's one-time question, and the sandbox then writes only where the folder points).
 */
export const threadWorktreesOf = (request: TurnRequest): ReadonlyArray<string> =>
  request.access.isInWorkspace && folderEscapeOf(request.cwd, request.folderRoot, true) === null
    ? workspaceWorktreesOf(request.cwd)
    : [];
