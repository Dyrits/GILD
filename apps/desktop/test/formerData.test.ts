import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { moveFormerData } from "../src/formerData.ts";

const projectNameOf = (folder: string) => folder.replace(/[^a-zA-Z0-9]/g, "-");

/** A former install with a database, one account, and Claude Code sessions for a scratch folder. */
const formerInstall = () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "canopy-former-data-")));
  const applicationData = join(root, "Application Support");
  const former = join(applicationData, "OpenMission");
  const claudeFolder = join(root, ".claude");
  mkdirSync(join(former, "missions", "m1"), { recursive: true });
  mkdirSync(join(former, "accounts", "a1", "projects", `${projectNameOf(join(former, "missions"))}-m2`), {
    recursive: true,
  });
  writeFileSync(join(former, "openmission.sqlite"), "database");
  writeFileSync(join(former, "openmission.sqlite-wal"), "wal");
  mkdirSync(join(claudeFolder, "projects", `${projectNameOf(join(former, "missions"))}-m1`), { recursive: true });
  mkdirSync(join(claudeFolder, "projects", "-elsewhere"), { recursive: true });
  return { applicationData, claudeFolder, folder: join(applicationData, "Canopy"), former };
};

describe("moving the former data", () => {
  it("moves the former folder and renames the database with its write-ahead file", () => {
    const install = formerInstall();
    moveFormerData(install.applicationData, install.folder, install.claudeFolder);
    expect(existsSync(install.former)).toBe(false);
    expect(readFileSync(join(install.folder, "canopy.sqlite"), "utf8")).toBe("database");
    expect(readFileSync(join(install.folder, "canopy.sqlite-wal"), "utf8")).toBe("wal");
    expect(existsSync(join(install.folder, "missions", "m1"))).toBe(true);
  });

  it("renames Claude Code sessions of scratch folders for the computer's sign-in and each account", () => {
    const install = formerInstall();
    moveFormerData(install.applicationData, install.folder, install.claudeFolder);
    const prefix = projectNameOf(join(install.folder, "missions"));
    expect(existsSync(join(install.claudeFolder, "projects", `${prefix}-m1`))).toBe(true);
    expect(existsSync(join(install.folder, "accounts", "a1", "projects", `${prefix}-m2`))).toBe(true);
    expect(existsSync(join(install.claudeFolder, "projects", "-elsewhere"))).toBe(true);
  });

  it("leaves both folders alone once the new folder exists", () => {
    const install = formerInstall();
    mkdirSync(install.folder);
    moveFormerData(install.applicationData, install.folder, install.claudeFolder);
    expect(existsSync(join(install.former, "openmission.sqlite"))).toBe(true);
    expect(existsSync(join(install.folder, "canopy.sqlite"))).toBe(false);
  });
});
