import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// OpenCode has no sandbox of its own, so Iskios starts `opencode acp` inside the host's (CHG-0208): Seatbelt through
// `sandbox-exec` on macOS, bubblewrap on Linux. Writes are allowed only to the thread's folder, the package caches, and
// the service's own folders for OpenCode's state, configuration, cache, temporary files and data; the network stays
// open. Every process OpenCode starts, its `serve` child and the commands it runs, inherits the sandbox. Its data folder
// (sign-ins, sessions) is a copy per account, seeded from the account's real one at each start (openCodeSeed.ts) and
// read by no OpenCode run outside the sandbox: the real data folder, which the owner's own OpenCode and Iskios's probes
// read, is never writable from inside, so nothing planted there runs outside the sandbox.

/** How OpenCode is wrapped on this host. */
export interface OpenCodeSandbox {
  /** Folders commands may also write, such as package caches. */
  readonly caches: ReadonlyArray<string>;
  /** The sandbox tool: `/usr/bin/sandbox-exec` or `bwrap`. */
  readonly command: string;
  /** The folder holding the owner's own OpenCode configuration (`$XDG_CONFIG_HOME`), copied read-only at each start. */
  readonly computerConfigHome: string;
  /** The folder holding OpenCode's own data on this computer (`$XDG_DATA_HOME`): the "This computer" account's. */
  readonly computerDataHome: string;
  readonly kind: "seatbelt" | "bwrap";
  /**
   * The service's folder for OpenCode's state, configuration, cache, temporary files and data copies, each in a folder
   * of its own; the folder itself, holding the process marker, is not writable from inside.
   */
  readonly root: string;
}

/** The package caches a wrapped OpenCode's commands may write, as the Claude Code sandbox allows them (claudeArgs.ts). */
export const packageCachesOf = (home: string) => [
  join(home, ".bun", "install", "cache"),
  join(home, ".npm"),
  join(home, "Library", "Caches", "electron"),
  join(home, ".cache", "electron"),
];

