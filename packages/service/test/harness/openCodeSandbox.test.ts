import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "@effect/vitest";
import { afterEach } from "vitest";
import {
  detectOpenCodeSandbox,
  type OpenCodeSandbox,
  openCodeEnvironmentOf,
  ownerMarkerOf,
  sandboxDataHomeOf,
  wrappedCommandOf,
  writableRootsOf,
} from "../../src/harness/openCodeSandbox.ts";
import { copyOpenCodeConfig, seedOpenCodeSignIn } from "../../src/harness/openCodeSeed.ts";
import { hasExecutorBelow, killProcessTree, markedProcessesOf, sweepOrphans } from "../../src/harness/processTree.ts";
import { folderEscapeOf } from "../../src/harness/threadFolder.ts";

const directories: string[] = [];
const temporary = () => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), "iskios-sandbox-")));
  directories.push(directory);
  return directory;
};
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

const seatbelt: OpenCodeSandbox = {
  caches: ["/caches/bun"],
  command: "/usr/bin/sandbox-exec",
  computerConfigHome: "/home/me/.config",
  computerDataHome: "/home/me/.local/share",
  kind: "seatbelt",
  root: "/state/opencode",
};
const bwrap: OpenCodeSandbox = { ...seatbelt, command: "/usr/bin/bwrap", kind: "bwrap" };

const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const waitFor = async (check: () => boolean, millis = 5000) => {
  for (let waited = 0; waited < millis && !check(); waited += 25) await new Promise((r) => setTimeout(r, 25));
  return check();
};

