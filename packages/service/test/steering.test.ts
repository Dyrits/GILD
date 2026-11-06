import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import type {
  MessageDelivery,
  MissionDetail,
  MissionId,
  Request,
  RequestTag,
  ResultOf,
  ThreadId,
} from "@openmission/contracts";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { fakeHarnessLayer, Service, serviceLayer } from "../src/index.ts";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

const live = () => {
  const directory = mkdtempSync(join(tmpdir(), "openmission-steering-"));
  directories.push(directory);
  return serviceLayer({
    filename: join(directory, "openmission.sqlite"),
    harness: fakeHarnessLayer("10 millis"),
    homeFolder: directory,
    scratchRoot: join(directory, "missions"),
  });
};

const call = <R extends Request>(request: R) =>
  Effect.gen(function* () {
    const service = yield* Service;
    return (yield* service.handle(request)) as ResultOf<R["_tag"] & RequestTag>;
  });

const failureOf = <R extends Request>(request: R) =>
  Effect.gen(function* () {
    const service = yield* Service;
    return yield* Effect.flip(service.handle(request));
  });

let requestCount = 0;
const start = (text: string) =>
  call({
    _tag: "StartMission",
    effort: "default",
    model: "default",
    requestId: `start-${++requestCount}`,
    text,
    workspacePath: null,
  });
const send = (threadId: ThreadId, text: string, delivery: MessageDelivery | null = null) =>
  call({ _tag: "SendMessage", delivery, requestId: `send-${++requestCount}`, text, threadId });
const interrupt = (threadId: ThreadId) => call({ _tag: "InterruptThread", threadId });
const read = (missionId: MissionId, threadId: ThreadId | null = null) =>
  call({ _tag: "ReadMission", missionId, threadId });

/** Polls for at most 4 seconds, shorter than the 5-second turns an interrupt must cut short. */
const settle = (missionId: MissionId, check: (detail: MissionDetail) => boolean, threadId: ThreadId | null = null) =>
  Effect.gen(function* () {
    for (let i = 0; i < 400; i++) {
      const detail = yield* read(missionId, threadId);
      if (check(detail)) return detail;
      yield* Effect.sleep("10 millis");
    }
    return yield* Effect.die(new Error(`mission did not settle: ${JSON.stringify(yield* read(missionId, threadId))}`));
  });

/** A fake-harness line that calls one of the thread tools. */
const tool = (name: string, args: object) => `call ${name} ${JSON.stringify(args)}`;

const repliesOf = (detail: MissionDetail) =>
  detail.messages.filter((message) => message.sender === "agent").map((message) => message.text);
const isRunning = (detail: MissionDetail) => detail.thread.state === "Running";
const isIdleWith = (count: number) => (detail: MissionDetail) =>
  detail.thread.state === "Idle" && repliesOf(detail).length === count;
const childOf = (detail: MissionDetail) => detail.threads.find((thread) => thread.parentId === detail.thread.id);

describe("steering a running thread", () => {
  it.live("joins the owner's message to the running turn by default", () =>
    Effect.gen(function* () {
      const started = yield* start("wait 400");
      yield* settle(started.missionId, isRunning);
      yield* send(started.threadId, "Also this");
      const detail = yield* settle(started.missionId, isIdleWith(1));
      expect(repliesOf(detail)).toEqual(["Echo: waited 400 + Also this"]);
      yield* Effect.sleep("100 millis");
      expect(repliesOf(yield* read(started.missionId))).toHaveLength(1);
    }).pipe(Effect.provide(live())),
  );

  it.live("keeps the owner's queued message for the next turn and marks it Queued until then", () =>
    Effect.gen(function* () {
      const started = yield* start("wait 300");
      yield* settle(started.missionId, isRunning);
      yield* send(started.threadId, "Later", "Queue");
      const running = yield* read(started.missionId);
      expect(running.messages.find((message) => message.text === "Later")?.isQueued).toBe(true);

      const detail = yield* settle(started.missionId, isIdleWith(2));
      expect(repliesOf(detail)).toEqual(["Echo: waited 300", "Echo: Later"]);
      expect(detail.messages.find((message) => message.text === "Later")?.isQueued).toBe(false);
    }).pipe(Effect.provide(live())),
  );

  it.live("queues the owner's message when the owner's default is Queue", () =>
    Effect.gen(function* () {
      const settings = yield* call({ _tag: "ReadSettings" });
      expect(settings.defaultDelivery).toBe("Steer");
      yield* call({ _tag: "UpdateSettings", settings: { ...settings, defaultDelivery: "Queue" } });
      const started = yield* start("wait 300");
      yield* settle(started.missionId, isRunning);
      yield* send(started.threadId, "Later");
      const detail = yield* settle(started.missionId, isIdleWith(2));
      expect(repliesOf(detail)).toEqual(["Echo: waited 300", "Echo: Later"]);
    }).pipe(Effect.provide(live())),
  );

  it.live("steers a message sent as Steer even when the owner's default is Queue", () =>
    Effect.gen(function* () {
      const settings = yield* call({ _tag: "ReadSettings" });
      yield* call({ _tag: "UpdateSettings", settings: { ...settings, defaultDelivery: "Queue" } });
      const started = yield* start("wait 400");
      yield* settle(started.missionId, isRunning);
      yield* send(started.threadId, "Now", "Steer");
      const detail = yield* settle(started.missionId, isIdleWith(1));
      expect(repliesOf(detail)).toEqual(["Echo: waited 400 + Now"]);
    }).pipe(Effect.provide(live())),
  );

  it.live("joins a result from a thread beneath to its parent's running turn", () =>
    Effect.gen(function* () {
      const started = yield* start(
        `${tool("open_thread", { request: tool("report_result", { result: "42" }), title: "Answer" })}\nwait 800`,
      );
      const detail = yield* settle(started.missionId, isIdleWith(1));
      const [reply] = repliesOf(detail);
      expect(reply).toContain('Result from thread "Answer"');
      expect(reply).toContain("42");
      yield* Effect.sleep("100 millis");
      expect(repliesOf(yield* read(started.missionId))).toHaveLength(1);
    }).pipe(Effect.provide(live())),
  );
});