const whichOf = (name: string) => {
  try {
    return execFileSync("which", [name], { encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
};

/** Whether the sandbox tool starts a trivial command, so a broken one counts as missing. */
const probeOf = (command: string, args: ReadonlyArray<string>) => {
  try {
    return spawnSync(command, [...args], { stdio: "ignore", timeout: 5000 }).status === 0;
  } catch {
    return false;
  }
};

/**
 * The sandbox OpenCode runs in here, or null when none can: then every action OpenCode asks about asks the owner, as
 * before. The host's sandbox problem (core/sandbox.ts) counts too, so the harnesses agree on whether one runs.
 */
export const detectOpenCodeSandbox = (host: {
  readonly platform: NodeJS.Platform;
  readonly root: string;
  readonly sandboxProblem: string | null;
  readonly caches?: ReadonlyArray<string>;
  readonly which?: (name: string) => string | null;
  readonly probe?: (command: string, args: ReadonlyArray<string>) => boolean;
}): OpenCodeSandbox | null => {
  if (host.sandboxProblem !== null) return null;
  const facts = {
    caches: host.caches ?? packageCachesOf(homedir()),
    computerConfigHome: process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"),
    computerDataHome: process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"),
    root: host.root,
  };
  const probe = host.probe ?? probeOf;
  if (host.platform === "darwin") {
    const command = "/usr/bin/sandbox-exec";
    if (!existsSync(command) || !probe(command, ["-p", "(version 1)(allow default)", "/usr/bin/true"])) return null;
    return { ...facts, command, kind: "seatbelt" };
  }
  if (host.platform === "linux") {
    const command = (host.which ?? whichOf)("bwrap");
    if (command === null || !probe(command, ["--ro-bind", "/", "/", "--", "/bin/true"])) return null;
    return { ...facts, command, kind: "bwrap" };
  }
  return null;
};

/** The service's own folders a wrapped OpenCode writes, besides its data copies. */
const sharedParts = ["tmp", "cache", "config", "state"] as const;

/** The folder of the account's data copy below the sandbox's: "computer", or one named after the account's folder. */
const accountPartOf = (accountDataHome: string | null) =>
  accountDataHome === null
    ? "computer"
    : `account-${createHash("sha256").update(accountDataHome).digest("hex").slice(0, 16)}`;

/** The account's own data copy a wrapped OpenCode reads and writes as its `$XDG_DATA_HOME`, never its real one. */
export const sandboxDataHomeOf = (sandbox: OpenCodeSandbox, accountDataHome: string | null) =>
  join(sandbox.root, "data", accountPartOf(accountDataHome));

/** The account's real data folder (`$XDG_DATA_HOME`): its own folder, or OpenCode's own for this computer. */
export const realDataHomeOf = (sandbox: OpenCodeSandbox, accountDataHome: string | null) =>
  accountDataHome ?? sandbox.computerDataHome;

/** The environment a wrapped OpenCode starts with: every folder it writes in the service's folder. */
export const openCodeEnvironmentOf = (sandbox: OpenCodeSandbox, accountDataHome: string | null) => ({
  TMPDIR: join(sandbox.root, "tmp"),
  XDG_CACHE_HOME: join(sandbox.root, "cache"),
  XDG_CONFIG_HOME: join(sandbox.root, "config"),
  XDG_DATA_HOME: sandboxDataHomeOf(sandbox, accountDataHome),
  XDG_STATE_HOME: join(sandbox.root, "state"),
});

/** A folder made if missing, by its real path, which Seatbelt matches (`/var` is `/private/var` on macOS). */
const realFolder = (path: string) => {
  mkdirSync(path, { recursive: true });
  return realpathSync(path);
};

/**
 * One of the service's own folders below the sandbox's, made if missing and a plain folder all the way down: anything
 * else in its place, such as a link a sandboxed process planted to widen what the next start may write, is removed
 * first. Returned by its real path, checked to be where it should be.
 */
const ownedFolder = (root: string, parts: ReadonlyArray<string>, mode = 0o755) => {
  let path = realFolder(root);
  for (const part of parts) {
    path = join(path, part);
    const found = lstatSync(path, { throwIfNoEntry: false });
    if (found !== undefined && !found.isDirectory()) rmSync(path, { force: true });
    if (found === undefined || !found.isDirectory()) mkdirSync(path, { mode });
  }
  if (realpathSync(path) !== path) throw new Error(`OpenCode's sandbox folder ${path} is not where it should be.`);
  return path;
};

/**
 * The folders a wrapped OpenCode may write: the thread's folder, the service's own folders and the account's data copy
 * (only the owner may read it), and the caches. Never the account's real data folder, nor the service's folder itself.
 */
export const writableRootsOf = (sandbox: OpenCodeSandbox, cwd: string, accountDataHome: string | null) => [
  realFolder(cwd),
  ...sharedParts.map((part) => ownedFolder(sandbox.root, [part])),
  ownedFolder(sandbox.root, ["data", accountPartOf(accountDataHome)], 0o700),
  ...sandbox.caches.filter((cache) => existsSync(cache)).map((cache) => realpathSync(cache)),
];

/**
 * The marker every sandboxed OpenCode process the service starts carries in its environment, inherited by all it
 * starts (processTree.ts sweepOrphans): a random id kept in the service's folder, which the sandbox cannot write.
 */
export const ownerMarkerOf = (sandbox: OpenCodeSandbox) => {
  const path = join(realFolder(sandbox.root), "owner");
  if (!existsSync(path)) {
    try {
      writeFileSync(path, randomUUID(), { flag: "wx", mode: 0o600 });
    } catch {
      // Made meanwhile by another start.
    }
  }
  return { name: "ISKIOS_SANDBOX_OWNER", value: readFileSync(path, "utf8").trim() };
};

/**
 * The Seatbelt profile: everything allowed but writing, which only the given folders and the terminal devices may, and
 * signalling, which only the processes of the sandbox itself may receive. Bubblewrap's own PID namespace already hides
 * outside processes. `(target others)` blocks nothing on macOS, and `(target self)` also stops the sandbox's children,
 * so the rule names the sandbox.
 *
 * Outside processes are hidden too (audit SA-11, SA-13): the service holds the owner token in its environment and each
 * thread's harness its tool server address in its arguments or environment, which a command here could otherwise read.
 * The process rules hide the process list and what `lsof` maps a port to, and the `kern.procargs` rule the arguments and
 * environment of a process named by its pid, which the process rules alone let through (probe of 2026-11-14,
 * documentation/verification/2026-11-14-token-isolation.md). Claude Code's and Codex's own sandboxes already allow
 * process information only within themselves.
 */
const seatbeltProfileOf = (count: number) =>
  [
    "(version 1)",
    "(allow default)",
    "(deny process-info*)",
    "(allow process-info* (target same-sandbox))",
    '(deny sysctl-read (sysctl-name-prefix "kern.procargs"))',
    "(deny signal)",
    "(allow signal (target same-sandbox))",
    "(deny file-write*)",
    `(allow file-write* ${Array.from({ length: count }, (_, index) => `(subpath (param "W${index}"))`).join(" ")} (literal "/dev/null") (literal "/dev/tty") (regex #"^/dev/(fd|ttys)"))`,
  ].join("\n");

/** The command line that starts `command` inside the sandbox, writing only to the given folders. */
export const wrappedCommandOf = (
  sandbox: OpenCodeSandbox,
  writable: ReadonlyArray<string>,
  command: string,
  args: ReadonlyArray<string>,
) =>
  sandbox.kind === "seatbelt"
    ? {
        args: [
          // Paths go in as parameters, so no path needs quoting inside the profile.
          ...writable.flatMap((path, index) => ["-D", `W${index}=${path}`]),
          "-p",
          seatbeltProfileOf(writable.length),
          command,
          ...args,
        ],
        command: sandbox.command,
      }
    : {
        args: [
          "--ro-bind",
          "/",
          "/",
          "--dev",
          "/dev",
          "--proc",
          "/proc",
          "--tmpfs",
          "/tmp",
          ...writable.flatMap((path) => ["--bind", path, path]),
          "--share-net",
          "--unshare-pid",
          "--die-with-parent",
          "--",
          command,
          ...args,
        ],
        command: sandbox.command,
      };
