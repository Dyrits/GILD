import { homedir } from "node:os";
// Entry point when Electron starts the service as a utilityProcess.
import { join } from "node:path";
import { Config, Effect, Layer } from "effect";
import { claudeHarnessLayer } from "./claude.ts";
import { fakeHarnessLayer } from "./execution.ts";
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
    const dataDirectory = yield* Config.NonEmptyString("OPENMISSION_DATA_DIR");
    // OPENMISSION_HARNESS=fake selects the echo harness for checks.
    const harnessName = yield* Config.String("OPENMISSION_HARNESS").pipe(Config.withDefault("claude"));
    const claudePath = yield* Config.String("OPENMISSION_CLAUDE_PATH").pipe(Config.withDefault("claude"));
    const problem = yield* sandboxProblem;
    const harness =
      harnessName === "fake"
        ? fakeHarnessLayer("1500 millis")
        : claudeHarnessLayer({ command: claudePath, idleTimeout: "10 minutes", sandboxProblem: problem });
    return Layer.fresh(
      serviceLayer({
        filename: join(dataDirectory, "openmission.sqlite"),
        harness,
        homeFolder: homedir(),
        scratchRoot: join(dataDirectory, "missions"),
      }),
    );
  }),
);

const program = Effect.gen(function* () {
  const token = yield* Config.NonEmptyString("OPENMISSION_TOKEN");
  const { port } = yield* serveLoopback({ port: 0, token });
  parentPort?.postMessage({ port, type: "ready" });
  return yield* Effect.never;
}).pipe(Effect.scoped, Effect.provide(liveLayer));

Effect.runFork(program).addObserver((exit) => {
  console.error("OpenMission service stopped", exit);
  process.exit(1);
});
