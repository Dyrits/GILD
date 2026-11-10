import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Terminals, unpackedPathOf } from "../src/terminals.ts";

const folders: string[] = [];
const managers: Terminals[] = [];
const folder = () => {
  const path = mkdtempSync(join(tmpdir(), "gild-terminal-"));
  folders.push(path);
  return path;
};
const manager = (home: string) => {
  const terminals = new Terminals(
    () => {},
    () => {},
    { home, shell: "/bin/sh" },
  );
  managers.push(terminals);
  return terminals;
};
afterEach(() => {
  for (const terminals of managers.splice(0)) terminals.dispose();
  for (const path of folders.splice(0)) rmSync(path, { force: true, recursive: true });
});

describe("using interactive terminals", () => {
  it("starts in the home folder without a realm and keeps shell state when reopened", async () => {
    const home = folder();
    const terminals = manager(home);
    terminals.open("quest", null);
    terminals.write("quest", "printf 'ROOT=%s\\n' \"$PWD\"; export GILD_TERMINAL_TEST=kept\r");
    await expect.poll(() => terminals.open("quest", null).output).toContain(`ROOT=${home}`);
    terminals.open("quest", null);
    terminals.write("quest", "printf 'STATE=%s\\n' \"$GILD_TERMINAL_TEST\"\r");
    await expect.poll(() => terminals.open("quest", null).output).toContain("STATE=kept");
  });

  it("starts at the realm root and isolates shells belonging to different conversations", async () => {
    const home = folder();
    const realm = folder();
    const terminals = manager(home);
    terminals.open("realm", realm);
    terminals.open("home", null);
    terminals.write("realm", "printf 'ROOT=%s\\n' \"$PWD\"\r");
    terminals.write("home", "printf 'ROOT=%s\\n' \"$PWD\"\r");
    await expect.poll(() => terminals.open("realm", realm).output).toContain(`ROOT=${realm}`);
    await expect.poll(() => terminals.open("home", null).output).toContain(`ROOT=${home}`);
    expect(terminals.open("home", null).output).not.toContain(`ROOT=${realm}`);
  });

  it("retains final output after the shell exits and explicitly starts a fresh shell", async () => {
    const terminals = manager(folder());
    terminals.open("quest", null);
    terminals.write("quest", "printf 'final-output\\n'; exit\r");
    await expect.poll(() => terminals.open("quest", null).isRunning).toBe(false);
    expect(terminals.open("quest", null).output).toContain("final-output");
    terminals.close("quest");
    expect(terminals.open("quest", null).isRunning).toBe(true);
  });

  it("rejects invalid sizes and missing realm folders with an actionable error", () => {
    const terminals = manager(folder());
    expect(() => terminals.open("quest", "/no-such-gild-terminal-folder")).toThrow();
    terminals.open("quest", null);
    expect(() => terminals.resize("quest", -1, 24)).toThrow();
  });
});

describe("unpackedPathOf", () => {
  it("points a path inside the packaged archive at its unpacked copy on disk", () => {
    expect(unpackedPathOf("/Applications/Gild.app/Contents/Resources/app.asar/node_modules/node-pty")).toBe(
      "/Applications/Gild.app/Contents/Resources/app.asar.unpacked/node_modules/node-pty",
    );
  });

  it("leaves a path outside an archive alone", () => {
    expect(unpackedPathOf("/repo/node_modules/node-pty")).toBe("/repo/node_modules/node-pty");
  });
});
