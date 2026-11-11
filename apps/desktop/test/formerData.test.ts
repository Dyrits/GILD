import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { moveFormerData } from "../src/formerData.ts";

const projectNameOf = (folder: string) => folder.replace(/[^a-zA-Z0-9]/g, "-");

/** A former install with a database, one account, and Claude Code sessions for a scratch folder. */
const formerInstall = (formerName: "Gild" | "Canopy" | "OpenMission" = "Canopy") => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "iskios-former-data-")));
  const applicationData = join(root, "Application Support");
  const former = join(applicationData, formerName);
  const database = `${formerName.toLowerCase()}.sqlite`;
  const claudeFolder = join(root, ".claude");
  mkdirSync(join(former, "missions", "m1"), { recursive: true });
  mkdirSync(join(former, "accounts", "a1", "projects", `${projectNameOf(join(former, "missions"))}-m2`), {
    recursive: true,
  });
  writeFileSync(join(former, database), "database");
  writeFileSync(join(former, `${database}-wal`), "wal");
  mkdirSync(join(claudeFolder, "projects", `${projectNameOf(join(former, "missions"))}-m1`), { recursive: true });
  mkdirSync(join(claudeFolder, "projects", "-elsewhere"), { recursive: true });
  return { applicationData, claudeFolder, database, folder: join(applicationData, "Iskios"), former };
};

describe("moving the former data", () => {
  it.each(["Gild", "Canopy", "OpenMission"] as const)(
    "moves a %s install and renames its database with the write-ahead file",
    (name) => {
      const install = formerInstall(name);
      moveFormerData(install.applicationData, install.folder, install.claudeFolder);
      expect(existsSync(install.former)).toBe(false);
      expect(readFileSync(join(install.folder, "iskios.sqlite"), "utf8")).toBe("database");
      expect(readFileSync(join(install.folder, "iskios.sqlite-wal"), "utf8")).toBe("wal");
      expect(existsSync(join(install.folder, "missions", "m1"))).toBe(true);
    },
  );

  it.each(["Gild", "Canopy", "OpenMission"] as const)(
    "renames Claude Code sessions of scratch folders for a %s install, for the computer's sign-in and each account",
    (name) => {
      const install = formerInstall(name);
      moveFormerData(install.applicationData, install.folder, install.claudeFolder);
      const prefix = projectNameOf(join(install.folder, "missions"));
      expect(existsSync(join(install.claudeFolder, "projects", `${prefix}-m1`))).toBe(true);
      expect(existsSync(join(install.folder, "accounts", "a1", "projects", `${prefix}-m2`))).toBe(true);
      expect(existsSync(join(install.claudeFolder, "projects", "-elsewhere"))).toBe(true);
    },
  );

  it("moves the newest former folder when several exist", () => {
    const install = formerInstall("Gild");
    mkdirSync(join(install.applicationData, "Canopy"), { recursive: true });
    moveFormerData(install.applicationData, install.folder, install.claudeFolder);
    expect(existsSync(install.former)).toBe(false);
    expect(existsSync(join(install.applicationData, "Canopy"))).toBe(true);
  });

  it("moves the data into a profile folder the app already made, leaving the profile's own files", () => {
    const install = formerInstall();
    mkdirSync(install.folder);
    writeFileSync(join(install.folder, "Local State"), "profile");
    moveFormerData(install.applicationData, install.folder, install.claudeFolder);
    expect(readFileSync(join(install.folder, "iskios.sqlite"), "utf8")).toBe("database");
    expect(existsSync(join(install.folder, "missions", "m1"))).toBe(true);
    expect(readFileSync(join(install.folder, "Local State"), "utf8")).toBe("profile");
  });

  it("leaves both folders alone once the new database exists", () => {
    const install = formerInstall();
    mkdirSync(install.folder);
    writeFileSync(join(install.folder, "iskios.sqlite"), "the owner's data");
    moveFormerData(install.applicationData, install.folder, install.claudeFolder);
    expect(existsSync(join(install.former, install.database))).toBe(true);
    expect(readFileSync(join(install.folder, "iskios.sqlite"), "utf8")).toBe("the owner's data");
  });
});
