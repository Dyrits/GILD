import { lstatSync, readlinkSync, realpathSync } from "node:fs";
import { resolve, sep } from "node:path";
import { Effect } from "effect";
import { HarnessFailure, type TurnRequest } from "../core/index.ts";

// The check every harness runs on a thread's folder before it starts there (CHG-0208). A sandbox writes the folder's
// real path, so a folder that is a link, or resolves outside its root, would let it write elsewhere than the thread's
// workspace. Each start that finds one asks the owner a one-time question (Allow or Deny, never a standing permission).
// OpenCode, sandboxed by Iskios, then runs unwrapped and asks per action (opencode.ts); Claude Code and Codex, which
// keep their own sandbox, start in the folder's real path, so what the sandbox writes is where the folder points.

/** A folder that would widen what a harness's sandbox writes, and where it really points. */
export interface FolderEscape {
  readonly folder: string;
  readonly pointsTo: string;
}

/** Where a path really points: its real path, or for a link to nothing, the path it names; null for nothing there. */
const pointedOf = (path: string) => {
  try {
    return realpathSync(path);
  } catch {
    const found = lstatSync(path, { throwIfNoEntry: false });
    return found?.isSymbolicLink() ? resolve(path, "..", readlinkSync(path)) : null;
  }
};

const isLink = (path: string) => lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink() === true;

const isWithin = (root: string, path: string) =>
  path === root || path.startsWith(root.endsWith(sep) ? root : root + sep);

/** The folder's real path, or the folder itself when nothing is there yet. */
export const resolvedFolderOf = (folder: string) => pointedOf(folder) ?? folder;

/**
 * What is wrong with starting a harness in a thread's folder, or null when nothing is (CHG-0208). The root the folder
 * must lie in (the workspace's own folder, stored by its real path, or the scratch root) must not be a link, nor
 * resolve elsewhere for a workspace; the folder must not be a link and must resolve inside the root. A scratch root
 * below a linked system folder (`/var` on macOS) is not a widening. A folder that does not exist yet is left to the
 * start, which makes or refuses it.
 */
export const folderEscapeOf = (folder: string, root: string, isWorkspace: boolean): FolderEscape | null => {
  const realRoot = pointedOf(root);
  if (realRoot === null) return null;
  if (isLink(root) || (isWorkspace && realRoot !== root)) return { folder: root, pointsTo: realRoot };
  if (folder === root) return null;
  const real = pointedOf(folder);
  if (real === null) return null;
  return isLink(folder) || !isWithin(realRoot, real) ? { folder, pointsTo: real } : null;
};

/** What is wrong with the thread's folder, in the owner's words. */
export const folderProblemOf = (found: FolderEscape, request: TurnRequest) =>
  found.folder === request.cwd
    ? request.access.isInWorkspace
      ? `This thread's workspace folder ${found.folder} points to ${found.pointsTo}, not to the folder added as the workspace`
      : `This thread's folder ${found.folder} points to ${found.pointsTo}, outside Iskios's scratch folder ${request.folderRoot}`
    : `Iskios's scratch folder ${found.folder} points to ${found.pointsTo}`;

/**
 * The folder Claude Code or Codex starts in: the thread's own when nothing is wrong with it. Otherwise the owner is
 * asked, for this start only; Allow starts the harness in the folder's real path, under its own sandbox, and leaves a
 * line in the thread saying where the folder points; Deny fails the turn with the reason.
 */
export const startFolderOf = (request: TurnRequest, label: string) =>
  Effect.gen(function* () {
    const found = yield* Effect.sync(() =>
      folderEscapeOf(request.cwd, request.folderRoot, request.access.isInWorkspace),
    );
    if (found === null) return request.cwd;
    const startsIn = yield* Effect.sync(() => resolvedFolderOf(request.cwd));
    const answer = yield* request.askOwner({
      folderCheck: { pointsTo: found.pointsTo, startsIn },
      input: {
        description:
          `${folderProblemOf(found, request)}. Started there, ${label}'s sandbox would write in ${startsIn}, outside ` +
          `the workspace. Allow starts ${label} in ${startsIn} itself, so its sandbox writes only there, for this ` +
          "start; Deny stops this turn",
        file_path: found.folder,
      },
      toolName: label,
    });
    if (!answer.isAllowed)
      return yield* new HarnessFailure({
        reason:
          `${label} did not start: the folder ${found.folder} points to ${found.pointsTo}, so its sandbox would write ` +
          "outside the workspace, and starting it there was not allowed. Fix the folder, or allow it, then retry.",
      });
    yield* request.onEvent({
      _tag: "Notice",
      text:
        `${found.folder === request.cwd ? `This thread's folder ${request.cwd} is a link` : `This thread's folder ${request.cwd} lies in ${found.folder}, a link`}: ` +
        `it really points to ${startsIn}. ${label} was started in ${startsIn}, as allowed, and its sandbox writes there.`,
    });
    return startsIn;
  });
