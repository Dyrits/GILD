import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createMacUpdater } from "../../src/updates/macUpdater.ts";
import type { SwapPlan } from "../../src/updates/swap.ts";

const servers: Server[] = [];
afterEach(() => {
  for (const server of servers.splice(0)) server.close();
});

const disk = Buffer.from("a disk image".repeat(1000));
const hashOf = (content: Buffer) => createHash("sha512").update(content).digest("hex");

/** A local stand-in for GitHub's release list and the files of one release. */
const github = async (options: { sums?: string; tag?: string } = {}) => {
  const tag = options.tag ?? "0.1.2-Prototype";
  let base = "";
  const server = createServer((request, response) => {
    const send = (body: string | Buffer, type = "application/json") => {
      response.writeHead(200, { "content-length": Buffer.byteLength(body), "content-type": type });
      response.end(body);
    };
    if (request.url?.startsWith("/releases")) {
      send(
        JSON.stringify([
          {
            assets: [
              { browser_download_url: `${base}/file.dmg`, name: `Iskios-${tag}-mac-arm64.dmg`, size: disk.length },
              { browser_download_url: `${base}/sums`, name: "SHA512SUMS.txt", size: 100 },
            ],
            body: "<h2>Breaking</h2><p>Reset your data</p>",
            draft: false,
            html_url: `https://github.com/example/releases/tag/${tag}`,
            prerelease: true,
            tag_name: tag,
          },
        ]),
      );
    } else if (request.url === "/file.dmg") send(disk, "application/octet-stream");
    else if (request.url === "/sums")
      send(options.sums ?? `${hashOf(disk)}  Iskios-${tag}-mac-arm64.dmg\n`, "text/plain");
    else {
      response.writeHead(404);
      response.end();
    }
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address !== null ? address.port : 0}`;
  return base;
};

const installation = () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "iskios-mac-updater-")));
  mkdirSync(join(root, "Applications", "Iskios.app"), { recursive: true });
  return { bundle: join(root, "Applications", "Iskios.app"), folder: join(root, "updates"), root };
};

const updaterOf = async (options: { sums?: string; version?: string; tag?: string } = {}, place = installation()) => {
  const base = await github(options);
  const events: string[] = [];
  const plans: SwapPlan[] = [];
  const updater = createMacUpdater({
    appVersion: options.version ?? "0.1.1-Prototype",
    arch: "arm64",
    bundle: place.bundle,
    fetchFn: fetch,
    folder: place.folder,
    pid: 4242,
    quit: () => events.push("quit"),
    releasesUrl: `${base}/releases`,
    stage: async (image, destination) => {
      events.push(`stage ${image === join(place.folder, "Iskios-0.1.2-Prototype-mac-arm64.dmg")} ${destination}`);
    },
    swap: async (plan) => {
      events.push("swap");
      plans.push(plan);
    },
  });
  return { events, place, plans, updater };
};

describe("checking on a Mac", () => {
  it("downloads a newer release, checks its hash, and reports it ready with plain notes", async () => {
    const { place, updater } = await updaterOf();
    const percents: number[] = [];
    const result = await updater.check((percent) => percents.push(percent));
    expect(result).toEqual({
      _tag: "Ready",
      update: {
        notes: "Breaking\nReset your data",
        pageUrl: "https://github.com/example/releases/tag/0.1.2-Prototype",
        version: "0.1.2-Prototype",
      },
    });
    expect(readdirSync(place.folder)).toEqual(["Iskios-0.1.2-Prototype-mac-arm64.dmg"]);
    expect(percents.at(-1)).toBe(100);
  });

  it("finds nothing when the running version is the newest", async () => {
    const { updater } = await updaterOf({ version: "0.1.2-Prototype" });
    expect(await updater.check(() => void 0)).toEqual({ _tag: "Nothing", note: null });
  });

  it("discards a download whose hash differs from the release's checksums", async () => {
    const { place, updater } = await updaterOf({ sums: `${"0".repeat(128)}  Iskios-0.1.2-Prototype-mac-arm64.dmg\n` });
    await expect(updater.check(() => void 0)).rejects.toThrow("did not match its checksum");
    expect(readdirSync(place.folder)).toEqual([]);
  });

  it("refuses a release whose checksums do not list the installer", async () => {
    const { updater } = await updaterOf({ sums: `${hashOf(disk)}  Other.dmg\n` });
    await expect(updater.check(() => void 0)).rejects.toThrow("do not list");
  });

  it.runIf(process.getuid?.() !== 0)("says so when the folder holding the app cannot be written", async () => {
    const place = installation();
    chmodSync(join(place.root, "Applications"), 0o555);
    const { updater } = await updaterOf({}, place);
    await expect(updater.check(() => void 0)).rejects.toThrow("not writable");
    chmodSync(join(place.root, "Applications"), 0o755);
  });
});

describe("installing on a Mac", () => {
  it("copies the new app beside the installed one, starts the swap for this process, then quits", async () => {
    const { events, place, plans, updater } = await updaterOf();
    await updater.check(() => void 0);
    await updater.install();
    const parent = join(place.root, "Applications");
    expect(events).toEqual([`stage true ${join(parent, ".Iskios-update.app")}`, "swap", "quit"]);
    expect(plans[0]).toMatchObject({
      backup: join(parent, ".Iskios-previous.app"),
      bundle: place.bundle,
      pid: 4242,
      staged: join(parent, ".Iskios-update.app"),
    });
  });

  it("refuses to install before anything has been downloaded", async () => {
    const { events, updater } = await updaterOf();
    await expect(updater.install()).rejects.toThrow("no downloaded update");
    expect(events).toEqual([]);
  });

  it("does not quit when the new app cannot be prepared", async () => {
    const place = installation();
    const base = await github();
    const events: string[] = [];
    const updater = createMacUpdater({
      appVersion: "0.1.1-Prototype",
      arch: "arm64",
      bundle: place.bundle,
      fetchFn: fetch,
      folder: place.folder,
      pid: 1,
      quit: () => events.push("quit"),
      releasesUrl: `${base}/releases`,
      stage: async () => {
        throw new Error("codesign said no");
      },
      swap: async () => {
        events.push("swap");
      },
    });
    await updater.check(() => void 0);
    await expect(updater.install()).rejects.toThrow("could not be prepared: codesign said no");
    expect(events).toEqual([]);
    expect(existsSync(place.bundle)).toBe(true);
  });
});
