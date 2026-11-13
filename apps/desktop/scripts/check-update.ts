// Proves a packaged macOS app updates itself from a local stand-in for GitHub, on throwaway data:
//   bun apps/desktop/scripts/check-update.ts /path/to/older/Iskios.app /path/to/Iskios-<newer version>-mac-<arch>.dmg
// It copies the older app to a temporary Applications folder, serves the newer disk image as a release, lets the app
// find and download it, installs it, and checks that the app on disk and the one that starts afterwards are the newer.
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const evaluate = (url: string, expression: string, awaitResult = true) =>
  new Promise<unknown>((resolveValue, reject) => {
    const socket = new WebSocket(url);
    const finish = (error: Error | null, value: unknown = null) => {
      clearTimeout(timer);
      socket.close();
      if (error !== null) reject(error);
      else resolveValue(value);
    };
    const timer = setTimeout(() => finish(new Error("The renderer did not answer.")), 8000);
    socket.onopen = () =>
      socket.send(
        JSON.stringify({
          id: 1,
          method: "Runtime.evaluate",
          params: { awaitPromise: awaitResult, expression, returnByValue: true },
        }),
      );
    socket.onerror = () => finish(new Error("Cannot connect to the renderer."));
    socket.onmessage = (event) => {
      const message: unknown = JSON.parse(String(event.data));
      if (!isRecord(message) || message.id !== 1) return;
      const result = message.result;
      if (!isRecord(result) || result.exceptionDetails !== undefined || !isRecord(result.result)) {
        finish(new Error(`The renderer refused: ${JSON.stringify(result).slice(0, 300)}`));
        return;
      }
      finish(null, result.result.value);
    };
  });

const pause = (milliseconds: number) => new Promise((done) => setTimeout(done, milliseconds));

