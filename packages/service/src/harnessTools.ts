import { execFile } from "node:child_process";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HarnessName, ModelOption, SignInState } from "@openmission/contracts";
import { Clock, Context, Effect, Layer, Queue } from "effect";
import { harnessEnvironmentOf } from "./claude.ts";
import { invalid, type ServiceFailure } from "./errors.ts";
import { accountEnvironmentOf, claudeModels, configVariables, defaultModel, harnessLabels } from "./harnessCatalog.ts";
import { fieldOf, startRpcProcess, textFieldOf } from "./rpcProcess.ts";

// What OpenMission asks each harness's own command-line tool about itself: its version, who is signed in,
// and its models; and how the owner signs in, always through the tool's own sign-in (requirements, Comply
// with provider terms). OpenMission never reads or stores the credentials.

/** Who a harness says is signed in to one account's folder. */
export interface SignInStatus {
  readonly detail: string | null;
  readonly signIn: SignInState;
}

/** A harness's installed version, or why it cannot run. */
export interface Installation {
  readonly problem: string | null;
  readonly version: string | null;
}

/** The seam to the harnesses' own tools for everything but turns. */
export class HarnessTools extends Context.Service<
  HarnessTools,
  {
    readonly inspect: (harness: HarnessName) => Effect.Effect<Installation>;
    readonly listModels: (
      harness: HarnessName,
      configDirectory: string | null,
    ) => Effect.Effect<ReadonlyArray<ModelOption>>;
    /** Opens the harness's own sign-in in a terminal window, pointed at the account's folder. */
    readonly openSignIn: (harness: HarnessName, configDirectory: string | null) => Effect.Effect<void, ServiceFailure>;
    readonly readSignIn: (harness: HarnessName, configDirectory: string | null) => Effect.Effect<SignInStatus>;
  }
>()("openmission/HarnessTools") {}

export type HarnessCommands = Record<HarnessName, string>;

interface Run {
  readonly code: number | null;
  /** What the command printed on both streams; Codex prints its login status on standard error. */
  readonly output: string;
  readonly stdout: string;
}

/** Runs a short command of the harness's tool; a missing tool or a timeout reads as exit code null. */
const run = (command: string, args: ReadonlyArray<string>, env: Record<string, string>) =>
  Effect.callback<Run>((resume) => {
    execFile(
      command,
      [...args],
      { env: harnessEnvironmentOf(env), maxBuffer: 4_000_000, timeout: 20_000 },
      (error, stdout, stderr) => {
        const code = error === null ? 0 : typeof error.code === "number" ? error.code : null;
        resume(Effect.succeed({ code, output: `${stdout}\n${stderr}`, stdout: String(stdout) }));
      },
    );
  });

/** Single-quoted for a POSIX shell. */
const quoted = (text: string) => `'${text.replaceAll("'", "'\\''")}'`;

/** Each harness's own sign-in command. */
const signInArgs = {
  claude: ["auth", "login"],
  codex: ["login"],
  opencode: ["auth", "login"],
} as const satisfies Record<HarnessName, ReadonlyArray<string>>;

/** How long a model list is reused before the harness is asked again. */
const modelsLifetimeMillis = 10 * 60 * 1000;

/** Codex's models, read from its app server's own list. */
const listCodexModels = (command: string, configDirectory: string | null) =>
  Effect.gen(function* () {
    const rpc = yield* startRpcProcess({
      args: ["app-server"],
      command,
      cwd: tmpdir(),
      env: harnessEnvironmentOf(accountEnvironmentOf("codex", configDirectory)),
      isJsonRpc2: false,
      label: "Codex",
    });
    const listed = yield* Effect.gen(function* () {
      yield* rpc.request("initialize", {
        capabilities: { experimentalApi: true, requestAttestation: false },
        clientInfo: { name: "openmission", title: "OpenMission", version: "0.0.0" },
      });
      rpc.notify("initialized", {});
      return yield* rpc.request("model/list", {});
    }).pipe(Effect.timeout("20 seconds"), Effect.ensuring(Effect.sync(() => rpc.close())));
    yield* Queue.shutdown(rpc.incoming);
    const data = fieldOf(listed, "data");
    return Array.isArray(data)
      ? data.flatMap((model): Array<ModelOption> => {
          const id = textFieldOf(model, "id");
          return id === null || fieldOf(model, "hidden") === true
            ? []
            : [{ id, label: textFieldOf(model, "displayName") ?? id }];
        })
      : [];
  }).pipe(Effect.catch(() => Effect.succeed<ReadonlyArray<ModelOption>>([])));

