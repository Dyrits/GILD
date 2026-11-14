import { mkdirSync, mkdtempSync, realpathSync, renameSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { workspaceWorktreesOf } from "../../src/harness/index.ts";
import { createRepository, runGit } from "../fixtures/repositories.ts";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

/** A real folder holding one repository with one commit, and the real path of the folder around it. */
const makeRepositoryFixture = (name = "workspace") => {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "iskios-worktrees-")));
  directories.push(base);
  const folder = createRepository(base, name);
  return { base, folder };
};

describe("using a workspace's git worktrees", () => {
  it("lists the linked worktrees git knows for the workspace folder, by their real paths", () => {
    const { base, folder } = makeRepositoryFixture();
    runGit(folder, "worktree", "add", "-q", "-b", "side", join(base, "workspace-side"));
    runGit(folder, "worktree", "add", "-q", "-b", "inner", join(folder, ".worktrees", "inner"));
    expect([...workspaceWorktreesOf(folder)].sort()).toEqual(
      [join(base, "workspace-side"), join(folder, ".worktrees", "inner")].sort(),
    );
  });

  it("lists none for a folder that is not a git repository", () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), "iskios-worktrees-")));
    directories.push(base);
    expect(workspaceWorktreesOf(base)).toEqual([]);
  });

  it("leaves out a worktree whose folder is gone", () => {
    const { base, folder } = makeRepositoryFixture();
    runGit(folder, "worktree", "add", "-q", "-b", "gone", join(base, "workspace-gone"));
    rmSync(join(base, "workspace-gone"), { recursive: true });
    expect(workspaceWorktreesOf(folder)).toEqual([]);
  });

  it("leaves out a worktree whose folder was replaced by a link elsewhere", () => {
    const { base, folder } = makeRepositoryFixture();
    runGit(folder, "worktree", "add", "-q", "-b", "moved", join(base, "workspace-moved"));
    renameSync(join(base, "workspace-moved"), join(base, "elsewhere"));
    symlinkSync(join(base, "elsewhere"), join(base, "workspace-moved"));
    expect(workspaceWorktreesOf(folder)).toEqual([]);
  });

  it("lists none when the thread's folder is itself a linked worktree, so an own copy stays apart", () => {
    const { base, folder } = makeRepositoryFixture();
    const linked = join(base, "workspace-own-copy");
    runGit(folder, "worktree", "add", "-q", "-b", "own-copy", linked);
    runGit(folder, "worktree", "add", "-q", "-b", "other", join(base, "workspace-other"));
    expect(workspaceWorktreesOf(linked)).toEqual([]);
  });

  it("lists none when the folder only lies inside a repository, not at its top", () => {
    const { base, folder } = makeRepositoryFixture();
    runGit(folder, "worktree", "add", "-q", "-b", "side", join(base, "workspace-side"));
    mkdirSync(join(folder, "sub"));
    expect(workspaceWorktreesOf(join(folder, "sub"))).toEqual([]);
  });

  it("does not list the worktrees of another repository", () => {
    const mine = makeRepositoryFixture("mine");
    const other = makeRepositoryFixture("other");
    runGit(other.folder, "worktree", "add", "-q", "-b", "side", join(other.base, "other-side"));
    expect(workspaceWorktreesOf(mine.folder)).toEqual([]);
  });
});
