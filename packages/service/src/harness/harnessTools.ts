import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EffortChoice, HarnessName, ModelOption, SignInState } from "@iskios/contracts";
import { Clock, Context, Effect, Layer } from "effect";
import { invalid, type ServiceFailure, textFieldOf } from "../core/index.ts";
import { accountEnvironmentOf, harnessFacts } from "./harnessCatalog.ts";
import { harnesses } from "./harnesses.ts";
import { installHarnessPackage } from "./harnessInstallation.ts";
import { updateOf } from "./harnessVersions.ts";
import { runHarnessCommand } from "./lineProcess.ts";

// What Iskios asks each harness's own command-line tool about itself: its version, who is signed in,
// and its models; and how the owner signs in, always through the tool's own sign-in (requirements, Comply
// with provider terms). Iskios never reads or stores the credentials.

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
    /** Installs the harness's official npm package. */
    readonly install: (harness: HarnessName) => Effect.Effect<void, ServiceFailure>;
    /** The newer version a harness can update to, given its installed version text; null when up to date or unknown. */
    readonly findUpdate: (harness: HarnessName, installed: string | null) => Effect.Effect<string | null>;
    readonly listModels: (
      harness: HarnessName,
      configDirectory: string | null,
    ) => Effect.Effect<ReadonlyArray<ModelOption>>;
    /** The effort levels the provider offers for one model, lowest first, without "default"; empty when none. */
    readonly listEfforts: (
      harness: HarnessName,
      configDirectory: string | null,
      model: string,
    ) => Effect.Effect<ReadonlyArray<EffortChoice>>;
    /** Opens the harness's own sign-in in a terminal window, pointed at the account's folder. */
    readonly openSignIn: (harness: HarnessName, configDirectory: string | null) => Effect.Effect<void, ServiceFailure>;
    readonly readSignIn: (harness: HarnessName, configDirectory: string | null) => Effect.Effect<SignInStatus>;
    /** Runs the harness's own update command, which updates it the way it was installed. */
    readonly update: (harness: HarnessName) => Effect.Effect<void, ServiceFailure>;
  }
>()("iskios/HarnessTools") {}

/** The executable each harness runs as. */
export type HarnessCommands = Record<HarnessName, string>;

/** Single-quoted for a POSIX shell. */
const quoted = (text: string) => `'${text.replaceAll("'", "'\\''")}'`;

/** How long a model list is reused before the harness is asked again. */
const modelsLifetimeMillis = 10 * 60 * 1000;

/** How long the newest release is reused before the registry is asked again. */
const latestLifetimeMillis = 30 * 60 * 1000;

