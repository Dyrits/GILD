import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HarnessName, ModelOption, SignInState } from "@gild/contracts";
import { Clock, Context, Effect, Layer } from "effect";
import { invalid, type ServiceFailure } from "./errors.ts";
import { accountEnvironmentOf, harnessFacts } from "./harnessCatalog.ts";
import { harnesses } from "./harnesses.ts";
import { runHarnessCommand } from "./lineProcess.ts";

// What Gild asks each harness's own command-line tool about itself: its version, who is signed in,
// and its models; and how the owner signs in, always through the tool's own sign-in (requirements, Comply
// with provider terms). Gild never reads or stores the credentials.

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
>()("gild/HarnessTools") {}

/** The executable each harness runs as. */
export type HarnessCommands = Record<HarnessName, string>;

/** Single-quoted for a POSIX shell. */
const quoted = (text: string) => `'${text.replaceAll("'", "'\\''")}'`;

/** How long a model list is reused before the harness is asked again. */
const modelsLifetimeMillis = 10 * 60 * 1000;

/** Reads each tool's own status command; nothing here sees a credential. */
export const liveHarnessToolsLayer = (commands: HarnessCommands) =>
  Layer.sync(HarnessTools, () => {
    const models = new Map<string, { readonly at: number; readonly options: ReadonlyArray<ModelOption> }>();

    const inspect = (harness: HarnessName) =>
      runHarnessCommand(commands[harness], ["--version"], {}).pipe(
        Effect.map(({ code, stdout }): Installation => {
          const version = stdout.trim().split("\n")[0] ?? "";
          return code === 0 && version !== ""
            ? { problem: null, version }
            : {
                problem: `${harnessFacts[harness].label} was not found at "${commands[harness]}". Install it, then reopen the Workshop.`,
                version: null,
              };
        }),
      );

    const readSignIn = (harness: HarnessName, configDirectory: string | null) =>
      harnesses[harness].readSignIn(commands[harness], accountEnvironmentOf(harness, configDirectory));

    const readModels = (harness: HarnessName, configDirectory: string | null) =>
      harnesses[harness].readModels(commands[harness], configDirectory);

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
        const command = [quoted(commands[harness]), ...harnessFacts[harness].signInArgs].join(" ");
        const variable = harnessFacts[harness].configVariable;
        const line = configDirectory === null ? command : `${variable}=${quoted(configDirectory)} ${command}`;
        if (process.platform !== "darwin") return yield* invalid(`Open a terminal on this computer and run: ${line}`);
        // A .command file opens in Terminal, which runs the harness's own sign-in where the owner answers it.
        const folder = join(tmpdir(), "gild-sign-in");
        const script = join(folder, `${harness}-${crypto.randomUUID()}.command`);
        yield* Effect.sync(() => {
          mkdirSync(folder, { recursive: true });
          const exports = configDirectory === null ? [] : [`export ${variable}=${quoted(configDirectory)}`];
          writeFileSync(
            script,
            [
              "#!/bin/sh",
              `echo ${quoted(`Signing in to ${harnessFacts[harness].label} for Gild. Close this window when done.`)}`,
              ...exports,
              command,
              `rm -f ${quoted(script)}`,
              "",
            ].join("\n"),
          );
          chmodSync(script, 0o755);
        });
        const opened = yield* runHarnessCommand("open", [script], {});
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
        harnessFacts[harness].fixedModels ?? [{ id: `${harness}-fake-model`, label: `${harness} fake model` }],
      ),
    openSignIn: (harness, configDirectory) =>
      Effect.sync(() => void signIns.push(`${harness}:${configDirectory ?? ""}`)),
    readSignIn: (_harness, configDirectory) =>
      Effect.succeed({
        detail: configDirectory === null ? "owner" : "added",
        signIn: "SignedIn",
      } satisfies SignInStatus),
  });
