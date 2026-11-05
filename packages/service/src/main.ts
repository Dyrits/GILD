// Entry point when Electron starts the service as a utilityProcess.
import { Effect, Layer } from "effect";
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

const program = Effect.gen(function* () {
  const { port } = yield* serveLoopback({ port: 0, token: required("OPENMISSION_TOKEN") });
  parentPort?.postMessage({ type: "ready", port });
  return yield* Effect.never;
}).pipe(
  Effect.scoped,
  Effect.provide(Layer.fresh(serviceLayer({ filename: required("OPENMISSION_DATABASE"), replyDelay: "1500 millis" }))),
);

Effect.runFork(program).addObserver((exit) => {
  console.error("OpenMission service stopped", exit);
  process.exit(1);
});
