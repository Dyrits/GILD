import { spawn } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { accountEnvironmentOf } from "./harnessCatalog.ts";
import { harnessEnvironmentOf } from "./lineProcess.ts";
import {
  type OpenCodeSandbox,
  openCodeEnvironmentOf,
  realDataHomeOf,
  sandboxDataHomeOf,
  wrappedCommandOf,
  writableRootsOf,
} from "./openCodeSandbox.ts";
import { killProcessTree } from "./processTree.ts";

// What a sandboxed OpenCode starts with (CHG-0208): the account's sign-in and the owner's configuration, copied one
// way from the real folders at each start, so a changed or revoked sign-in follows and nothing flows back.
//
// OpenCode 2.2.0 keeps sign-ins in its database (`opencode.db`, table `credential`); its `auth.json` is only imported
// by an old upgrade step, which a new database skips (probed 2026-11-12). So the sign-in is copied with OpenCode's own
// `auth export` from the real folder and `auth import` into the copy, and a copied sign-in the real folder no longer
// has, or has changed, is removed first with `auth logout`. No file of the real data folder is copied: no executables,
// plugins, sessions or caches. Every command that writes the copy runs inside the sandbox, so a link planted there
// cannot turn the write elsewhere; only the export, which reads the real folder, runs outside it, as the owner's own
// OpenCode does. `--standalone` keeps each from reaching OpenCode's background service.

/** How the seeding commands run: the sandbox, OpenCode's command, the account, and the marker to carry. */
export interface SeedRun {
  readonly accountDataHome: string | null;
  readonly command: string;
  /** Variables every sandboxed process carries, such as the service's marker (processTree.ts sweepOrphans). */
  readonly environment: Record<string, string>;
  readonly prefixArgs: ReadonlyArray<string>;
  readonly sandbox: OpenCodeSandbox;
}

interface Ran {
  readonly code: number | null;
  readonly stderr: string;
  readonly stdout: string;
}

/** Runs one short command to its end, with its own process group so a timeout ends all it started. */
const runOnce = (
  command: string,
  args: ReadonlyArray<string>,
  env: Record<string, string | undefined>,
  cwd: string,
  input = "",
  timeoutMillis = 30_000,
) =>
  new Promise<Ran>((resolve) => {
    const child = spawn(command, [...args], { cwd, detached: true, env, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      if (child.pid !== undefined) void killProcessTree(child.pid, 1000, true);
    }, timeoutMillis);
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-2000);
    });
    child.stdin.on("error", () => void 0);
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: null, stderr: error.message, stdout });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stderr, stdout });
    });
    child.stdin.end(input);
  });

/** One sign-in as `opencode auth export` prints it; only its id and integration are read, and whether it changed. */
interface Exported {
  readonly id: string;
  readonly integrationID: string;
  /** The whole entry as printed, compared with the copy's to find a changed sign-in. */
  readonly text: string;
}

const exportedOf = (stdout: string, where: string): Array<Exported> => {
  let entries: unknown;
  try {
    entries = JSON.parse(stdout);
  } catch {
    throw new Error(`OpenCode listed the sign-ins of ${where} in a form Iskios does not read.`);
  }
  if (!Array.isArray(entries)) throw new Error(`OpenCode listed no sign-ins of ${where}.`);
  return entries.flatMap((entry: unknown) => {
    const { id, integrationID } = (entry ?? {}) as { id?: unknown; integrationID?: unknown };
    return typeof id === "string" && typeof integrationID === "string"
      ? [{ id, integrationID, text: JSON.stringify(entry) }]
      : [];
  });
};

/** What a failed command said, for the owner: its error output, never its standard output, which holds secrets. */
const failureOf = (step: string, ran: Ran) =>
  new Error(`OpenCode could not ${step}: ${ran.stderr.trim() || `exit code ${ran.code ?? "none"}`}`);

/** The wrapped form of a command for the account's copy, and the environment it runs with. */
const sandboxedOf = (run: SeedRun) => {
  const cwd = join(run.sandbox.root, "tmp");
  const roots = writableRootsOf(run.sandbox, cwd, run.accountDataHome);
  const env = harnessEnvironmentOf({ ...openCodeEnvironmentOf(run.sandbox, run.accountDataHome), ...run.environment });
  return {
    cwd,
    run: (command: string, args: ReadonlyArray<string>, input = "") => {
      const wrapped = wrappedCommandOf(run.sandbox, roots, command, args);
      return runOnce(wrapped.command, wrapped.args, env, cwd, input);
    },
  };
};

/**
 * Makes the account's data copy hold exactly the sign-ins of its real data folder: those it lacks are imported, and
 * those the real folder no longer has, or has changed, are removed first. The real folder is only read.
 */
