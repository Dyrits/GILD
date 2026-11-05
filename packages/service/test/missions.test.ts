import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import type { MissionId, Request, RequestTag, ResultOf } from "@openmission/contracts";
import { Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import { afterEach } from "vitest";
import { fakeHarnessLayer, Service, serviceLayer } from "../src/index.ts";

const REPLY_DELAY = "2 seconds";

const directories: string[] = [];
const databaseFile = () => {
  const directory = mkdtempSync(join(tmpdir(), "openmission-test-"));
  directories.push(directory);
  return join(directory, "openmission.sqlite");
};
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

const live = (filename: string) =>
  serviceLayer({ filename, scratchRoot: join(filename, "..", "missions"), harness: fakeHarnessLayer(REPLY_DELAY) });

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

/** Lets forked turns observe the adjusted clock and commit. */
const advance = (duration: Parameters<typeof TestClock.adjust>[0]) =>
  Effect.gen(function* () {
    yield* TestClock.adjust(duration);
    for (let i = 0; i < 20; i++) yield* Effect.yieldNow;
  });

const read = (missionId: MissionId) => call({ _tag: "ReadMission", missionId });

describe("starting a mission", () => {
  it.effect("saves the mission, its top thread, and the first message, titled by the first line", () =>
    Effect.gen(function* () {
      const started = yield* call({
        _tag: "StartMission",
        requestId: "r1",
        text: "Plan the trip\nwith details",
        model: "default",
        effort: "default",
      });

      const missions = yield* call({ _tag: "ListMissions" });
      expect(missions).toHaveLength(1);
      expect(missions[0]).toMatchObject({ id: started.missionId, title: "Plan the trip", state: "Running" });

      const detail = yield* read(started.missionId);
      expect(detail.thread).toMatchObject({ id: started.threadId, state: "Running" });
      expect(detail.messages.map((m) => [m.sender, m.text])).toEqual([["user", "Plan the trip\nwith details"]]);
    }).pipe(Effect.provide(live(databaseFile()))),
  );

  it.effect("gets the fake harness's echo after the delay and becomes Idle", () =>
    Effect.gen(function* () {
      const started = yield* call({
        _tag: "StartMission",
        requestId: "r1",
        text: "Hello",
        model: "default",
        effort: "default",
      });
      yield* advance(REPLY_DELAY);

      const detail = yield* read(started.missionId);
      expect(detail.thread.state).toBe("Idle");
      expect(detail.messages.map((m) => [m.sender, m.text])).toEqual([
        ["user", "Hello"],
        ["agent", "Echo: Hello"],
      ]);
      const [summary] = yield* call({ _tag: "ListMissions" });
      expect(summary?.state).toBe("Idle");
    }).pipe(Effect.provide(live(databaseFile()))),
  );

  it.effect("refuses blank text and saves nothing", () =>
    Effect.gen(function* () {
      const failure = yield* failureOf({
        _tag: "StartMission",
        requestId: "r1",
        text: "   \n ",
        model: "default",
        effort: "default",
      });
      expect(failure.kind).toBe("InvalidInput");
      expect(yield* call({ _tag: "ListMissions" })).toEqual([]);
    }).pipe(Effect.provide(live(databaseFile()))),
  );

  it.effect("returns the original outcome when a request identifier is repeated", () =>
    Effect.gen(function* () {
      const first = yield* call({
        _tag: "StartMission",
        requestId: "same",
        text: "Once",
        model: "default",
        effort: "default",
      });
      const again = yield* call({
        _tag: "StartMission",
        requestId: "same",
        text: "Once",
        model: "default",
        effort: "default",
      });
      expect(again).toEqual(first);
      expect(yield* call({ _tag: "ListMissions" })).toHaveLength(1);
    }).pipe(Effect.provide(live(databaseFile()))),
  );
});

describe("follow-up messages", () => {
  it.effect("keep their order and are answered after the running turn", () =>
    Effect.gen(function* () {
      const started = yield* call({
        _tag: "StartMission",
        requestId: "r1",
        text: "First",
        model: "default",
        effort: "default",
      });
      yield* call({ _tag: "SendMessage", requestId: "r2", threadId: started.threadId, text: "Second" });
      yield* call({ _tag: "SendMessage", requestId: "r3", threadId: started.threadId, text: "Third" });

      yield* advance(REPLY_DELAY);
      yield* advance(REPLY_DELAY);

      const detail = yield* read(started.missionId);
      expect(detail.messages.map((m) => [m.sender, m.text])).toEqual([
        ["user", "First"],
        ["user", "Second"],
        ["user", "Third"],
        ["agent", "Echo: First"],
        ["agent", "Echo: Second\n\nThird"],
      ]);
      expect(detail.messages.map((m) => m.sequence)).toEqual([1, 2, 3, 4, 5]);
      expect(detail.thread.state).toBe("Idle");
    }).pipe(Effect.provide(live(databaseFile()))),
  );

  it.effect("wake an Idle thread", () =>
    Effect.gen(function* () {
      const started = yield* call({
        _tag: "StartMission",
        requestId: "r1",
        text: "One",
        model: "default",
        effort: "default",
      });
      yield* advance(REPLY_DELAY);
      yield* call({ _tag: "SendMessage", requestId: "r2", threadId: started.threadId, text: "Two" });
      expect((yield* read(started.missionId)).thread.state).toBe("Running");
      yield* advance(REPLY_DELAY);
      const detail = yield* read(started.missionId);
      expect(detail.messages.at(-1)?.text).toBe("Echo: Two");
      expect(detail.thread.state).toBe("Idle");
    }).pipe(Effect.provide(live(databaseFile()))),
  );

  it.effect("to an unknown thread are refused", () =>
    Effect.gen(function* () {
      const failure = yield* failureOf({
        _tag: "SendMessage",
        requestId: "r1",
        threadId: "missing" as never,
        text: "Hi",
      });
      expect(failure.kind).toBe("NotFound");
    }).pipe(Effect.provide(live(databaseFile()))),
  );
});

describe("persistence", () => {
  it.effect("keeps missions and conversations after reopening the database", () =>
    Effect.gen(function* () {
      const filename = databaseFile();
      const started = yield* Effect.scoped(
        Effect.gen(function* () {
          const result = yield* call({
            _tag: "StartMission",
            requestId: "r1",
            text: "Remember me",
            model: "default",
            effort: "default",
          });
          yield* advance(REPLY_DELAY);
          return result;
        }).pipe(Effect.provide(Layer.fresh(live(filename)))),
      );

      const detail = yield* read(started.missionId).pipe(Effect.provide(Layer.fresh(live(filename))));
      expect(detail.mission.title).toBe("Remember me");
      expect(detail.messages.map((m) => m.text)).toEqual(["Remember me", "Echo: Remember me"]);
      expect(detail.thread.state).toBe("Idle");
    }),
  );
});
