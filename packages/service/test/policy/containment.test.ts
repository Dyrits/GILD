import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { afterEach } from "vitest";
import type { Containment } from "../../src/core/index.ts";
import { type ActionFacts, capabilities, isUnaskedAt, needsOf } from "../../src/policy/index.ts";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});
const folder = () => {
  const directory = mkdtempSync(join(tmpdir(), "iskios-containment-"));
  directories.push(directory);
  return directory;
};

const command = { command: "ls" };
const factsOf = (containment: Containment, fields: Partial<ActionFacts> = {}): ActionFacts => ({
  containment,
  editFolders: [],
  input: command,
  isEscape: false,
  isUnsandboxed: false,
  toolName: "Bash",
  ...fields,
});

describe("what a harness action needs beyond its sandbox", () => {
  it.effect("needs nothing for a command inside an enforced sandbox", () =>
    Effect.gen(function* () {
      expect(yield* needsOf(factsOf("Sandboxed"))).toBeNull();
    }),
  );

  it.effect("needs leaving the sandbox for a command that leaves it", () =>
    Effect.gen(function* () {
      expect(yield* needsOf(factsOf("Sandboxed", { isEscape: true }))).toBe(capabilities.outsideSandbox);
    }),
  );

  it.effect("needs widening the sandbox for a request to widen it", () =>
    Effect.gen(function* () {
      expect(yield* needsOf(factsOf("Sandboxed", { toolName: "Permissions" }))).toBe(capabilities.widenSandbox);
    }),
  );

  it.effect("needs the owner for every command where no sandbox protects, escape or not", () =>
    Effect.gen(function* () {
      expect(yield* needsOf(factsOf("Unprotected"))).toBe(capabilities.unsandboxed);
      expect(yield* needsOf(factsOf("Unprotected", { isEscape: true }))).toBe(capabilities.unsandboxed);
    }),
  );

  it.effect("needs the owner for a command of a thread run without its usual sandbox", () =>
    Effect.gen(function* () {
      expect(yield* needsOf(factsOf("Sandboxed", { isUnsandboxed: true }))).toBe(capabilities.unsandboxed);
    }),
  );

  it.effect("needs nothing for a file change inside the thread's folder, sandboxed or not", () =>
    Effect.gen(function* () {
      const editFolder = folder();
      const edit = { editFolders: [editFolder], input: { file_path: join(editFolder, "a.md") }, toolName: "Edit" };
      expect(yield* needsOf(factsOf("Sandboxed", edit))).toBeNull();
      expect(yield* needsOf(factsOf("Unprotected", edit))).toBeNull();
    }),
  );

  it.effect("needs the owner for a file change outside the folder, with no folder, or naming no file", () =>
    Effect.gen(function* () {
      const editFolder = folder();
      const outside = { editFolders: [editFolder], input: { file_path: join(folder(), "a.md") }, toolName: "Edit" };
      const inside = { editFolders: [editFolder], input: { file_path: join(editFolder, "a.md") }, toolName: "Edit" };
      expect(yield* needsOf(factsOf("Sandboxed", outside))).toBe(capabilities.fileOutsideWorkspace);
      expect(yield* needsOf(factsOf("Sandboxed", { ...inside, editFolders: [] }))).toBe(
        capabilities.fileOutsideWorkspace,
      );
      expect(yield* needsOf(factsOf("Sandboxed", { ...inside, input: {} }))).toBe(capabilities.fileOutsideWorkspace);
    }),
  );

  it.effect(
    "needs nothing for a file change inside any of the folders that count as the thread's, such as its worktrees",
    () =>
      Effect.gen(function* () {
        const [own, worktree, unrelated] = [folder(), folder(), folder()];
        const editIn = (path: string) => ({
          editFolders: [own, worktree],
          input: { file_path: join(path, "a.md") },
          toolName: "Edit",
        });
        expect(yield* needsOf(factsOf("Sandboxed", editIn(worktree)))).toBeNull();
        expect(yield* needsOf(factsOf("Sandboxed", editIn(unrelated)))).toBe(capabilities.fileOutsideWorkspace);
      }),
  );

  it.effect("needs the owner for a file change inside the folder when the thread runs unsandboxed or escapes", () =>
    Effect.gen(function* () {
      const editFolder = folder();
      const edit = { editFolders: [editFolder], input: { file_path: join(editFolder, "a.md") }, toolName: "Edit" };
      expect(yield* needsOf(factsOf("Sandboxed", { ...edit, isUnsandboxed: true }))).toBe(
        capabilities.fileOutsideWorkspace,
      );
      expect(yield* needsOf(factsOf("Sandboxed", { ...edit, isEscape: true }))).toBe(capabilities.fileOutsideWorkspace);
    }),
  );
});

describe("what runs without asking", () => {
  it("lets only an action that needs nothing run, and only at the default level", () => {
    expect(isUnaskedAt("RiskyOnly", null)).toBe(true);
    expect(isUnaskedAt("RiskyOnly", capabilities.outsideSandbox)).toBe(false);
    expect(isUnaskedAt("CommandsAndEdits", null)).toBe(false);
  });
});