export const seedOpenCodeSignIn = async (run: SeedRun) => {
  const sandboxed = sandboxedOf(run);
  const exportArgs = [...run.prefixArgs, "auth", "export", "--standalone"];
  const realEnv = harnessEnvironmentOf({
    ...accountEnvironmentOf("opencode", run.accountDataHome),
    XDG_DATA_HOME: realDataHomeOf(run.sandbox, run.accountDataHome),
  });
  const real = await runOnce(run.command, exportArgs, realEnv, sandboxed.cwd);
  if (real.code !== 0) throw failureOf("read the account's sign-in", real);
  const copied = await sandboxed.run(run.command, exportArgs);
  if (copied.code !== 0) throw failureOf("read the sandbox's copy of the sign-in", copied);
  const wanted = exportedOf(real.stdout, "the account");
  const wantedTexts = new Set(wanted.map((entry) => entry.text));
  const present = exportedOf(copied.stdout, "the sandbox's copy");
  const stale = present.filter((entry) => !wantedTexts.has(entry.text));
  for (const entry of stale) {
    const removed = await sandboxed.run(run.command, [
      ...run.prefixArgs,
      "auth",
      "logout",
      "--standalone",
      entry.integrationID,
      entry.id,
    ]);
    if (removed.code !== 0) throw failureOf("remove a sign-in the account no longer has from its copy", removed);
  }
  const kept = new Set(present.filter((entry) => wantedTexts.has(entry.text)).map((entry) => entry.id));
  if (wanted.every((entry) => kept.has(entry.id))) return;
  const imported = await sandboxed.run(run.command, [...run.prefixArgs, "auth", "import", "--standalone"], real.stdout);
  if (imported.code !== 0) throw failureOf("copy the account's sign-in into its sandbox", imported);
};

/** The owner's configuration files OpenCode 2.2.0 reads from its configuration folder, copied as they are. */
const configFiles = ["opencode.json", "opencode.jsonc", "config.json", "AGENTS.md"];

/**
 * The folders of Markdown definitions OpenCode 2.2.0 reads there (`{agent,agents}/**`, `{command,commands}/**`,
 * `{mode,modes}/*`). Its `plugin`/`plugins` and `tool`/`tools` folders hold code it runs, and `node_modules`,
 * `package.json` and `service.json` code or its background service's settings: none is copied.
 */
const definitionFolders = ["agent", "agents", "command", "commands", "mode", "modes"];

/** Entries the copy drops at each start, so nothing an earlier sandboxed run left there stays. */
const droppedEntries = [...configFiles, ...definitionFolders, "plugin", "plugins", "tool", "tools", "service.json"];

/** The Markdown files below a folder, following the owner's links, by their path from `base`; at most 500. */
const markdownBelow = (folder: string, base: string, found: Array<string> = [], depth = 0) => {
  if (depth > 8 || found.length >= 500) return found;
  for (const name of readdirSync(folder)) {
    const path = join(folder, name);
    const stat = statSync(path, { throwIfNoEntry: false });
    if (stat?.isDirectory()) markdownBelow(path, base, found, depth + 1);
    else if (stat?.isFile() && name.endsWith(".md") && found.length < 500) found.push(relative(base, path));
  }
  return found;
};

/** Copies files into a folder from inside the sandbox, read-only; the named entries are removed first. */
const copyScript = [
  "set -e",
  'dest=$1; shift; [ -n "$dest" ]; mkdir -p -- "$dest"',
  'while [ "$1" != "--" ]; do rm -rf -- "$dest/$1"; shift; done; shift',
  'while [ $# -gt 0 ]; do mkdir -p -- "$(dirname -- "$dest/$2")"; cp -- "$1" "$dest/$2"; chmod 0444 "$dest/$2"; shift 2; done',
].join("\n");

/**
 * Copies the owner's OpenCode configuration into the sandbox's configuration folder, read-only, at each start: its
 * settings and Markdown definitions apply inside the sandbox, never its plugins or tools, and nothing is written back.
 * An added account uses the same configuration, as OpenCode does (harnessCatalog.ts: an account only moves its data).
 */
export const copyOpenCodeConfig = async (run: SeedRun) => {
  const source = join(run.sandbox.computerConfigHome, "opencode");
  const files = !existsSync(source)
    ? []
    : [
        ...configFiles.filter((name) => statSync(join(source, name), { throwIfNoEntry: false })?.isFile() === true),
        ...definitionFolders.flatMap((name) =>
          statSync(join(source, name), { throwIfNoEntry: false })?.isDirectory() === true
            ? markdownBelow(join(source, name), source)
            : [],
        ),
      ];
  const sandboxed = sandboxedOf(run);
  const copied = await sandboxed.run("/bin/sh", [
    "-c",
    copyScript,
    "sh",
    join(run.sandbox.root, "config", "opencode"),
    ...droppedEntries,
    "--",
    ...files.flatMap((file) => [join(source, file), file]),
  ]);
  if (copied.code !== 0) throw failureOf("copy the owner's configuration into its sandbox", copied);
};

/** The account's sign-in and the owner's configuration, made ready in the sandbox before a wrapped OpenCode starts. */
export const prepareOpenCodeSandbox = async (run: SeedRun) => {
  await copyOpenCodeConfig(run);
  await seedOpenCodeSignIn(run);
  return sandboxDataHomeOf(run.sandbox, run.accountDataHome);
};
