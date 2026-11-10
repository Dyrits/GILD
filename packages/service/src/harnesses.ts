import { tmpdir } from "node:os";
import type { HarnessName, ModelOption } from "@gild/contracts";
import { type Duration, Effect, Queue, type Scope } from "effect";
import { makeClaudeHarness } from "./claude.ts";
import { makeCodexHarness } from "./codex.ts";
import { type HarnessAdapter, routeHarnesses } from "./execution.ts";
import { accountEnvironmentOf, claudeModels, type HarnessFacts, harnessFacts } from "./harnessCatalog.ts";
import type { SignInStatus } from "./harnessTools.ts";
import { fieldOf, harnessEnvironmentOf, runHarnessCommand, startRpcProcess, textFieldOf } from "./lineProcess.ts";
import { makeOpenCodeHarness } from "./opencode.ts";

// The harness registry (provider-accounts): each harness defined once, by its facts, its turn adapter, and
// what Gild asks its own tool about sign-in and models. Adding a harness adds one entry here.

/** What every harness's turn adapter is started with in the app. */
export interface AdapterOptions {
  /** The executable. */
  readonly command: string;
  /** How long an idle thread keeps its process. */
  readonly idleTimeout: Duration.Input;
  /** Why the sandbox cannot run here, or null (CHG-0031). */
  readonly sandboxProblem: string | null;
}

/** One harness: its facts, its turn adapter, and its tool's answers about sign-in and models. */
export interface HarnessDefinition extends HarnessFacts {
  /** The adapter running the harness's turns, whose processes close with the scope that made it. */
  readonly makeAdapter: (options: AdapterOptions) => Effect.Effect<HarnessAdapter, never, Scope.Scope>;
  /** The models the harness offers with an account's sign-in, its default first. */
  readonly readModels: (command: string, configDirectory: string | null) => Effect.Effect<ReadonlyArray<ModelOption>>;
  /** Who the harness's tool says is signed in, given the account's environment; never a credential. */
  readonly readSignIn: (command: string, env: Record<string, string>) => Effect.Effect<SignInStatus>;
}

const unknownSignIn: SignInStatus = { detail: null, signIn: "Unknown" };
const signedOut: SignInStatus = { detail: null, signIn: "SignedOut" };

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
        clientInfo: { name: "gild", title: "Gild", version: "0.0.0" },
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

const claude: HarnessDefinition = {
  ...harnessFacts.claude,
  makeAdapter: ({ command, idleTimeout, sandboxProblem }) =>
    makeClaudeHarness({ command, idleTimeout, sandboxProblem }),
  readModels: () => Effect.succeed(claudeModels),
  readSignIn: (command, env) =>
    Effect.gen(function* () {
      const { stdout } = yield* runHarnessCommand(command, ["auth", "status", "--json"], env);
      let status: unknown = null;
      try {
        status = JSON.parse(stdout);
      } catch {
        return unknownSignIn;
      }
      if (fieldOf(status, "loggedIn") !== true) return signedOut;
      const plan = textFieldOf(status, "subscriptionType");
      const email = textFieldOf(status, "email");
      return {
        detail: [email, plan === null ? null : `Claude ${plan}`].filter((part) => part !== null).join(" · ") || null,
        signIn: "SignedIn",
      } satisfies SignInStatus;
    }),
};

const codex: HarnessDefinition = {
  ...harnessFacts.codex,
  makeAdapter: ({ command, idleTimeout }) => makeCodexHarness({ command, idleTimeout }),
  readModels: (command, configDirectory) => listCodexModels(command, configDirectory),
  readSignIn: (command, env) =>
    runHarnessCommand(command, ["login", "status"], env).pipe(
      Effect.map(({ code, output }): SignInStatus => {
        const text = output.trim();
        if (code === null) return unknownSignIn;
        return code === 0 && /logged in/i.test(text)
          ? { detail: text.replace(/^logged in using /i, "") || null, signIn: "SignedIn" }
          : signedOut;
      }),
    ),
};

const opencode: HarnessDefinition = {
  ...harnessFacts.opencode,
  makeAdapter: ({ command, idleTimeout }) => makeOpenCodeHarness({ command, idleTimeout }),
  readModels: (command, configDirectory) =>
    runHarnessCommand(command, ["models"], accountEnvironmentOf("opencode", configDirectory)).pipe(
      Effect.map(({ stdout }) =>
        stdout
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => /^[\w.-]+\/\S+$/.test(line))
          .map((id) => ({ id, label: id })),
      ),
    ),
  // OpenCode lists one line per stored sign-in, each naming its provider.
  readSignIn: (command, env) =>
    runHarnessCommand(command, ["auth", "list"], env).pipe(
      Effect.map(({ code, stdout }): SignInStatus => {
        if (code === null) return unknownSignIn;
        const providers = stdout
          .split("\n")
          .filter((line) => /\bstored\b/.test(line))
          .map((line) => line.split(/\s{2,}/)[0]?.trim() ?? "")
          .filter((name) => name !== "");
        return providers.length === 0 ? signedOut : { detail: providers.join(", "), signIn: "SignedIn" };
      }),
    ),
};

/** Every harness, by name. */
export const harnesses = { claude, codex, opencode } satisfies Record<HarnessName, HarnessDefinition>;

/** The adapter the app runs turns through: each harness's own, started from its definition (provider-accounts). */
export const makeHarnessRouter = (commands: Record<HarnessName, string>, options: Omit<AdapterOptions, "command">) => {
  const adapterOf = (name: HarnessName) => harnesses[name].makeAdapter({ ...options, command: commands[name] });
  return Effect.all({
    claude: adapterOf("claude"),
    codex: adapterOf("codex"),
    opencode: adapterOf("opencode"),
  } satisfies Record<HarnessName, unknown>).pipe(Effect.map(routeHarnesses));
};