describe("wrapping OpenCode in the host's sandbox", () => {
  it("starts it under Seatbelt with writes only to its workspace, caches, and state, and the network open", () => {
    const wrapped = wrappedCommandOf(seatbelt, ["/work/app", "/caches/bun"], "opencode", ["acp"]);
    expect(wrapped.command).toBe("/usr/bin/sandbox-exec");
    expect(wrapped.args).toEqual([
      "-D",
      "W0=/work/app",
      "-D",
      "W1=/caches/bun",
      "-p",
      expect.any(String),
      "opencode",
      "acp",
    ]);
    const profile = wrapped.args[5] ?? "";
    expect(profile).toContain("(version 1)");
    expect(profile).toContain("(allow default)");
    expect(profile).toContain("(deny file-write*)");
    expect(profile).toContain('(allow file-write* (subpath (param "W0")) (subpath (param "W1"))');
    expect(profile).toContain('(literal "/dev/null")');
    expect(profile).toContain('(literal "/dev/tty")');
    expect(profile).toContain('(regex #"^/dev/(fd|ttys)")');
    expect(profile).not.toContain("network");
  });

  it("starts it under bubblewrap with the system read-only, its folders writable, and the network shared", () => {
    const wrapped = wrappedCommandOf(bwrap, ["/work/app", "/caches/bun"], "opencode", ["acp"]);
    expect(wrapped.command).toBe("/usr/bin/bwrap");
    expect(wrapped.args).toEqual([
      "--ro-bind",
      "/",
      "/",
      "--dev",
      "/dev",
      "--proc",
      "/proc",
      "--tmpfs",
      "/tmp",
      "--bind",
      "/work/app",
      "/work/app",
      "--bind",
      "/caches/bun",
      "/caches/bun",
      "--share-net",
      "--unshare-pid",
      "--die-with-parent",
      "--",
      "opencode",
      "acp",
    ]);
  });

  it("keeps all of OpenCode's folders, its data included, in the service's own folder, one data copy per account", () => {
    const work = openCodeEnvironmentOf(seatbelt, "/accounts/work");
    expect(work).toEqual({
      TMPDIR: "/state/opencode/tmp",
      XDG_CACHE_HOME: "/state/opencode/cache",
      XDG_CONFIG_HOME: "/state/opencode/config",
      XDG_DATA_HOME: sandboxDataHomeOf(seatbelt, "/accounts/work"),
      XDG_STATE_HOME: "/state/opencode/state",
    });
    expect(work.XDG_DATA_HOME.startsWith("/state/opencode/data/")).toBe(true);
    // Never the account's own folder, nor the computer's, which OpenCode runs outside the sandbox read.
    const computer = openCodeEnvironmentOf(seatbelt, null).XDG_DATA_HOME;
    expect(computer).toBe("/state/opencode/data/computer");
    expect([computer, work.XDG_DATA_HOME]).not.toContain("/accounts/work");
    expect(computer).not.toBe(seatbelt.computerDataHome);
    // Accounts do not share a copy.
    expect(sandboxDataHomeOf(seatbelt, "/accounts/home")).not.toBe(work.XDG_DATA_HOME);
  });

  it("lets it write its workspace, the service's folders, its own data copy, and the caches, never the real data", () => {
    const root = temporary();
    const sandbox: OpenCodeSandbox = {
      ...seatbelt,
      caches: [],
      computerDataHome: join(root, "share"),
      root: join(root, "state"),
    };
    const roots = writableRootsOf(sandbox, join(root, "work"), join(root, "accounts", "work"));
    const copy = sandboxDataHomeOf(sandbox, join(root, "accounts", "work"));
    expect(roots).toEqual([
      join(root, "work"),
      join(root, "state", "tmp"),
      join(root, "state", "cache"),
      join(root, "state", "config"),
      join(root, "state", "state"),
      copy,
    ]);
    for (const real of [join(root, "accounts", "work"), join(root, "share"), join(root, "state")])
      expect(roots.some((path) => path === real || real.startsWith(`${path}/`))).toBe(false);
    expect(statSync(copy).mode & 0o777).toBe(0o700);
    expect(writableRootsOf(sandbox, join(root, "work"), null)).toContain(sandboxDataHomeOf(sandbox, null));
  });

  it("never lets a link planted in place of one of its folders widen what it may write", () => {
    const root = temporary();
    const sandbox: OpenCodeSandbox = { ...seatbelt, caches: [], root: join(root, "state") };
    writableRootsOf(sandbox, join(root, "work"), null);
    rmSync(join(root, "state", "tmp"), { recursive: true });
    symlinkSync(root, join(root, "state", "tmp"));
    const roots = writableRootsOf(sandbox, join(root, "work"), null);
    expect(roots).toContain(join(root, "state", "tmp"));
    expect(roots).not.toContain(root);
    expect(lstatSync(join(root, "state", "tmp")).isSymbolicLink()).toBe(false);
  });

  it("gives the sandbox every writable folder by its real path, even when reached through a link", () => {
    const root = temporary();
    mkdirSync(join(root, "real"));
    symlinkSync(join(root, "real"), join(root, "via"));
    mkdirSync(join(root, "cache"));
    symlinkSync(join(root, "cache"), join(root, "cache-link"));
    const sandbox: OpenCodeSandbox = {
      ...seatbelt,
      caches: [join(root, "cache-link")],
      root: join(root, "via", "state"),
    };
    const roots = writableRootsOf(sandbox, join(root, "via", "work"), null);
    expect(roots.length).toBeGreaterThan(0);
    for (const path of roots) {
      expect(realpathSync(path)).toBe(path);
      expect(path.startsWith(join(root, "via"))).toBe(false);
    }
    expect(roots).toContain(join(root, "cache"));
  });

  it("has no sandbox when the host's sandbox cannot run, or its tool is missing", () => {
    expect(
      detectOpenCodeSandbox({ platform: "darwin", root: "/s", sandboxProblem: "Sandbox unavailable." }),
    ).toBeNull();
    expect(detectOpenCodeSandbox({ platform: "win32", root: "/s", sandboxProblem: null })).toBeNull();
    expect(
      detectOpenCodeSandbox({ platform: "linux", root: "/s", sandboxProblem: null, which: () => null }),
    ).toBeNull();
    expect(
      detectOpenCodeSandbox({
        platform: "linux",
        probe: () => true,
        root: "/s",
        sandboxProblem: null,
        which: () => "/usr/bin/bwrap",
      }),
    ).toMatchObject({ command: "/usr/bin/bwrap", kind: "bwrap" });
    expect(
      detectOpenCodeSandbox({
        platform: "linux",
        probe: () => false,
        root: "/s",
        sandboxProblem: null,
        which: () => "/usr/bin/bwrap",
      }),
    ).toBeNull();
  });

  it.skipIf(process.platform !== "darwin")(
    "confines writes on this Mac: inside the roots only, never through a link out",
    () => {
      const root = temporary();
      const inside = join(root, "inside");
      const outside = join(root, "outside");
      mkdirSync(inside);
      mkdirSync(outside);
      symlinkSync(outside, join(inside, "escape"));
      const wrapped = wrappedCommandOf({ ...seatbelt, caches: [] }, [inside], process.execPath, [
        "-e",
        `const fs = require("node:fs");
       const tryWrite = (path) => { try { fs.writeFileSync(path, "x"); return "ok"; } catch (e) { return e.code; } };
       process.stdout.write(JSON.stringify([tryWrite(${JSON.stringify(join(inside, "a"))}),
         tryWrite(${JSON.stringify(join(outside, "b"))}), tryWrite(${JSON.stringify(join(inside, "escape", "c"))})]));`,
      ]);
      const run = spawnSync(wrapped.command, wrapped.args, { encoding: "utf8" });
      expect(JSON.parse(run.stdout)).toEqual(["ok", "EPERM", "EPERM"]);
      expect(existsSync(join(outside, "b"))).toBe(false);
    },
  );
});

