import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stageApp } from "../../src/updates/stage.ts";
import { swapScript } from "../../src/updates/swap.ts";

/** An Applications folder holding a fake installed app and a staged new one, and the files the script uses. */
const applications = () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "iskios-swap-")));
  const bundle = join(root, "Iskios.app");
  const staged = join(root, ".Iskios-update.app");
  mkdirSync(join(bundle, "Contents"), { recursive: true });
  writeFileSync(join(bundle, "Contents", "version"), "old");
  mkdirSync(join(staged, "Contents"), { recursive: true });
  writeFileSync(join(staged, "Contents", "version"), "new");
  const script = join(root, "swap.sh");
  writeFileSync(script, swapScript, { mode: 0o700 });
  // The "opener" records what it was asked to open instead of launching anything.
  const opener = join(root, "opener.sh");
  writeFileSync(opener, `#!/bin/sh\necho "$1" >> "${join(root, "opened")}"\n`, { mode: 0o700 });
  return { backup: join(root, "Iskios.old.app"), bundle, log: join(root, "failure.log"), opener, root, script, staged };
};

/** Runs the script after a process that has already finished, so there is nothing to wait for. */
const swap = (folder: ReturnType<typeof applications>) => {
  const finished = spawnSync("/usr/bin/true");
  return spawnSync("/bin/sh", [
    folder.script,
    String(finished.pid),
    folder.bundle,
    folder.staged,
    folder.backup,
    folder.log,
    folder.opener,
  ]);
};

describe("swapping the installed app", () => {
  it("puts the new app in place, removes the old one, and opens the new one", () => {
    const folder = applications();
    expect(swap(folder).status).toBe(0);
    expect(readFileSync(join(folder.bundle, "Contents", "version"), "utf8")).toBe("new");
    expect(existsSync(folder.backup)).toBe(false);
    expect(existsSync(folder.staged)).toBe(false);
    expect(readFileSync(join(folder.root, "opened"), "utf8").trim()).toBe(folder.bundle);
    expect(existsSync(folder.log)).toBe(false);
  });

  it("puts the old app back and says so when the new one cannot be moved in", () => {
    const folder = applications();
    spawnSync("/bin/rm", ["-rf", folder.staged]);
    expect(swap(folder).status).toBe(1);
    expect(readFileSync(join(folder.bundle, "Contents", "version"), "utf8")).toBe("old");
    expect(readFileSync(folder.log, "utf8")).toContain("the installed version was kept");
    expect(readFileSync(join(folder.root, "opened"), "utf8").trim()).toBe(folder.bundle);
  });

  it("waits for the running app to quit before replacing it", () => {
    const folder = applications();
    // An orphan, so that it is reaped when it ends (a child of this blocked process would stay a zombie).
    const orphan = spawnSync("/bin/sh", ["-c", "sleep 1 </dev/null >/dev/null 2>&1 & echo $!"]);
    const started = Date.now();
    spawnSync("/bin/sh", [
      folder.script,
      orphan.stdout.toString().trim(),
      folder.bundle,
      folder.staged,
      folder.backup,
      folder.log,
      folder.opener,
    ]);
    expect(Date.now() - started).toBeGreaterThanOrEqual(700);
    expect(readFileSync(join(folder.bundle, "Contents", "version"), "utf8")).toBe("new");
  });

  it("keeps paths with spaces and quotes intact", () => {
    const folder = applications();
    const odd = join(folder.root, `Iskios's "Apps"`);
    mkdirSync(odd);
    const bundle = join(odd, "Iskios.app");
    const staged = join(odd, "new.app");
    mkdirSync(bundle);
    mkdirSync(staged);
    writeFileSync(join(staged, "marker"), "new");
    const finished = spawnSync("/usr/bin/true");
    spawnSync("/bin/sh", [
      folder.script,
      String(finished.pid),
      bundle,
      staged,
      join(odd, "old.app"),
      folder.log,
      folder.opener,
    ]);
    expect(readFileSync(join(bundle, "marker"), "utf8")).toBe("new");
  });
});

describe.runIf(process.platform === "darwin")("staging the app from a disk image", () => {
  /** A minimal app bundle with an ad hoc seal, packed into a disk image. */
  const imageOfApp = () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "iskios-stage-")));
    const source = join(root, "source");
    const app = join(source, "Iskios.app");
    mkdirSync(join(app, "Contents", "MacOS"), { recursive: true });
    writeFileSync(join(app, "Contents", "MacOS", "Iskios"), "#!/bin/sh\n", { mode: 0o755 });
    writeFileSync(
      join(app, "Contents", "Info.plist"),
      `<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>CFBundleExecutable</key><string>Iskios</string><key>CFBundleIdentifier</key><string>app.iskios.test</string></dict></plist>`,
    );
    expect(spawnSync("codesign", ["--force", "--sign", "-", app]).status).toBe(0);
    const image = join(root, "Iskios.dmg");
    expect(spawnSync("hdiutil", ["create", "-srcfolder", source, "-format", "UDZO", "-quiet", image]).status).toBe(0);
    return { image, root };
  };

  it("copies a sealed app out of the image and leaves nothing mounted", async () => {
    const { image, root } = imageOfApp();
    const destination = join(root, ".Iskios-update.app");
    await stageApp(image, destination);
    expect(existsSync(join(destination, "Contents", "MacOS", "Iskios"))).toBe(true);
    expect(spawnSync("codesign", ["--verify", "--deep", "--strict", destination]).status).toBe(0);
    expect(spawnSync("hdiutil", ["info"]).stdout.toString()).not.toContain(image);
  }, 60_000);

  it("refuses an app whose seal is missing and leaves no copy behind", async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "iskios-stage-")));
    const source = join(root, "source");
    mkdirSync(join(source, "Iskios.app", "Contents"), { recursive: true });
    const image = join(root, "Iskios.dmg");
    expect(spawnSync("hdiutil", ["create", "-srcfolder", source, "-format", "UDZO", "-quiet", image]).status).toBe(0);
    const destination = join(root, ".Iskios-update.app");
    await expect(stageApp(image, destination)).rejects.toThrow();
    expect(existsSync(destination)).toBe(false);
  }, 60_000);
});
