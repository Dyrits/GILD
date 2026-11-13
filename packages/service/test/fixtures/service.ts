import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  LoreHistoryEntry,
  MissionDetail,
  MissionId,
  Request,
  RequestTag,
  ResultOf,
  ThreadId,
} from "@iskios/contracts";
import { Effect, type Layer } from "effect";
import { afterEach } from "vitest";
import { Endpoints, type PriceSource } from "../../src/core/index.ts";
import { callThreadTool } from "../../src/harness/fakeHarness.ts";
import { fakeHarnessLayer, type HarnessTools, Service, serviceLayer } from "../../src/index.ts";

/** An isolated service with the scripted fake harness and real temporary SQLite. */
export const fixture = (harnessTools?: Layer.Layer<HarnessTools>, priceSource?: Layer.Layer<PriceSource>) => {
  const directory = mkdtempSync(join(tmpdir(), "iskios-service-"));
  return {
    directory,
    layer: serviceLayer({
      filename: join(directory, "store.sqlite"),
      harness: fakeHarnessLayer("10 millis"),
      ...(harnessTools === undefined ? {} : { harnessTools }),
      ...(priceSource === undefined ? {} : { priceSource }),
      homeFolder: directory,
      scratchRoot: join(directory, "missions"),
    }),
    remove: () => rmSync(directory, { force: true, recursive: true }),
  };
};
const running: ReturnType<typeof fixture>[] = [];
afterEach(() => {
  for (const value of running.splice(0)) value.remove();
});
/** Runs an effect on a fresh isolated service, whose folder is removed after the test. */
export const withService = <A, E, R>(body: Effect.Effect<A, E, R>) => {
  const value = fixture();
  running.push(value);
  return body.pipe(Effect.provide(value.layer));
};
/** Calls the owner's service interface. */
export const call = <R extends Request>(request: R) =>
  Effect.gen(function* () {
    return (yield* (yield* Service).handle(request)) as ResultOf<R["_tag"] & RequestTag>;
  });
/** Calls a thread's authenticated MCP interface, as its fake harness does. */
export const tool = (threadId: ThreadId, name: string, args: object) =>
  Effect.gen(function* () {
    return yield* callThreadTool(yield* (yield* Endpoints).urlFor(threadId), name, args);
  });
/** Starts a mission with a unique command identifier. */
export const start = (text = "Hello", workspacePath: string | null = null) =>
  call({
    _tag: "StartMission",
    effort: "default",
    model: "default",
    requestId: crypto.randomUUID(),
    text,
    workspacePath,
  });
/** Sends an owner message with a unique command identifier. */
export const send = (threadId: ThreadId, text = "Hello") =>
  call({ _tag: "SendMessage", delivery: null, requestId: crypto.randomUUID(), text, threadId });
/** Reads a selected thread through the service. */
export const read = (missionId: MissionId, threadId: ThreadId | null = null) =>
  call({ _tag: "ReadMission", missionId, threadId });
/** Waits for observable fake-harness progress without reading service internals. */
export const settle = (
  missionId: MissionId,
  check: (detail: MissionDetail) => boolean,
  threadId: ThreadId | null = null,
) =>
  Effect.gen(function* () {
    for (let i = 0; i < 400; i++) {
      const detail = yield* read(missionId, threadId);
      if (check(detail)) return detail;
      yield* Effect.sleep("10 millis");
    }
    return yield* Effect.die(new Error(`Did not settle: ${JSON.stringify(yield* read(missionId, threadId))}`));
  });
/** Opens a thread by the owner. */
export const open = (parentThreadId: ThreadId, text = "Hello") =>
  call({
    _tag: "OpenThread",
    effort: "default",
    model: "default",
    parentThreadId,
    requestId: crypto.randomUUID(),
    shouldStartAnyway: false,
    text,
  });

/** The entry of the given kind in a lore entry's history; fails the test when there is none. */
export const entryOf = (entries: ReadonlyArray<LoreHistoryEntry>, kind: LoreHistoryEntry["kind"]) => {
  const found = entries.find((entry) => entry.kind === kind);
  if (found === undefined) throw new Error(`no ${kind} entry in ${entries.map((entry) => entry.kind).join(", ")}`);
  return found;
};
