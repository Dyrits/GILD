import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { appFileOf } from "../src/appFiles.ts";

const root = mkdtempSync(join(tmpdir(), "gild-app-files-"));
mkdirSync(join(root, "_expo"));
writeFileSync(join(root, "index.html"), "<html></html>");
writeFileSync(join(root, "_expo", "app.js"), "");

describe("appFileOf", () => {
  it("answers a path with the file it names", () => {
    expect(appFileOf(root, "/_expo/app.js")).toBe(join(root, "_expo", "app.js"));
  });

  it("answers the root and a screen path with index.html", () => {
    expect(appFileOf(root, "/")).toBe(join(root, "index.html"));
    expect(appFileOf(root, "/quests/42")).toBe(join(root, "index.html"));
  });

  it("answers a missing file with an extension as nothing", () => {
    expect(appFileOf(root, "/missing.js")).toBeNull();
  });

  it("never leaves the app folder", () => {
    // A climbing path is read as if rooted at the app folder, so it finds nothing outside it.
    expect(appFileOf(root, "/../../etc/passwd")).toBe(join(root, "index.html"));
    expect(appFileOf(root, "/..%2F..%2Fetc%2Fhosts.txt")).toBeNull();
  });
});