/** Reads each tool's own status command; nothing here sees a credential. */
export const liveHarnessToolsLayer = (commands: HarnessCommands) =>
  Layer.sync(HarnessTools, () => {
    const models = new Map<string, { readonly at: number; readonly options: ReadonlyArray<ModelOption> }>();

    const inspect = (harness: HarnessName) =>
      run(commands[harness], ["--version"], {}).pipe(
        Effect.map(({ code, stdout }): Installation => {
          const version = stdout.trim().split("\n")[0] ?? "";
          return code === 0 && version !== ""
            ? { problem: null, version }
            : {
                problem: `${harnessLabels[harness]} was not found at "${commands[harness]}". Install it, then reopen Settings.`,
                version: null,
              };
        }),
      );

    const readSignIn = (harness: HarnessName, configDirectory: string | null) =>
      Effect.gen(function* () {
        const env = accountEnvironmentOf(harness, configDirectory);
        if (harness === "claude") {
          const { stdout } = yield* run(commands.claude, ["auth", "status", "--json"], env);
          let status: unknown = null;
          try {
            status = JSON.parse(stdout);
          } catch {
            return { detail: null, signIn: "Unknown" } satisfies SignInStatus;
          }
          if (fieldOf(status, "loggedIn") !== true) return { detail: null, signIn: "SignedOut" } satisfies SignInStatus;
          const plan = textFieldOf(status, "subscriptionType");
          const email = textFieldOf(status, "email");
          return {
            detail:
              [email, plan === null ? null : `Claude ${plan}`].filter((part) => part !== null).join(" · ") || null,
            signIn: "SignedIn",
          } satisfies SignInStatus;
        }
        if (harness === "codex") {
          const { code, output } = yield* run(commands.codex, ["login", "status"], env);
          const text = output.trim();
          if (code === null) return { detail: null, signIn: "Unknown" } satisfies SignInStatus;
          return code === 0 && /logged in/i.test(text)
            ? ({ detail: text.replace(/^logged in using /i, "") || null, signIn: "SignedIn" } satisfies SignInStatus)
            : ({ detail: null, signIn: "SignedOut" } satisfies SignInStatus);
        }
        // OpenCode lists one line per stored sign-in, each naming its provider.
        const { code, stdout } = yield* run(commands.opencode, ["auth", "list"], env);
        if (code === null) return { detail: null, signIn: "Unknown" } satisfies SignInStatus;
        const providers = stdout
          .split("\n")
          .filter((line) => /\bstored\b/.test(line))
          .map((line) => line.split(/\s{2,}/)[0]?.trim() ?? "")
          .filter((name) => name !== "");
        return providers.length === 0
          ? ({ detail: null, signIn: "SignedOut" } satisfies SignInStatus)
          : ({ detail: providers.join(", "), signIn: "SignedIn" } satisfies SignInStatus);
      });

    const readModels = (harness: HarnessName, configDirectory: string | null) =>
      Effect.gen(function* () {
        if (harness === "claude") return claudeModels;
        if (harness === "codex") return [defaultModel, ...(yield* listCodexModels(commands.codex, configDirectory))];
        const { stdout } = yield* run(commands.opencode, ["models"], accountEnvironmentOf(harness, configDirectory));
        const listed = stdout
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => /^[\w.-]+\/\S+$/.test(line))
          .map((id) => ({ id, label: id }));
        return [defaultModel, ...listed];
      });

    const listModels = (harness: HarnessName, configDirectory: string | null) =>
      Effect.gen(function* () {
        const key = `${harness}:${configDirectory ?? ""}`;
        const now = yield* Clock.currentTimeMillis;
        const cached = models.get(key);
        if (cached !== undefined && now - cached.at < modelsLifetimeMillis) return cached.options;
        const options = yield* readModels(harness, configDirectory);
        // A list with only the default is not kept, so a harness signed in later lists its models at once.
        if (options.length > 1) models.set(key, { at: now, options });
        return options;
      });

    const openSignIn = (harness: HarnessName, configDirectory: string | null) =>
      Effect.gen(function* () {
        const command = [quoted(commands[harness]), ...signInArgs[harness]].join(" ");
        const variable = configVariables[harness];
        const line = configDirectory === null ? command : `${variable}=${quoted(configDirectory)} ${command}`;
        if (process.platform !== "darwin") return yield* invalid(`Open a terminal on this computer and run: ${line}`);
        // A .command file opens in Terminal, which runs the harness's own sign-in where the owner answers it.
        const folder = join(tmpdir(), "openmission-sign-in");
        const script = join(folder, `${harness}-${crypto.randomUUID()}.command`);
        yield* Effect.sync(() => {
          mkdirSync(folder, { recursive: true });
          const exports = configDirectory === null ? [] : [`export ${variable}=${quoted(configDirectory)}`];
          writeFileSync(
            script,
            [
              "#!/bin/sh",
              `echo ${quoted(`Signing in to ${harnessLabels[harness]} for OpenMission. Close this window when done.`)}`,
              ...exports,
              command,
              `rm -f ${quoted(script)}`,
              "",
            ].join("\n"),
          );
          chmodSync(script, 0o755);
        });
        const opened = yield* run("open", [script], {});
        if (opened.code !== 0) return yield* invalid(`Could not open a terminal. Run this yourself: ${line}`);
      });

    return { inspect, listModels, openSignIn, readSignIn };
  });

/** Every harness installed and signed in, with fixed models; sign-ins are recorded, for checks. */
export const fakeHarnessToolsLayer = (signIns: Array<string> = []) =>
  Layer.succeed(HarnessTools, {
    inspect: () => Effect.succeed({ problem: null, version: "fake" }),
    listModels: (harness) =>
      Effect.succeed(
        harness === "claude"
          ? claudeModels
          : [defaultModel, { id: `${harness}-fake-model`, label: `${harness} fake model` }],
      ),
    openSignIn: (harness, configDirectory) =>
      Effect.sync(() => void signIns.push(`${harness}:${configDirectory ?? ""}`)),
    readSignIn: (_harness, configDirectory) =>
      Effect.succeed({
        detail: configDirectory === null ? "owner" : "added",
        signIn: "SignedIn",
      } satisfies SignInStatus),
  });