describe("checking a thread's folder before sandboxing it there", () => {
  /** A workspace, a scratch root holding one mission's folder, and a folder outside both, by their real paths. */
  const foldersOf = () => {
    const root = temporary();
    for (const folder of ["workspace", "missions/m1", "elsewhere"]) mkdirSync(join(root, folder), { recursive: true });
    return {
      elsewhere: join(root, "elsewhere"),
      root,
      scratch: join(root, "missions", "m1"),
      scratchRoot: join(root, "missions"),
      workspace: join(root, "workspace"),
    };
  };

  it("finds nothing wrong with a plain workspace or scratch folder", () => {
    const { scratch, scratchRoot, workspace } = foldersOf();
    expect(folderEscapeOf(workspace, workspace, true)).toBeNull();
    expect(folderEscapeOf(scratch, scratchRoot, false)).toBeNull();
  });

  it("names a workspace folder that became a link, and where it points", () => {
    const { elsewhere, workspace } = foldersOf();
    rmSync(workspace, { recursive: true });
    symlinkSync(elsewhere, workspace);
    expect(folderEscapeOf(workspace, workspace, true)).toEqual({ folder: workspace, pointsTo: elsewhere });
  });

  it("names a workspace folder reached through a folder that became a link", () => {
    const { elsewhere, root } = foldersOf();
    mkdirSync(join(elsewhere, "project"));
    symlinkSync(elsewhere, join(root, "parent"));
    const stored = join(root, "parent", "project");
    expect(folderEscapeOf(stored, stored, true)).toEqual({ folder: stored, pointsTo: join(elsewhere, "project") });
  });

  it("names a scratch folder linked to the whole disk, outside its root, or even inside it", () => {
    const { elsewhere, scratch, scratchRoot } = foldersOf();
    rmSync(scratch, { recursive: true });
    symlinkSync("/", scratch);
    expect(folderEscapeOf(scratch, scratchRoot, false)).toEqual({ folder: scratch, pointsTo: "/" });
    rmSync(scratch);
    symlinkSync(elsewhere, scratch);
    expect(folderEscapeOf(scratch, scratchRoot, false)).toEqual({ folder: scratch, pointsTo: elsewhere });
    mkdirSync(join(scratchRoot, "m2"));
    rmSync(scratch);
    symlinkSync(join(scratchRoot, "m2"), scratch);
    expect(folderEscapeOf(scratch, scratchRoot, false)).toEqual({ folder: scratch, pointsTo: join(scratchRoot, "m2") });
  });

  it("names a link pointing nowhere by what it names", () => {
    const { root, scratch, scratchRoot } = foldersOf();
    rmSync(scratch, { recursive: true });
    symlinkSync(join(root, "gone"), scratch);
    expect(folderEscapeOf(scratch, scratchRoot, false)).toEqual({ folder: scratch, pointsTo: join(root, "gone") });
  });

  it("names a scratch root that became a link, but not one below a linked system folder", () => {
    const { elsewhere, root, scratchRoot } = foldersOf();
    mkdirSync(join(elsewhere, "missions", "m1"), { recursive: true });
    rmSync(scratchRoot, { recursive: true });
    symlinkSync(join(elsewhere, "missions"), scratchRoot);
    expect(folderEscapeOf(join(scratchRoot, "m1"), scratchRoot, false)).toEqual({
      folder: scratchRoot,
      pointsTo: join(elsewhere, "missions"),
    });
    // The service's own data folder may sit below a linked folder of the system, such as /var on macOS.
    symlinkSync(elsewhere, join(root, "system"));
    const below = join(root, "system", "missions");
    expect(folderEscapeOf(join(below, "m1"), below, false)).toBeNull();
  });
});