describe("interrupting a thread", () => {
  it.live("ends the running turn at once and leaves the thread Idle", () =>
    Effect.gen(function* () {
      const started = yield* start("wait 5000");
      yield* settle(started.missionId, isRunning);
      yield* interrupt(started.threadId);
      const detail = yield* settle(started.missionId, (current) => current.thread.state === "Idle");
      expect(repliesOf(detail)).toEqual([]);
    }).pipe(Effect.provide(live())),
  );

  it.live("starts the next turn with the messages the interrupted turn had not taken in", () =>
    Effect.gen(function* () {
      const started = yield* start("wait 5000");
      yield* settle(started.missionId, isRunning);
      yield* send(started.threadId, "After", "Queue");
      yield* interrupt(started.threadId);
      const detail = yield* settle(started.missionId, isIdleWith(1));
      expect(repliesOf(detail)).toEqual(["Echo: After"]);
    }).pipe(Effect.provide(live())),
  );

  it.live("leaves an interrupted thread Waiting while a thread beneath it runs", () =>
    Effect.gen(function* () {
      const started = yield* start(`${tool("open_thread", { request: "wait 3000" })}\nwait 5000`);
      yield* settle(started.missionId, (detail) => childOf(detail)?.state === "Running");
      yield* interrupt(started.threadId);
      const detail = yield* settle(started.missionId, (current) => current.thread.state === "Waiting");
      expect(childOf(detail)?.state).toBe("Running");
    }).pipe(Effect.provide(live())),
  );

  it.live("refuses to interrupt a thread that is not running", () =>
    Effect.gen(function* () {
      const started = yield* start("Hello");
      yield* settle(started.missionId, isIdleWith(1));
      const failure = yield* failureOf({ _tag: "InterruptThread", threadId: started.threadId });
      expect(failure).toMatchObject({ kind: "InvalidInput", message: "This thread is not running." });
    }).pipe(Effect.provide(live())),
  );

  it.live("lets a thread interrupt a running thread directly beneath it", () =>
    Effect.gen(function* () {
      const started = yield* start(tool("open_thread", { request: "wait 5000" }));
      const opened = yield* settle(
        started.missionId,
        (detail) => childOf(detail)?.state === "Running" && detail.thread.state !== "Running",
      );
      const childId = childOf(opened)?.id as ThreadId;
      yield* send(started.threadId, tool("interrupt_thread", { thread: childId }));
      const detail = yield* settle(
        started.missionId,
        (current) => childOf(current)?.state === "Idle" && isIdleWith(2)(current),
      );
      expect(repliesOf(detail).at(-1)).toBe("Echo: Interrupted.");
    }).pipe(Effect.provide(live())),
  );

  it.live("refuses a thread's interrupt of a thread not directly beneath it", () =>
    Effect.gen(function* () {
      const started = yield* start(tool("open_thread", { request: "wait 5000" }));
      const opened = yield* settle(
        started.missionId,
        (detail) => childOf(detail)?.state === "Running" && detail.thread.state !== "Running",
      );
      const childId = childOf(opened)?.id as ThreadId;
      yield* send(childId, tool("interrupt_thread", { thread: started.threadId }), "Queue");
      yield* interrupt(childId);
      const detail = yield* settle(started.missionId, (current) => repliesOf(current).length === 1, childId);
      expect(repliesOf(detail)[0]).toBe(
        "Echo: Not interrupted: you can only interrupt a thread directly beneath you, by its id.",
      );
    }).pipe(Effect.provide(live())),
  );

  it.live("refuses a thread's interrupt of a thread beneath it that is not running", () =>
    Effect.gen(function* () {
      const started = yield* start(tool("open_thread", { request: "Hello" }));
      const opened = yield* settle(
        started.missionId,
        (detail) => childOf(detail)?.state === "Idle" && detail.thread.state === "Idle",
      );
      const childId = childOf(opened)?.id as ThreadId;
      yield* send(started.threadId, tool("interrupt_thread", { thread: childId }));
      const detail = yield* settle(started.missionId, isIdleWith(2));
      expect(repliesOf(detail).at(-1)).toBe("Echo: Not interrupted: that thread is not running.");
    }).pipe(Effect.provide(live())),
  );
});
