import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import type { MissionId, Request, RequestTag, ResultOf } from "@iskios/contracts";
import { Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import { afterEach } from "vitest";
import { fakeHarnessLayer, Service, serviceLayer } from "../../src/index.ts";

const REPLY_DELAY = "2 seconds";

const directories: string[] = [];
const databaseFile = () => {
  const directory = mkdtempSync(join(tmpdir(), "iskios-test-"));
  directories.push(directory);
  return join(directory, "iskios.sqlite");
};
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

const live = (filename: string) =>
  serviceLayer({
    filename,
    harness: fakeHarnessLayer(REPLY_DELAY),
    homeFolder: join(filename, ".."),
    scratchRoot: join(filename, "..", "missions"),
  });

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

const read = (missionId: MissionId) => call({ _tag: "ReadMission", missionId, threadId: null });
const realmList = () => call({ _tag: "ListMissions", isArchived: false, search: null, state: null, workspaceId: null });

describe("starting a mission", () => {
  it.effect("saves the mission, its top thread, and the first message, titled by the first line", () =>
    Effect.gen(function* () {
      const started = yield* call({
        _tag: "StartMission",
        effort: "default",
        model: "default",
        requestId: "r1",
        text: "Plan the trip\nwith details",
        workspacePath: null,
      });

      const { missions } = yield* call({
        _tag: "ListMissions",
        isArchived: false,
        search: null,
        state: null,
        workspaceId: null,
      });
      expect(missions).toHaveLength(1);
      expect(missions[0]).toMatchObject({
        harness: "claude",
        id: started.missionId,
        model: "default",
        state: "Running",
        title: "Plan the trip",
      });

      const detail = yield* read(started.missionId);
      expect(detail.thread).toMatchObject({ id: started.threadId, state: "Running" });
      expect(detail.messages.map((m) => [m.sender, m.text])).toEqual([["user", "Plan the trip\nwith details"]]);
      // Each thread of the tree carries what the full quest list shows beside it: harness, model, latest activity.
      const [top] = detail.threads;
      expect(top).toMatchObject({ harness: "claude", model: "default" });
      expect(top?.lastActivityAt).toBe(detail.messages[0]?.sentAt);
    }).pipe(Effect.provide(live(databaseFile()))),
  );

  it.effect("gets the fake harness's echo after the delay and becomes Idle", () =>
    Effect.gen(function* () {
      const started = yield* call({
        _tag: "StartMission",
        effort: "default",
        model: "default",
        requestId: "r1",
        text: "Hello",
        workspacePath: null,
      });
      yield* advance(REPLY_DELAY);

      const detail = yield* read(started.missionId);
      expect(detail.thread.state).toBe("Idle");
      expect(detail.messages.map((m) => [m.sender, m.text])).toEqual([
        ["user", "Hello"],
        ["agent", "Echo: Hello"],
      ]);
      const {
        missions: [summary],
      } = yield* call({ _tag: "ListMissions", isArchived: false, search: null, state: null, workspaceId: null });
      expect(summary?.state).toBe("Idle");
    }).pipe(Effect.provide(live(databaseFile()))),
  );

  it.effect("refuses blank text and saves nothing", () =>
    Effect.gen(function* () {
      const failure = yield* failureOf({
        _tag: "StartMission",
        effort: "default",
        model: "default",
        requestId: "r1",
        text: "   \n ",
        workspacePath: null,
      });
      expect(failure.kind).toBe("InvalidInput");
      expect(
        (yield* call({ _tag: "ListMissions", isArchived: false, search: null, state: null, workspaceId: null }))
          .missions,
      ).toEqual([]);
    }).pipe(Effect.provide(live(databaseFile()))),
  );

  it.effect("returns the original outcome when a request identifier is repeated", () =>
    Effect.gen(function* () {
      const first = yield* call({
        _tag: "StartMission",
        effort: "default",
        model: "default",
        requestId: "same",
        text: "Once",
        workspacePath: null,
      });
      const again = yield* call({
        _tag: "StartMission",
        effort: "default",
        model: "default",
        requestId: "same",
        text: "Once",
        workspacePath: null,
      });
      expect(again).toEqual(first);
      expect(
        (yield* call({ _tag: "ListMissions", isArchived: false, search: null, state: null, workspaceId: null }))
          .missions,
      ).toHaveLength(1);
    }).pipe(Effect.provide(live(databaseFile()))),
  );
});

describe("starting an empty quest in a realm", () => {
  it.effect("is called New quest and sits idle in the realm until its first message names it", () =>
    Effect.gen(function* () {
      const folder = mkdtempSync(join(tmpdir(), "iskios-realm-"));
      directories.push(folder);
      yield* call({ _tag: "CreateRealm", crest: null, name: "Garden", path: folder });
      const [realm] = (yield* realmList()).workspaces;
      const realmId = realm?.id ?? null;
      const started = yield* call({ _tag: "StartEmptyQuest", realmId, requestId: "e1" });
      const replayed = yield* call({ _tag: "StartEmptyQuest", realmId, requestId: "e1" });
      expect(replayed).toEqual(started);

      const listed = () =>
        call({ _tag: "ListMissions", isArchived: false, search: null, state: null, workspaceId: null });
      const [empty] = (yield* listed()).missions;
      expect(empty).toMatchObject({ id: started.missionId, state: "Idle", title: "New quest" });
      expect(empty?.workspaceId).toBe(realmId);
      expect((yield* read(started.missionId)).thread.workspace?.path).toBe(realm?.path);
      expect((yield* read(started.missionId)).messages).toHaveLength(0);

      yield* call({
        _tag: "SendMessage",
        attachmentIds: [],
        delivery: null,
        requestId: "e2",
        text: "Tidy the garden\nplease",
        threadId: started.threadId,
      });
      const [named] = (yield* listed()).missions;
      expect(named).toMatchObject({ id: started.missionId, title: "Tidy the garden" });
    }).pipe(Effect.provide(live(databaseFile()))),
  );
});

describe("starting an empty quest in a realm with no folder or in the Borderlands", () => {
  it.effect(
    "places it in the realm, with no folder to work in, or in the Borderlands, and refuses an unknown realm",
    () =>
      Effect.gen(function* () {
        yield* call({ _tag: "CreateRealm", crest: null, name: "Garden", path: null });
        const [realm] = (yield* realmList()).workspaces;
        const placed = yield* call({ _tag: "StartEmptyQuest", realmId: realm?.id ?? null, requestId: "f1" });
        const borderlands = yield* call({ _tag: "StartEmptyQuest", realmId: null, requestId: "f2" });
        const refused = yield* failureOf({ _tag: "StartEmptyQuest", realmId: "missing" as never, requestId: "f3" });
        expect(refused).toMatchObject({ kind: "InvalidInput", message: "No such realm." });

        const byId = new Map((yield* realmList()).missions.map((each) => [each.id, each]));
        expect(byId.get(placed.missionId)).toMatchObject({ workspaceId: realm?.id, workspaceName: "Garden" });
        expect(byId.get(borderlands.missionId)).toMatchObject({ workspaceId: null, workspaceName: null });
        // A realm with no folder gives its quests no workspace: they work in the quest's scratch folder.
        expect((yield* read(placed.missionId)).thread.workspace).toBeNull();
      }).pipe(Effect.provide(live(databaseFile()))),
  );
});

describe("follow-up messages", () => {
  it.effect("keep their order and, when queued, are answered together after the running turn", () =>
    Effect.gen(function* () {
      const started = yield* call({
        _tag: "StartMission",
        effort: "default",
        model: "default",
        requestId: "r1",
        text: "First",
        workspacePath: null,
      });
      yield* call({
        _tag: "SendMessage",
        delivery: "Queue",
        requestId: "r2",
        text: "Second",
        threadId: started.threadId,
      });
      yield* call({
        _tag: "SendMessage",
        delivery: "Queue",
        requestId: "r3",
        text: "Third",
        threadId: started.threadId,
      });

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
        effort: "default",
        model: "default",
        requestId: "r1",
        text: "One",
        workspacePath: null,
      });
      yield* advance(REPLY_DELAY);
      yield* call({ _tag: "SendMessage", delivery: null, requestId: "r2", text: "Two", threadId: started.threadId });
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
        delivery: null,
        requestId: "r1",
        text: "Hi",
        threadId: "missing" as never,
      });
      expect(failure.kind).toBe("NotFound");
    }).pipe(Effect.provide(live(databaseFile()))),
  );
});

describe("persisting missions", () => {
  it.effect("keeps missions and conversations after reopening the database", () =>
    Effect.gen(function* () {
      const filename = databaseFile();
      const started = yield* Effect.scoped(
        Effect.gen(function* () {
          const result = yield* call({
            _tag: "StartMission",
            effort: "default",
            model: "default",
            requestId: "r1",
            text: "Remember me",
            workspacePath: null,
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