describe("ending a harness's whole process tree", () => {
  it("kills a child that left its process group, and reports none left", async () => {
    const directory = temporary();
    const pidFile = join(directory, "grandchild");
    const parent = spawn(process.execPath, [
      "-e",
      `const { spawn } = require("node:child_process");
       const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { detached: true, stdio: "ignore" });
       require("node:fs").writeFileSync(${JSON.stringify(pidFile)}, String(child.pid));
       setInterval(() => {}, 1000);`,
    ]);
    for (let i = 0; i < 100 && !existsSync(pidFile); i++) await new Promise((r) => setTimeout(r, 20));
    const grandchild = Number(readFileSync(pidFile, "utf8"));
    const isAlive = (pid: number) => {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    };
    expect(isAlive(grandchild)).toBe(true);
    expect(await killProcessTree(parent.pid ?? -1)).toEqual([]);
    expect(isAlive(grandchild)).toBe(false);
  });
});

describe("confirming that OpenCode's executor runs below the wrapped process", () => {
  const withChild = async (args: Array<string>, check: (parent: number) => void) => {
    const pidFile = join(temporary(), "child");
    const parent = spawn(process.execPath, [
      "-e",
      `const { spawn } = require("node:child_process");
       const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)", ...${JSON.stringify(args)}], { stdio: "ignore" });
       require("node:fs").writeFileSync(${JSON.stringify(pidFile)}, String(child.pid));
       setInterval(() => {}, 1000);`,
    ]);
    try {
      for (let i = 0; i < 100 && !existsSync(pidFile); i++) await new Promise((r) => setTimeout(r, 20));
      check(parent.pid ?? -1);
    } finally {
      await killProcessTree(parent.pid ?? -1);
    }
  };

  it("sees a `serve --stdio` descendant", async () => {
    await withChild(["serve", "--stdio", "--port", "0"], (parent) => expect(hasExecutorBelow(parent)).toBe(true));
  });

  it("does not take the background service (`serve --service`) or other children for the executor", async () => {
    await withChild(["serve", "--service"], (parent) => expect(hasExecutorBelow(parent)).toBe(false));
    await withChild([], (parent) => expect(hasExecutorBelow(parent)).toBe(false));
  });

  it("confirms nothing for a process that does not exist", () => {
    expect(hasExecutorBelow(2 ** 22 + 12345)).toBe(false);
  });
});

const standIn = [join(import.meta.dirname, "..", "fixtures", "stand-in-opencode.mjs")];
const credentialTable =
  "CREATE TABLE IF NOT EXISTS credential (id TEXT PRIMARY KEY, integration_id TEXT, label TEXT NOT NULL, value TEXT NOT NULL, active INTEGER)";
