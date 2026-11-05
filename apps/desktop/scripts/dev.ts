// Starts the Expo web dev server and Electron together; stopping either stops both.
import { spawn } from "node:child_process";
import { join } from "node:path";

const root = join(import.meta.dir, "..", "..", "..");
const children = [
  spawn("bunx", ["expo", "start", "--port", "8081"], {
    cwd: join(root, "apps", "app"),
    env: { ...process.env, BROWSER: "none", CI: "1" },
    stdio: "inherit",
  }),
  spawn("bunx", ["electron", "dist/main.js"], { cwd: join(root, "apps", "desktop"), stdio: "inherit" }),
];

const stop = () => {
  for (const child of children) if (child.exitCode === null) child.kill();
};
for (const child of children) child.on("exit", stop);
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