/** How long a harness's own update command may run. */
const updateTimeoutMillis = 5 * 60 * 1000;

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
                problem: `${harnessFacts[harness].label} was not found at "${commands[harness]}". Choose Install, or install it yourself and press Refresh.`,
                version: null,
              };
        }),
      );

    const latest = new Map<HarnessName, { readonly at: number; readonly version: string | null }>();

    // The npm registry's `latest` tag; any failure reads as "not known", so an offline computer sees no update.
    const readLatest = (harness: HarnessName) =>
      Effect.tryPromise(async () => {
        const response = await fetch(`https://registry.npmjs.org/${harnessFacts[harness].packageName}/latest`, {
          signal: AbortSignal.timeout(8000),
        });
        const body: unknown = await response.json();
        return response.ok ? textFieldOf(body, "version") : null;
      }).pipe(Effect.catch(() => Effect.succeed(null)));

    const findUpdate = (harness: HarnessName, installed: string | null) =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        const cached = latest.get(harness);
        if (cached !== undefined && now - cached.at < latestLifetimeMillis) return updateOf(installed, cached.version);
        const version = yield* readLatest(harness);
        // A failed read is not kept, so the next listing asks again.
        if (version !== null) latest.set(harness, { at: now, version });
        return updateOf(installed, version);
      });

    const update = (harness: HarnessName) =>
      Effect.gen(function* () {
        const label = harnessFacts[harness].label;
        const run = yield* runHarnessCommand(
          commands[harness],
          harnessFacts[harness].updateArgs,
          {},
          updateTimeoutMillis,
        );
        if (run.code !== 0) {
          const reason = run.output.trim().split("\n").slice(-3).join(" ");
          return yield* invalid(
            `${label} did not update${run.code === null ? " (it timed out or could not run)" : ""}. ${reason}`.trim(),
          );
        }
      });

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

    const efforts = new Map<string, { at: number; levels: ReadonlyArray<EffortChoice> }>();
    const listEfforts = (harness: HarnessName, configDirectory: string | null, model: string) =>
      Effect.gen(function* () {
        const readEfforts = harnesses[harness].readEfforts;
        if (readEfforts === undefined)
          return (yield* listModels(harness, configDirectory)).find((option) => option.id === model)?.efforts ?? [];
        const key = `${harness}:${configDirectory ?? ""}:${model}`;
        const now = yield* Clock.currentTimeMillis;
        const cached = efforts.get(key);
        if (cached !== undefined && now - cached.at < modelsLifetimeMillis) return cached.levels;
        const levels = yield* readEfforts(commands[harness], configDirectory, model);
        // An empty answer may be a failed read: not kept, so the next pick asks again.
        if (levels.length > 0) efforts.set(key, { at: now, levels });
        return levels;
      });

    const openSignIn = (harness: HarnessName, configDirectory: string | null) =>
      Effect.gen(function* () {
        const command = [quoted(commands[harness]), ...harnessFacts[harness].signInArgs].join(" ");
        const variable = harnessFacts[harness].configVariable;
        const line = configDirectory === null ? command : `${variable}=${quoted(configDirectory)} ${command}`;
        if (process.platform !== "darwin") return yield* invalid(`Open a terminal on this computer and run: ${line}`);
        // A .command file opens in Terminal, which runs the harness's own sign-in where the owner answers it.
        const folder = join(tmpdir(), "iskios-sign-in");
        const script = join(folder, `${harness}-${crypto.randomUUID()}.command`);
        yield* Effect.sync(() => {
          mkdirSync(folder, { recursive: true });
          const exports = configDirectory === null ? [] : [`export ${variable}=${quoted(configDirectory)}`];
          writeFileSync(
            script,
            [
              "#!/bin/sh",
              `echo ${quoted(`Signing in to ${harnessFacts[harness].label} for Iskios. Close this window when done.`)}`,
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

    return {
      findUpdate,
      inspect,
      install: installHarnessPackage,
      listEfforts,
      listModels,
      openSignIn,
      readSignIn,
      update,
    };
  });

/** Which harnesses the fake offers an update to, by newer version, and the harnesses it has updated since. */
export interface FakeUpdates {
  readonly available: Partial<Record<HarnessName, string>>;
  readonly updated: Array<HarnessName>;
}

/** Every harness installed and signed in, with fixed models and no update; sign-ins and updates are recorded, for checks. */
export const fakeHarnessToolsLayer = (
  signIns: Array<string> = [],
  updates: FakeUpdates = { available: {}, updated: [] },
  missing: Set<HarnessName> = new Set(),
) =>
  Layer.succeed(HarnessTools, {
    findUpdate: (harness) => Effect.succeed(updates.available[harness] ?? null),
    inspect: (harness) =>
      Effect.succeed(
        missing.has(harness) ? { problem: "Not installed", version: null } : { problem: null, version: "fake" },
      ),
    install: (harness) =>
      Effect.sync(() => {
        missing.delete(harness);
      }),
    listEfforts: (harness, _configDirectory, model) =>
      Effect.succeed(harnessFacts[harness].fixedModels?.find((option) => option.id === model)?.efforts ?? []),
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
    update: (harness) =>
      Effect.sync(() => {
        updates.updated.push(harness);
        delete updates.available[harness];
      }),
  });