/** OpenCode's credential store in a data folder, as OpenCode 2.2.0 keeps it (its database's `credential` table). */
const storeOf = (dataHome: string) => {
  mkdirSync(join(dataHome, "opencode"), { recursive: true });
  const database = new DatabaseSync(join(dataHome, "opencode", "opencode.db"));
  database.exec(credentialTable);
  return database;
};
const putCredential = (dataHome: string, id: string, integration: string, value: object) => {
  const database = storeOf(dataHome);
  database
    .prepare("INSERT OR REPLACE INTO credential (id, integration_id, label, value, active) VALUES (?, ?, ?, ?, 1)")
    .run(id, integration, "Key", JSON.stringify(value));
  database.close();
};
const credentialsOf = (dataHome: string) => {
  const database = storeOf(dataHome);
  const rows = database.prepare("SELECT id, integration_id, value FROM credential ORDER BY id").all();
  database.close();
  return rows.map((row) => ({ ...row }));
};
/** Every file below a folder, by its path from there. */
const filesOf = (folder: string): Array<string> =>
  existsSync(folder)
    ? spawnSync("find", [folder, "-type", "f"], { encoding: "utf8" })
        .stdout.split("\n")
        .filter((line) => line !== "")
        .map((line) => line.slice(folder.length + 1))
        .sort()
    : [];

