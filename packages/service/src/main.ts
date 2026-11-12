import { homedir } from "node:os";
// Entry point when Electron starts the service as a utilityProcess.
import { join } from "node:path";
import { Cause, Config, Effect, Exit, Layer } from "effect";
import { Harness, modelsDevSourceLayer, noPriceSourceLayer, sandboxProblem } from "./core/index.ts";
import { fakeHarnessLayer, fakeHarnessToolsLayer, liveHarnessToolsLayer, makeHarnessRouter } from "./harness/index.ts";
import { defaultRelayOrigin } from "./remote/config.ts";
import { serveLoopback } from "./server.ts";
import { serviceLayer } from "./service.ts";

interface ParentPort {
  postMessage(message: unknown): void;
}

const parentPort = (process as unknown as { parentPort?: ParentPort }).parentPort;

// A missing variable fails the program through Config instead of throwing at import.
const liveLayer = Layer.unwrap(
  Effect.gen(function* () {
    const dataDirectory = yield* Config.NonEmptyString("ISKIOS_DATA_DIR");
    // ISKIOS_HARNESS=fake selects the echo harness for checks.
    const harnessName = yield* Config.String("ISKIOS_HARNESS").pipe(Config.withDefault("claude"));
    const commands = {
      claude: yield* Config.String("ISKIOS_CLAUDE_PATH").pipe(Config.withDefault("claude")),
      codex: yield* Config.String("ISKIOS_CODEX_PATH").pipe(Config.withDefault("codex")),
      opencode: yield* Config.String("ISKIOS_OPENCODE_PATH").pipe(Config.withDefault("opencode")),
    };
    // ISKIOS_RELAY_ORIGIN points pairing at another relay, such as one run locally for checks (device-pairing).
    const relayOrigin = yield* Config.String("ISKIOS_RELAY_ORIGIN").pipe(Config.withDefault(defaultRelayOrigin));
    // The Worker's name on the owner's own Cloudflare account, for a check that must not touch a Worker already there.
    const ownRelayWorkerName = yield* Config.String("ISKIOS_OWN_RELAY_NAME").pipe(Config.withDefault(""));
    const problem = yield* sandboxProblem;
    const idleTimeout = "10 minutes";
    // Every thread's harness has its own adapter; turns go to the one their thread runs on (provider-accounts).
    const harness =
      harnessName === "fake"
        ? fakeHarnessLayer("1500 millis")
        : Layer.effect(Harness, makeHarnessRouter(commands, { dataDirectory, idleTimeout, sandboxProblem: problem }));
    return Layer.fresh(
      serviceLayer({
        accountsRoot: join(dataDirectory, "accounts"),
        filename: join(dataDirectory, "iskios.sqlite"),
        harness,
        harnessTools: harnessName === "fake" ? fakeHarnessToolsLayer() : liveHarnessToolsLayer(commands),
        homeFolder: homedir(),
        priceSource: harnessName === "fake" ? noPriceSourceLayer : modelsDevSourceLayer(),
        ...(ownRelayWorkerName === "" ? {} : { ownRelayWorkerName }),
        relayOrigin,
        scratchRoot: join(dataDirectory, "missions"),
      }),
    );
  }),
);

const program = Effect.gen(function* () {
  const token = yield* Config.NonEmptyString("ISKIOS_TOKEN");
  const { port } = yield* serveLoopback({ port: 0, token });
  parentPort?.postMessage({ port, type: "ready" });
  return yield* Effect.never;
}).pipe(Effect.scoped, Effect.provide(liveLayer));

Effect.runFork(program).addObserver((exit) => {
  // The cause in full, so a startup failure says why in the desktop app's log.
  console.error("Iskios service stopped", Exit.isFailure(exit) ? Cause.pretty(exit.cause) : exit);
  process.exit(1);
});
