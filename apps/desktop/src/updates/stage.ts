import { execFile } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * Copies the app out of a downloaded disk image to `destination`, then checks its seal and clears the marks a
 * download leaves, so the swap that follows only renames. A copy made here has no quarantine mark of its own.
 */
export const stageApp = async (image: string, destination: string): Promise<void> => {
  const mount = await mkdtemp(join(tmpdir(), "iskios-update-image-"));
  try {
    await run("hdiutil", ["attach", "-nobrowse", "-readonly", "-noverify", "-mountpoint", mount, image]);
    try {
      const app = (await readdir(mount)).find((name) => name.endsWith(".app"));
      if (app === undefined) throw new Error("The downloaded disk image holds no app.");
      await rm(destination, { force: true, recursive: true });
      await run("ditto", [join(mount, app), destination]);
    } finally {
      await run("hdiutil", ["detach", "-force", mount]).catch(() => void 0);
    }
    await run("codesign", ["--verify", "--deep", "--strict", destination]);
    await run("xattr", ["-cr", destination]);
  } catch (reason) {
    await rm(destination, { force: true, recursive: true });
    throw reason;
  } finally {
    await rm(mount, { force: true, recursive: true });
  }
};
