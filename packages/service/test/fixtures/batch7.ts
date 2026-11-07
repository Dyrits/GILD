import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { MissionDetail, MissionId, Request, RequestTag, ResultOf, ThreadId } from "@canopy/contracts";
import { Effect } from "effect";
import { Endpoints } from "../../src/endpoints.ts";
import { callThreadTool } from "../../src/execution.ts";
import { fakeHarnessLayer, Service, serviceLayer } from "../../src/index.ts";

/** An isolated service with the scripted fake harness and real temporary SQLite. */
export const fixture = () => {
  const directory = mkdtempSync(join(tmpdir(), "canopy-batch7-"));
  return {
    directory,
    layer: serviceLayer({
      filename: join(directory, "store.sqlite"),
      harness: fakeHarnessLayer("10 millis"),
      homeFolder: directory,
      scratchRoot: join(directory, "missions"),
    }),
    remove: () => rmSync(directory, { force: true, recursive: true }),
  };
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
