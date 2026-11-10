// Builds the installed app: the service and the main process, the Expo web export that the window shows, and
// then the .app and .dmg in apps/desktop/release. It starts and stops no running Gild, and installs nothing.
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..", "..", "..");
const desktop = join(root, "apps", "desktop");

const run = (command: string, args: string[], cwd: string) => {
  const result = spawnSync(command, args, { cwd, env: process.env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run(process.execPath, ["run", "build"], desktop);
// The window's screens ship inside the app, so it needs no dev server.
const screens = join(desktop, "dist", "app");
rmSync(screens, { force: true, recursive: true });
run("bunx", ["expo", "export", "--platform", "web", "--output-dir", screens], join(root, "apps", "app"));
rmSync(join(desktop, "release"), { force: true, recursive: true });
run("bunx", ["electron-builder", "--config", "electron-builder.yml"], desktop);
console.log(`Built ${join(desktop, "release")}. Quit Gild, open the .dmg, and drag Gild to Applications.`);
