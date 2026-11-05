// Entry point when Electron starts the service as a utilityProcess.
import { join } from "node:path";
import { Effect, Layer } from "effect";
import { claudeHarnessLayer } from "./claude.ts";
import { fakeHarnessLayer } from "./execution.ts";
import { serveLoopback } from "./server.ts";
import { serviceLayer } from "./service.ts";

interface ParentPort {
  postMessage(message: unknown): void;
}

const required = (name: string) => {
  const value = process.env[name];
  if (value === undefined || value === "") throw new Error(`${name} is not set`);
  return value;
};

const parentPort = (process as unknown as { parentPort?: ParentPort }).parentPort;
const dataDirectory = required("OPENMISSION_DATA_DIR");

// OPENMISSION_HARNESS=fake selects the echo harness for checks.
const harness =
  process.env.OPENMISSION_HARNESS === "fake"
    ? fakeHarnessLayer("1500 millis")
    : claudeHarnessLayer({ command: process.env.OPENMISSION_CLAUDE_PATH ?? "claude", idleTimeout: "10 minutes" });

const program = Effect.gen(function* () {
  const { port } = yield* serveLoopback({ port: 0, token: required("OPENMISSION_TOKEN") });
  parentPort?.postMessage({ type: "ready", port });
  return yield* Effect.never;
}).pipe(
  Effect.scoped,
  Effect.provide(
    Layer.fresh(
      serviceLayer({
        filename: join(dataDirectory, "openmission.sqlite"),
        scratchRoot: join(dataDirectory, "missions"),
        harness,
      }),
    ),
  ),
);

Effect.runFork(program).addObserver((exit) => {
  console.error("OpenMission service stopped", exit);
  process.exit(1);
});