/** The renderer page of the app whose data folder is `data`, once it answers. */
const pageOf = async (data: string, deadline: number) => {
  while (Date.now() < deadline) {
    const active = await readFile(join(data, "profile", "DevToolsActivePort"), "utf8").catch(() => null);
    const port = active?.split("\n")[0];
    if (port !== undefined && /^\d+$/.test(port)) {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`).catch(() => null);
      const pages: unknown = response?.ok ? await response.json() : null;
      if (Array.isArray(pages))
        for (const page of pages)
          if (isRecord(page) && page.url === "iskios-app://app/" && typeof page.webSocketDebuggerUrl === "string")
            return page.webSocketDebuggerUrl;
    }
    await pause(250);
  }
  throw new Error("The app did not show its screen in time.");
};

const versionOf = (bundle: string) =>
  spawnSync("/usr/libexec/PlistBuddy", [
    "-c",
    "Print :CFBundleShortVersionString",
    join(bundle, "Contents", "Info.plist"),
  ])
    .stdout.toString()
    .trim();

const check = async () => {
  const [olderArgument, imageArgument] = process.argv.slice(2);
  if (olderArgument === undefined || imageArgument === undefined)
    throw new Error("Pass the older app and the newer disk image.");
  const image = resolve(imageArgument);
  const tag = /^Iskios-(.+)-mac-[a-z0-9]+\.dmg$/.exec(basename(image))?.[1];
  if (tag === undefined) throw new Error("The disk image must be named Iskios-<version>-mac-<arch>.dmg.");
  const root = await mkdtemp(join(tmpdir(), "iskios-update-check-"));
  const applications = join(root, "Applications");
  const bundle = join(applications, "Iskios.app");
  const data = join(root, "data");
  spawnSync("mkdir", ["-p", applications]);
  spawnSync("ditto", [resolve(olderArgument), bundle]);
  const olderVersion = versionOf(bundle);
  const disk = await readFile(image);
  const sums = `${createHash("sha512").update(disk).digest("hex")}  ${basename(image)}\n`;
  const userAgents: string[] = [];
  const server = createServer((request, response) => {
    userAgents.push(String(request.headers["user-agent"]));
    const send = (body: string | Buffer, type: string) => {
      response.writeHead(200, { "content-length": Buffer.byteLength(body), "content-type": type });
      response.end(body);
    };
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    if (request.url?.startsWith("/releases"))
      send(
        JSON.stringify([
          {
            assets: [
              { browser_download_url: `${base}/image`, name: basename(image), size: disk.length },
              { browser_download_url: `${base}/sums`, name: "SHA512SUMS.txt", size: sums.length },
            ],
            body: "## Breaking changes\n- Saved data from earlier releases is not carried over.",
            draft: false,
            html_url: `https://github.com/Dyrits/ISKIOS/releases/tag/${tag}`,
            prerelease: true,
            tag_name: tag,
          },
        ]),
        "application/json",
      );
    else if (request.url === "/image") send(disk, "application/octet-stream");
    else if (request.url === "/sums") send(sums, "text/plain");
    else {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const port = (server.address() as { port: number }).port;
  // Stands in for `open`: records what it was asked to open, and starts that app with the same throwaway data.
  const opener = join(root, "open.sh");
  // With ISKIOS_CHECK_LAUNCH_SERVICES=1 the stand-in starts the new app through the real `open`, so macOS's own checks
  // of a replaced app run too; `--env` gives it the throwaway data so no real profile opens.
  const start =
    process.env.ISKIOS_CHECK_LAUNCH_SERVICES === "1"
      ? `/usr/bin/open -n --env ISKIOS_DATA_DIR="${data}" --env ISKIOS_HARNESS=fake "$1" --args --remote-debugging-port=0`
      : `"$1/Contents/MacOS/Iskios" --remote-debugging-port=0 >/dev/null 2>&1 &`;
  await writeFile(opener, `#!/bin/sh\necho "$1" > "${join(root, "opened")}"\n${start}\n`);
  await chmod(opener, 0o755);
  const env = {
    ...process.env,
    ISKIOS_DATA_DIR: data,
    ISKIOS_HARNESS: "fake",
    ISKIOS_UPDATE_OPENER: opener,
    ISKIOS_UPDATE_URL: `http://127.0.0.1:${port}/releases`,
  };
  const older = spawn(join(bundle, "Contents", "MacOS", "Iskios"), ["--remote-debugging-port=0"], {
    env,
    stdio: "ignore",
  });
  const olderExited = new Promise<void>((done) => older.once("close", () => done()));
  let newer: number | null = null;
  try {
    const page = await pageOf(data, Date.now() + 30000);
    const states: string[] = [];
    let ready: Record<string, unknown> | null = null;
    for (const deadline = Date.now() + 90000; ready === null && Date.now() < deadline; await pause(500)) {
      // The window may exist a moment before its bridge does.
      const state = await evaluate(page, "window.iskios?.updates?.state() ?? null").catch(() => null);
      if (state === null) continue;
      if (!isRecord(state) || !isRecord(state.status)) throw new Error("The update state has no status.");
      const name = String(state.status._tag);
      if (states.at(-1) !== name) states.push(name);
      if (state.status._tag === "Ready") ready = state;
      if (state.status._tag === "Failed") throw new Error(`The update failed: ${String(state.status.message)}`);
    }
    if (ready === null) throw new Error(`No update became ready (saw ${states.join(", ")}).`);
    const status = ready.status as Record<string, unknown>;
    if (status.version !== tag) throw new Error(`Found ${String(status.version)}, expected ${tag}.`);
    if (!String(status.notes).includes("Breaking changes")) throw new Error("The release notes did not arrive.");
    if (!userAgents.every((agent) => agent === `Iskios/${olderVersion}`))
      throw new Error(`The check sent unexpected user agents: ${userAgents.join(", ")}`);
    console.log(
      `PASS: ${olderVersion} found ${tag} (${states.join(" > ")}) and sent only user agent Iskios/${olderVersion}.`,
    );
    await rm(join(data, "profile", "DevToolsActivePort"), { force: true });
    await evaluate(page, "window.iskios.updates.install()", false).catch(() => null);
    await Promise.race([olderExited, pause(20000)]);
    if (older.exitCode === null && older.signalCode === null) throw new Error("The older app did not quit to update.");
    for (
      const deadline = Date.now() + 30000;
      !existsSync(join(root, "opened")) && Date.now() < deadline;
      await pause(250)
    );
    if (!existsSync(join(root, "opened"))) throw new Error("The swap never opened the new app.");
    const installed = versionOf(bundle);
    if (installed !== tag) throw new Error(`The app on disk is ${installed}, expected ${tag}.`);
    for (const leftover of [".Iskios-update.app", ".Iskios-previous.app"])
      if (existsSync(join(applications, leftover))) throw new Error(`${leftover} was left behind.`);
    const seal = spawnSync("codesign", ["--verify", "--deep", "--strict", bundle]);
    if (seal.status !== 0) throw new Error(`The new app's seal is broken: ${seal.stderr.toString()}`);
    const quarantine = spawnSync("xattr", ["-p", "com.apple.quarantine", bundle]);
    if (quarantine.status === 0) throw new Error("The new app carries a quarantine mark.");
    console.log(`PASS: the app on disk is ${installed}, sealed, with no leftovers and no quarantine mark.`);
    // The window may exist a moment before the bridge does, so ask until it answers.
    let after: unknown = null;
    for (const deadline = Date.now() + 40000; Date.now() < deadline && after === null; await pause(500)) {
      const url = await pageOf(data, deadline).catch(() => null);
      if (url !== null) after = await evaluate(url, "window.iskios?.updates?.state() ?? null").catch(() => null);
    }
    if (!isRecord(after) || after.currentVersion !== tag)
      throw new Error(`The new app reports ${JSON.stringify(after)}.`);
    newer =
      spawnSync("pgrep", ["-f", `${bundle}/Contents/MacOS/Iskios`])
        .stdout.toString()
        .trim()
        .split("\n")
        .map(Number)[0] ?? null;
    console.log(`PASS: the app that started afterwards reports version ${String(after.currentVersion)}.`);
  } finally {
    server.close();
    for (const pid of [older.pid ?? null, newer]) if (pid !== null) spawnSync("kill", [String(pid)]);
    spawnSync("pkill", ["-f", `${bundle}/Contents/MacOS/Iskios`]);
    await pause(1500);
    // Keeps the temporary app out of Finder's and the Dock's future choices of which Iskios to open.
    spawnSync(
      "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister",
      ["-u", bundle],
    );
    await rm(root, { force: true, recursive: true });
  }
};

check().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
