// Starts the Expo web dev server and Electron together; stopping either stops both.
// The renderer hot-reloads from the Expo server. A change to the service, the contracts, or the desktop main
// process rebuilds dist/ and relaunches Electron, which restarts the service and stops its running turns.
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { watch } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const root = join(import.meta.dir, "..", "..", "..");
const desktop = join(root, "apps", "desktop");
// The Electron binary itself, so killing it stops the app and its service rather than a wrapper around them.
const electronBinary = createRequire(join(desktop, "package.json"))("electron") as string;

const expo = spawn("bunx", ["expo", "start", "--port", "8081"], {
  cwd: join(root, "apps", "app"),
  env: { ...process.env, BROWSER: "none", CI: "1" },
  stdio: "inherit",
});
let electron: ChildProcess | undefined;
let relaunching = false;

const stop = () => {
  for (const child of [expo, electron]) if (child?.exitCode === null) child.kill();
};
expo.on("exit", stop);

const launchElectron = () => {
  const child = spawn(electronBinary, ["dist/main.js"], { cwd: desktop, stdio: "inherit" });
  electron = child;
  // Closing the window ends the session; a relaunch replaces the process instead.
  child.on("exit", () => {
    if (!relaunching) stop();
  });
};

const relaunchElectron = () => {
  const previous = electron;
  if (previous === undefined || previous.exitCode !== null) return launchElectron();
  relaunching = true;
  previous.once("exit", () => {
    relaunching = false;
    launchElectron();
  });
  previous.kill();
};

const rebuild = () => {
  const build = spawnSync(process.execPath, ["run", "build"], { cwd: desktop, stdio: "inherit" });
  if (build.status !== 0) {
    console.error("The build failed; Electron keeps running the last build that worked.");
    return;
  }
  relaunchElectron();
};

// Saves arrive in bursts, so the rebuild waits until they settle.
let pending: ReturnType<typeof setTimeout> | undefined;
for (const source of [
  join(root, "packages", "contracts", "src"),
  join(root, "packages", "service", "src"),
  join(desktop, "src"),
]) {
  watch(source, { recursive: true }, () => {
    clearTimeout(pending);
    pending = setTimeout(rebuild, 300);
  });
}

launchElectron();
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
