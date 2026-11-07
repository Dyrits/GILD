import { homedir } from "node:os";
// Entry point when Electron starts the service as a utilityProcess.
import { join } from "node:path";
import { Cause, Config, Effect, Exit, Layer } from "effect";
import { makeClaudeHarness } from "./claude.ts";
import { makeCodexHarness } from "./codex.ts";
import { fakeHarnessLayer, Harness, routeHarnesses } from "./execution.ts";
import { fakeHarnessToolsLayer, liveHarnessToolsLayer } from "./harnessTools.ts";
import { makeOpenCodeHarness } from "./opencode.ts";
import { sandboxProblem } from "./sandbox.ts";
import { serveLoopback } from "./server.ts";
import { serviceLayer } from "./service.ts";

interface ParentPort {
  postMessage(message: unknown): void;
}

const parentPort = (process as unknown as { parentPort?: ParentPort }).parentPort;

// A missing variable fails the program through Config instead of throwing at import.
const liveLayer = Layer.unwrap(
  Effect.gen(function* () {
    const dataDirectory = yield* Config.NonEmptyString("CANOPY_DATA_DIR");
    // CANOPY_HARNESS=fake selects the echo harness for checks.
    const harnessName = yield* Config.String("CANOPY_HARNESS").pipe(Config.withDefault("claude"));
    const commands = {
      claude: yield* Config.String("CANOPY_CLAUDE_PATH").pipe(Config.withDefault("claude")),
      codex: yield* Config.String("CANOPY_CODEX_PATH").pipe(Config.withDefault("codex")),
      opencode: yield* Config.String("CANOPY_OPENCODE_PATH").pipe(Config.withDefault("opencode")),
    };
    const problem = yield* sandboxProblem;
    const idleTimeout = "10 minutes";
    // Every thread's harness has its own adapter; turns go to the one their thread runs on (provider-accounts).
    const harness =
      harnessName === "fake"
        ? fakeHarnessLayer("1500 millis")
        : Layer.effect(
            Harness,
            Effect.gen(function* () {
              return routeHarnesses({
                claude: yield* makeClaudeHarness({ command: commands.claude, idleTimeout, sandboxProblem: problem }),
                codex: yield* makeCodexHarness({ command: commands.codex, idleTimeout }),
                opencode: yield* makeOpenCodeHarness({ command: commands.opencode, idleTimeout }),
              });
            }),
          );
    return Layer.fresh(
      serviceLayer({
        accountsRoot: join(dataDirectory, "accounts"),
        filename: join(dataDirectory, "canopy.sqlite"),
        harness,
        harnessTools: harnessName === "fake" ? fakeHarnessToolsLayer() : liveHarnessToolsLayer(commands),
        homeFolder: homedir(),
        scratchRoot: join(dataDirectory, "missions"),
      }),
    );
  }),
);

const program = Effect.gen(function* () {
  const token = yield* Config.NonEmptyString("CANOPY_TOKEN");
  const { port } = yield* serveLoopback({ port: 0, token });
  parentPort?.postMessage({ port, type: "ready" });
  return yield* Effect.never;
}).pipe(Effect.scoped, Effect.provide(liveLayer));

Effect.runFork(program).addObserver((exit) => {
  // The cause in full, so a startup failure says why in the desktop app's log.
  console.error("Canopy service stopped", Exit.isFailure(exit) ? Cause.pretty(exit.cause) : exit);
  process.exit(1);
});
