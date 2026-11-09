// Proof probe for CHG-0072: a copy of the owner's data laid out as before the rename is moved with
// `moveFormerData`, the built service starts on the result, and its missions are listed over its socket.
// Usage: bun probe.ts <repository> <source data folder>   (the repository supplies formerData.ts)
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [repository, source] = process.argv.slice(2);
if (repository === undefined || source === undefined) throw new Error("usage: bun probe.ts <repository> <source>");
const { moveFormerData } = await import(join(repository, "apps/desktop/src/formerData.ts"));

const sqlite = (database: string, statement: string) =>
  spawnSync("sqlite3", [database, statement], { encoding: "utf8" }).stdout.trim();
const projectNameOf = (folder: string) => folder.replace(/[^a-zA-Z0-9]/g, "-");

// The source database is whichever name the owner's install carries: canopy.sqlite before the move, gild.sqlite after.
const sourceDatabase = ["canopy.sqlite", "gild.sqlite"]
  .map((name) => join(source, name))
  .find((path) => existsSync(path));
if (sourceDatabase === undefined) throw new Error(`no database in ${source}`);

// The former layout: Canopy/canopy.sqlite, and a Claude Code session folder for one scratch folder.
const root = realpathSync(mkdtempSync(join(tmpdir(), "gild-proof-")));
const applicationData = join(root, "Application Support");
const former = join(applicationData, "Canopy");
const claudeFolder = join(root, ".claude");
mkdirSync(join(former, "missions"), { recursive: true });
sqlite(sourceDatabase, `.backup '${join(former, "canopy.sqlite")}'`);
const session = `${projectNameOf(join(former, "missions"))}-m1`;
mkdirSync(join(claudeFolder, "projects", session), { recursive: true });
const expected = Number(sqlite(join(former, "canopy.sqlite"), "SELECT count(*) FROM missions"));

const folder = join(applicationData, "Gild");
// Electron makes its profile folder before the app moves the data in, so the move has to join it.
mkdirSync(folder, { recursive: true });
writeFileSync(join(folder, "Local State"), "profile");
moveFormerData(applicationData, folder, claudeFolder);
const movedSession = `${projectNameOf(join(folder, "missions"))}-m1`;
console.log("profile kept:", readFileSync(join(folder, "Local State"), "utf8") === "profile");
console.log("gild.sqlite present:", existsSync(join(folder, "gild.sqlite")));
console.log("Claude session renamed:", existsSync(join(claudeFolder, "projects", movedSession)));

// The built service, as the desktop app starts it, on the fake harness so no turn can run.
const token = "proof";
// The Electron binary itself, so the process found listening is the service.
const electron: string = (await import(join(repository, "node_modules/electron/index.js"))).default;
const service = spawn(electron, [join(repository, "apps/desktop/dist/service.js")], {
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    GILD_DATA_DIR: folder,
    GILD_HARNESS: "fake",
    GILD_TOKEN: token,
  },
  stdio: ["ignore", "ignore", "inherit"],
});
// The service also serves its thread tools over HTTP on loopback, so each listening port is tried.
const portsOf = async () => {
  // Polled every half second for 30 seconds; both servers start before the service settles.
  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const listing = spawnSync("lsof", ["-nP", "-a", "-p", String(service.pid), "-iTCP", "-sTCP:LISTEN"], {
      encoding: "utf8",
    }).stdout;
    const ports = [...listing.matchAll(/127\.0\.0\.1:(\d+)/g)].map((match) => match[1]);
    if (ports.length > 0 && attempt > 4) return ports;
  }
  throw new Error("the service never listened");
};
const open = (port: string) =>
  new Promise<WebSocket | null>((resolve) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/?token=${token}`);
    socket.addEventListener("open", () => resolve(socket));
    socket.addEventListener("error", () => resolve(null));
  });
let socket: WebSocket | null = null;
for (const port of await portsOf()) socket ??= await open(port);
if (socket === null) throw new Error("no port accepted the socket");
// A hung request fails the probe instead of waiting forever.
setTimeout(() => {
  service.kill();
  console.log("FAIL: no answer within 20 seconds");
  process.exit(1);
}, 20_000);
const connected = socket;
const request = (id: string, isArchived: boolean) =>
  new Promise<number>((resolve) => {
    connected.addEventListener("message", (event) => {
      const frame = JSON.parse(String(event.data));
      if (frame.id === id && frame._tag !== "Success") throw new Error(`${id} failed: ${String(event.data)}`);
      if (frame.id === id) resolve(frame.value.missions.length);
    });
    connected.send(
      JSON.stringify({
        id,
        request: { _tag: "ListMissions", isArchived, search: null, state: null, workspaceId: null },
      }),
    );
  });
const listed = (await request("dashboard", false)) + (await request("archived", true));
socket.close();
service.kill();

console.log(`missions in the source: ${expected}; listed by the service: ${listed}`);
const isProven =
  readFileSync(join(folder, "Local State"), "utf8") === "profile" &&
  existsSync(join(folder, "gild.sqlite")) &&
  existsSync(join(claudeFolder, "projects", movedSession)) &&
  expected > 0 &&
  listed === expected;
console.log(isProven ? "PASS" : "FAIL");
process.exit(isProven ? 0 : 1);