describe.skipIf(process.platform !== "darwin")("seeding a sandboxed OpenCode's own data copy on this Mac", () => {
  const setup = () => {
    const root = temporary();
    const sandbox: OpenCodeSandbox = {
      caches: [],
      command: "/usr/bin/sandbox-exec",
      computerConfigHome: join(root, "config"),
      computerDataHome: join(root, "share"),
      kind: "seatbelt",
      root: join(root, "service", "opencode-sandbox"),
    };
    const run = (accountDataHome: string | null) => ({
      accountDataHome,
      command: process.execPath,
      environment: {},
      prefixArgs: standIn,
      sandbox,
    });
    return { root, run, sandbox };
  };

  it("copies the sign-in into the account's copy, and none of the data folder's files, executables included", async () => {
    const { root, run, sandbox } = setup();
    const real = join(root, "share");
    putCredential(real, "cred_1", "opencode-go", { key: "dummy-key", type: "key" });
    putCredential(real, "cred_2", "anthropic", { access: "a", expires: 1, refresh: "r", type: "oauth" });
    for (const planted of ["bin/rg", "plugins/evil.js", "plugin/evil.ts", "auth.json"]) {
      mkdirSync(join(real, "opencode", planted, ".."), { recursive: true });
      writeFileSync(join(real, "opencode", planted), "#!/bin/sh\necho planted\n");
    }
    const before = filesOf(join(real, "opencode"));
    await seedOpenCodeSignIn(run(null));
    const copy = sandboxDataHomeOf(sandbox, null);
    expect(credentialsOf(copy)).toEqual(credentialsOf(real));
    expect(filesOf(join(copy, "opencode"))).toEqual(["opencode.db"]);
    expect(filesOf(join(real, "opencode"))).toEqual(before);
  });

  it("seeds again at each start, so a revoked or changed sign-in follows, and never writes back", async () => {
    const { root, run, sandbox } = setup();
    const real = join(root, "share");
    putCredential(real, "cred_1", "opencode-go", { key: "old", type: "key" });
    putCredential(real, "cred_2", "anthropic", { key: "revoked", type: "key" });
    await seedOpenCodeSignIn(run(null));
    const copy = sandboxDataHomeOf(sandbox, null);
    // A sign-in written in the copy stays there.
    putCredential(copy, "cred_9", "xai", { key: "made inside", type: "key" });
    const database = storeOf(real);
    database.prepare("DELETE FROM credential WHERE id = 'cred_2'").run();
    database.close();
    putCredential(real, "cred_1", "opencode-go", { key: "new", type: "key" });
    putCredential(real, "cred_3", "github-copilot", { key: "added", type: "key" });
    const realNow = credentialsOf(real);
    await seedOpenCodeSignIn(run(null));
    expect(credentialsOf(copy)).toEqual(realNow);
    expect(credentialsOf(real)).toEqual(realNow);
  });

  it("keeps each account's copy apart, seeded from that account's own folder", async () => {
    const { root, run, sandbox } = setup();
    const work = join(root, "accounts", "work");
    putCredential(join(root, "share"), "cred_1", "opencode-go", { key: "computer", type: "key" });
    putCredential(work, "cred_7", "opencode-go", { key: "work", type: "key" });
    await seedOpenCodeSignIn(run(work));
    await seedOpenCodeSignIn(run(null));
    expect(credentialsOf(sandboxDataHomeOf(sandbox, work))).toEqual(credentialsOf(work));
    expect(credentialsOf(sandboxDataHomeOf(sandbox, null))).toEqual(credentialsOf(join(root, "share")));
  });

  it("copies the owner's configuration read-only, without plugins, tools, or packages, and never writes back", async () => {
    const { root, run, sandbox } = setup();
    const owner = join(root, "config", "opencode");
    const files: Record<string, string> = {
      "AGENTS.md": "Be brief.",
      "agents/review.md": "Review agent",
      "commands/ship.md": "Ship it",
      "node_modules/pkg/index.js": "module.exports = 1",
      "opencode.json": '{"model":"provider/model-a"}',
      "opencode.jsonc": "// mine\n{}",
      "package.json": "{}",
      "plugin/old.ts": "export default {}",
      "plugins/notify.js": "export default {}",
      "service.json": '{"port":1}',
      "tools/run.ts": "export default {}",
    };
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(join(owner, path, ".."), { recursive: true });
      writeFileSync(join(owner, path), text);
    }
    const ownerBefore = filesOf(owner);
    // A plugin planted in the sandbox's configuration by an earlier thread.
    const copy = join(sandbox.root, "config", "opencode");
    mkdirSync(join(copy, "plugins"), { recursive: true });
    writeFileSync(join(copy, "plugins", "planted.js"), "export default {}");
    await copyOpenCodeConfig(run(null));
    expect(filesOf(copy)).toEqual([
      "AGENTS.md",
      "agents/review.md",
      "commands/ship.md",
      "opencode.json",
      "opencode.jsonc",
    ]);
    for (const path of filesOf(copy)) {
      expect(readFileSync(join(copy, path), "utf8")).toBe(files[path]);
      expect(statSync(join(copy, path)).mode & 0o777).toBe(0o444);
    }
    writeFileSync(join(owner, "opencode.json"), '{"model":"provider/plain"}');
    await copyOpenCodeConfig(run(null));
    expect(readFileSync(join(copy, "opencode.json"), "utf8")).toBe('{"model":"provider/plain"}');
    expect(filesOf(owner)).toEqual(ownerBefore);
  });

  it("lets the wrapped process write its data copy, and not the real data folder", () => {
    const { root, sandbox } = setup();
    const real = join(root, "share", "opencode");
    mkdirSync(real, { recursive: true });
    const roots = writableRootsOf(sandbox, join(root, "work"), null);
    const copy = join(sandboxDataHomeOf(sandbox, null), "opencode");
    const wrapped = wrappedCommandOf(sandbox, roots, process.execPath, [
      "-e",
      `const fs = require("node:fs");
       const tryWrite = (path) => { try { fs.mkdirSync(require("node:path").dirname(path), { recursive: true }); fs.writeFileSync(path, "x"); return "ok"; } catch (e) { return e.code; } };
       process.stdout.write(JSON.stringify([tryWrite(${JSON.stringify(join(copy, "bin", "rg"))}),
         tryWrite(${JSON.stringify(join(real, "bin", "rg"))}), tryWrite(${JSON.stringify(join(sandbox.root, "owner"))})]));`,
    ]);
    const ran = spawnSync(wrapped.command, wrapped.args, { encoding: "utf8" });
    expect(JSON.parse(ran.stdout)).toEqual(["ok", "EPERM", "EPERM"]);
    expect(existsSync(join(real, "bin", "rg"))).toBe(false);
  });
});

