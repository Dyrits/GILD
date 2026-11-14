import { describe, expect, it } from "vitest";
import { changedFilesOf, targetOf } from "../../src/policy/index.ts";
import { matchesPattern } from "../../src/policy/patterns.ts";

// action-approval, Standing permissions: a permission covers only the exact action and target it was saved for, so a
// multi-file edit's target names every file it changes (CHG-0274, audit SA-09).

const singleEdit = { file_path: "/outside/a.txt" };
const pairEdit = { file_path: "/outside/a.txt", file_paths: ["/outside/a.txt", "/outside/b.txt"] };
const otherPairEdit = { file_path: "/outside/a.txt", file_paths: ["/outside/a.txt", "/outside/c.txt"] };

describe("naming the target of a file edit", () => {
  it("names one file for a single-file edit", () => {
    expect(targetOf("Edit", singleEdit)).toBe("Edit /outside/a.txt");
  });

  it("names every file of a multi-file edit, starting with the one the owner is asked about", () => {
    expect(targetOf("Edit", pairEdit)).toBe("Edit /outside/a.txt, /outside/b.txt");
  });

  it("keeps a permission for the first file from covering an edit of more files", () => {
    expect(matchesPattern(targetOf("Edit", singleEdit), targetOf("Edit", pairEdit))).toBe(false);
  });

  it("keeps a permission for one file set from covering another set sharing its first file", () => {
    expect(matchesPattern(targetOf("Edit", pairEdit), targetOf("Edit", otherPairEdit))).toBe(false);
    expect(matchesPattern(targetOf("Edit", pairEdit), targetOf("Edit", pairEdit))).toBe(true);
  });
});

describe("listing the files an edit changes", () => {
  it("lists every file a multi-file edit names", () => {
    expect(changedFilesOf(pairEdit)).toEqual(["/outside/a.txt", "/outside/b.txt"]);
  });

  it("still splits Codex's joined field", () => {
    expect(changedFilesOf({ file_path: "plan.md, /etc/hosts" })).toEqual(["plan.md", "/etc/hosts"]);
  });

  it("lists and names the same files whatever field carries the first one", () => {
    const notebook = { file_paths: [" /outside/b.ipynb ", "/outside/c.ipynb"], notebook_path: "/outside/b.ipynb" };
    expect(changedFilesOf(notebook)).toEqual(["/outside/b.ipynb", "/outside/c.ipynb"]);
    expect(targetOf("NotebookEdit", notebook)).toBe("NotebookEdit /outside/b.ipynb, /outside/c.ipynb");
    expect(targetOf("Edit", { ...pairEdit, file_path: " /outside/a.txt " })).toBe(targetOf("Edit", pairEdit));
  });

  it("ignores listed entries that are not paths", () => {
    expect(changedFilesOf({ file_path: "/outside/a.txt", file_paths: ["/outside/a.txt", 7, ""] })).toEqual([
      "/outside/a.txt",
    ]);
  });
});