describe("ending the OpenCode processes the service lost", () => {
  /** Starts a parent that starts a child of its own, in its own group, then ends: the child is an orphan. */
  const orphanOf = async (env: Record<string, string>, childArgs: Array<string>) => {
    const pidFile = join(temporary(), "orphan");
    const parent = spawn(
      process.execPath,
      [
        "-e",
        `const { spawn } = require("node:child_process");
         const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)", ...${JSON.stringify(childArgs)}], { detached: true, stdio: "ignore" });
         require("node:fs").writeFileSync(${JSON.stringify(pidFile)}, String(child.pid));
         process.exit(0);`,
      ],
      { env: { ...process.env, ...env }, stdio: "ignore" },
    );
    await waitFor(() => existsSync(pidFile) && parent.exitCode !== null);
    return Number(readFileSync(pidFile, "utf8"));
  };

  it("finds an executor that outlived its `acp` by its marker, and ends it, never an unmarked or living one", async () => {
    const marker = { name: "ISKIOS_SANDBOX_OWNER", value: crypto.randomUUID() };
    const markedEnv = { [marker.name]: marker.value };
    const started: Array<number> = [];
    try {
      const executor = await orphanOf(markedEnv, ["serve", "--stdio", "--port", "0"]);
      const unmarked = await orphanOf({}, ["serve", "--stdio", "--port", "0"]);
      const otherMarker = await orphanOf({ [marker.name]: `${marker.value}-other` }, ["serve", "--stdio"]);
      const notOpenCode = await orphanOf(markedEnv, ["watch"]);
      started.push(executor, unmarked, otherMarker, notOpenCode);
      // A marked executor still below this process belongs to a living thread.
      const living = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)", "serve", "--stdio"], {
        env: { ...process.env, ...markedEnv },
        stdio: "ignore",
      });
      started.push(living.pid ?? -1);
      expect(markedProcessesOf(marker).map((found) => found.pid)).toEqual(
        expect.arrayContaining([executor, notOpenCode, living.pid]),
      );
      expect(await sweepOrphans(marker)).toEqual([]);
      expect(await waitFor(() => !isAlive(executor))).toBe(true);
      for (const pid of [unmarked, otherMarker, notOpenCode, living.pid ?? -1]) expect(isAlive(pid)).toBe(true);
    } finally {
      for (const pid of started) if (pid > 0 && isAlive(pid)) process.kill(pid, "SIGKILL");
    }
  });

  it("reads the marker from the environment only, never from a command's arguments", async () => {
    const marker = { name: "ISKIOS_SANDBOX_OWNER", value: crypto.randomUUID() };
    const posing = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)", `${marker.name}=${marker.value}`], {
      stdio: "ignore",
    });
    try {
      await waitFor(() => false, 200);
      expect(markedProcessesOf(marker)).toEqual([]);
    } finally {
      posing.kill("SIGKILL");
    }
  });

  it("keeps one marker per service folder, outside what the sandbox may write", () => {
    const root = temporary();
    const sandbox: OpenCodeSandbox = { ...seatbelt, caches: [], root: join(root, "opencode-sandbox") };
    const marker = ownerMarkerOf(sandbox);
    expect(marker.name).toBe("ISKIOS_SANDBOX_OWNER");
    expect(marker.value).toMatch(/^[0-9a-f-]{36}$/);
    expect(ownerMarkerOf(sandbox)).toEqual(marker);
    expect(ownerMarkerOf({ ...sandbox, root: join(root, "other") }).value).not.toBe(marker.value);
    const roots = writableRootsOf(sandbox, join(root, "work"), null);
    expect(roots.some((path) => join(sandbox.root, "owner").startsWith(`${path}/`))).toBe(false);
  });
});
