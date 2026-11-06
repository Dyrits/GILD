import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import type { MissionDetail, MissionId, Request, RequestTag, ResultOf } from "@openmission/contracts";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { fakeHarnessLayer, Service, serviceLayer } from "../src/index.ts";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

/** A service with folders to choose as workspaces, and its data beside them. */
const setUp = () => {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "openmission-workspaces-")));
  directories.push(base);
  const home = join(base, "home");
  const outside = join(base, "outside");
  for (const folder of [home, join(home, "app"), join(home, "app", "lib"), join(home, ".hidden"), outside]) {
    mkdirSync(folder, { recursive: true });
  }
  const layer = serviceLayer({
    filename: join(base, "openmission.sqlite"),
    harness: fakeHarnessLayer("10 millis"),
    homeFolder: home,
    scratchRoot: join(base, "data", "missions"),
  });
  return { base, home, layer, outside };
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

const read = (missionId: MissionId) => call({ _tag: "ReadMission", missionId, threadId: null });

const settle = (missionId: MissionId, check: (detail: MissionDetail) => boolean) =>
  Effect.gen(function* () {
    for (let i = 0; i < 300; i++) {
      const detail = yield* read(missionId);
      if (check(detail)) return detail;
      yield* Effect.sleep("10 millis");
    }
    return yield* Effect.die(new Error(`mission did not settle: ${JSON.stringify(yield* read(missionId))}`));
  });

const repliedWith = (count: number) => (detail: MissionDetail) =>
  detail.messages.filter((message) => message.sender === "agent").length === count &&
  (detail.thread.state === "Idle" || detail.thread.state === "Failed");
const isAsking = (detail: MissionDetail) => detail.questions.some((question) => question.outcome === null);
const lastReply = (detail: MissionDetail) => detail.messages.at(-1)?.text ?? "";

let requestCount = 0;
const start = (text: string, workspacePath: string | null) =>
  call({
    _tag: "StartMission",
    effort: "default",
    model: "default",
    requestId: `start-${++requestCount}`,
    text,
    workspacePath,
  });

const push = {
  action: "Push the branch",
  command: "git push origin main",
  pattern: "git push *",
  permission: "Push code",
};
const ask = `ask ${JSON.stringify(push)}`;

describe("browsing folders for the phone", () => {
  it.live("starts the browsable roots with the home folder", () => {
    const { home, layer } = setUp();
    return Effect.gen(function* () {
      const roots = yield* call({ _tag: "BrowseFolders", path: null, shouldIncludeHidden: false });
      expect(roots.folders.map((folder) => folder.path)).toEqual([home]);
    }).pipe(Effect.provide(layer));
  });

  it.live("lists a folder's visible subfolders and its parent below the root", () => {
    const { home, layer } = setUp();
    return Effect.gen(function* () {
      const listing = yield* call({ _tag: "BrowseFolders", path: home, shouldIncludeHidden: false });
      expect(listing).toMatchObject({ parent: null, path: home });
      expect(listing.folders.map((folder) => folder.name)).toEqual(["app"]);

      const inner = yield* call({ _tag: "BrowseFolders", path: join(home, "app"), shouldIncludeHidden: false });
      expect(inner.parent).toBe(home);
      expect(inner.folders.map((folder) => folder.name)).toEqual(["lib"]);
    }).pipe(Effect.provide(layer));
  });

  it.live("lists hidden folders only when asked", () => {
    const { home, layer } = setUp();
    return Effect.gen(function* () {
      const listing = yield* call({ _tag: "BrowseFolders", path: home, shouldIncludeHidden: true });
      expect(listing.folders.map((folder) => folder.name)).toEqual([".hidden", "app"]);
    }).pipe(Effect.provide(layer));
  });

  it.live("refuses folders outside the roots, including through a link", () => {
    const { home, layer, outside } = setUp();
    symlinkSync(outside, join(home, "shortcut"));
    return Effect.gen(function* () {
      const refused = yield* failureOf({ _tag: "BrowseFolders", path: outside, shouldIncludeHidden: false });
      expect(refused.kind).toBe("InvalidInput");
      const linked = yield* failureOf({
        _tag: "BrowseFolders",
        path: join(home, "shortcut"),
        shouldIncludeHidden: false,
      });
      expect(linked.message).toContain("outside the browsable roots");
    }).pipe(Effect.provide(layer));
  });

  it.live("adds a root, after which its folders can be browsed", () => {
    const { home, layer, outside } = setUp();
    return Effect.gen(function* () {
      const roots = yield* call({ _tag: "AddBrowsableRoot", path: outside });
      expect(roots.folders.map((folder) => folder.path)).toEqual([home, outside]);
      const listing = yield* call({ _tag: "BrowseFolders", path: outside, shouldIncludeHidden: false });
      expect(listing.path).toBe(outside);
    }).pipe(Effect.provide(layer));
  });

  it.live("refuses to add a root that is not an existing folder", () => {
    const { layer, outside } = setUp();
    return Effect.gen(function* () {
      const missing = yield* failureOf({ _tag: "AddBrowsableRoot", path: join(outside, "nothing") });
      expect(missing.kind).toBe("InvalidInput");
    }).pipe(Effect.provide(layer));
  });

  it.live("makes a new folder under a root", () => {
    const { home, layer } = setUp();
    return Effect.gen(function* () {
      const made = yield* call({ _tag: "CreateFolder", name: "notes", parent: home });
      expect(made).toEqual({ name: "notes", path: join(home, "notes") });
      const listing = yield* call({ _tag: "BrowseFolders", path: home, shouldIncludeHidden: false });
      expect(listing.folders.map((folder) => folder.name)).toEqual(["app", "notes"]);
    }).pipe(Effect.provide(layer));
  });

  it.live("refuses a new folder name with a slash", () => {
    const { home, layer } = setUp();
    return Effect.gen(function* () {
      const refused = yield* failureOf({ _tag: "CreateFolder", name: "../escape", parent: home });
      expect(refused.kind).toBe("InvalidInput");
    }).pipe(Effect.provide(layer));
  });
});

describe("starting a mission in a workspace", () => {
  it.live("makes the folder a workspace on first choice and reuses it for the next mission", () => {
    const { home, layer } = setUp();
    const app = join(home, "app");
    return Effect.gen(function* () {
      const first = yield* start("Fix the build", app);
      const second = yield* start("Add a feature", app);
      const one = yield* read(first.missionId);
      const two = yield* read(second.missionId);
      expect(one.thread.workspace).toMatchObject({ isMissing: false, name: "app", path: app });
      expect(two.thread.workspace?.id).toBe(one.thread.workspace?.id);
      expect(one.mission.workspaceName).toBe("app");
    }).pipe(Effect.provide(layer));
  });

  it.live("accepts any existing folder, chosen through the system's folder dialog", () => {
    const { layer, outside } = setUp();
    return Effect.gen(function* () {
      const started = yield* start("Work there", outside);
      const detail = yield* read(started.missionId);
      expect(detail.thread.workspace).toMatchObject({ name: "outside", path: outside });
    }).pipe(Effect.provide(layer));
  });

  it.live("refuses a path that is not an existing folder and saves nothing", () => {
    const { layer, outside } = setUp();
    return Effect.gen(function* () {
      const refused = yield* failureOf({
        _tag: "StartMission",
        effort: "default",
        model: "default",
        requestId: "missing",
        text: "Work there",
        workspacePath: join(outside, "nothing"),
      });
      expect(refused.kind).toBe("InvalidInput");
      expect(
        (yield* call({ _tag: "ListMissions", isArchived: false, search: null, state: null, workspaceId: null }))
          .missions,
      ).toHaveLength(0);
    }).pipe(Effect.provide(layer));
  });

  it.live("runs the thread in the workspace folder, with a context naming it and carrying its instructions", () => {
    const { home, layer } = setUp();
    const app = join(home, "app");
    writeFileSync(join(app, "AGENTS.md"), "Run bun run test before committing.");
    writeFileSync(join(app, "CLAUDE.md"), "Prefer small commits.");
    return Effect.gen(function* () {
      const started = yield* start("cwd\ncontext", app);
      const detail = yield* settle(started.missionId, repliedWith(1));
      const reply = lastReply(detail);
      expect(reply).toContain(`Echo: ${app} | `);
      expect(reply).toContain(`You work in the workspace "app" at ${app}.`);
      expect(reply).toContain("## AGENTS.md\nRun bun run test before committing.");
      expect(reply).toContain("## CLAUDE.md\nPrefer small commits.");
    }).pipe(Effect.provide(layer));
  });

  it.live("cuts a long instruction file and says so", () => {
    const { home, layer } = setUp();
    const app = join(home, "app");
    writeFileSync(join(app, "AGENTS.md"), "a".repeat(60_000));
    return Effect.gen(function* () {
      const started = yield* start("context", app);
      const reply = lastReply(yield* settle(started.missionId, repliedWith(1)));
      expect(reply).toContain(`${"a".repeat(50_000)}\n[cut: the file is longer]`);
      expect(reply).not.toContain("a".repeat(50_001));
    }).pipe(Effect.provide(layer));
  });

  it.live("runs a mission with no workspace in its scratch folder and says so", () => {
    const { base, layer } = setUp();
    return Effect.gen(function* () {
      const started = yield* start("cwd\ncontext", null);
      const detail = yield* settle(started.missionId, repliedWith(1));
      const scratch = join(base, "data", "missions", started.missionId);
      expect(lastReply(detail)).toContain(`Echo: ${scratch} | `);
      expect(lastReply(detail)).toContain("You have no workspace.");
      expect(detail.thread.workspace).toBeNull();
    }).pipe(Effect.provide(layer));
  });

  it.live("sends the thread to Attention with Retry when the workspace folder is gone, keeping the message", () => {
    const { home, layer } = setUp();
    const gone = join(home, "gone");
    mkdirSync(gone);
    return Effect.gen(function* () {
      const started = yield* start("Hello", gone);
      yield* settle(started.missionId, repliedWith(1));
      rmSync(gone, { recursive: true });
      yield* call({
        _tag: "SendMessage",
        delivery: null,
        requestId: "again",
        text: "Again",
        threadId: started.threadId,
      });
      const detail = yield* settle(started.missionId, (current) => current.thread.state === "Attention");
      expect(detail.thread.blocker).toBe("MissingWorkspace");
      expect(detail.thread.workspace?.isMissing).toBe(true);
      expect(detail.mission.state).toBe("Attention");
      yield* Effect.sleep("50 millis");
      expect((yield* read(started.missionId)).messages.filter((m) => m.sender === "agent")).toHaveLength(1);
    }).pipe(Effect.provide(layer));
  });

  it.live("runs the waiting messages on Retry once the folder is back", () => {
    const { home, layer } = setUp();
    const gone = join(home, "gone");
    mkdirSync(gone);
    return Effect.gen(function* () {
      const started = yield* start("Hello", gone);
      yield* settle(started.missionId, repliedWith(1));
      rmSync(gone, { recursive: true });
      yield* call({
        _tag: "SendMessage",
        delivery: null,
        requestId: "again",
        text: "Again",
        threadId: started.threadId,
      });
      yield* call({ _tag: "SendMessage", delivery: null, requestId: "more", text: "More", threadId: started.threadId });
      yield* settle(started.missionId, (current) => current.thread.state === "Attention");
      mkdirSync(gone);
      yield* call({ _tag: "RetryThread", threadId: started.threadId });
      const detail = yield* settle(started.missionId, repliedWith(2));
      expect(lastReply(detail)).toBe("Echo: Again\n\nMore");
      expect(detail.thread).toMatchObject({ blocker: null, state: "Idle" });
    }).pipe(Effect.provide(layer));
  });

  it.live("stays in Attention when Retry finds the folder still missing", () => {
    const { home, layer } = setUp();
    const gone = join(home, "gone");
    mkdirSync(gone);
    return Effect.gen(function* () {
      const started = yield* start("Hello", gone);
      yield* settle(started.missionId, repliedWith(1));
      rmSync(gone, { recursive: true });
      yield* call({
        _tag: "SendMessage",
        delivery: null,
        requestId: "again",
        text: "Again",
        threadId: started.threadId,
      });
      yield* settle(started.missionId, (current) => current.thread.state === "Attention");
      yield* call({ _tag: "RetryThread", threadId: started.threadId });
      const detail = yield* settle(started.missionId, (current) => current.thread.state === "Attention");
      expect(detail.thread.blocker).toBe("MissingWorkspace");
      expect(detail.messages.filter((m) => m.sender === "agent")).toHaveLength(1);
    }).pipe(Effect.provide(layer));
  });

  it.live("refuses Retry for a thread that is not waiting on its folder", () => {
    const { home, layer } = setUp();
    return Effect.gen(function* () {
      const started = yield* start("Hello", join(home, "app"));
      yield* settle(started.missionId, repliedWith(1));
      const refused = yield* failureOf({ _tag: "RetryThread", threadId: started.threadId });
      expect(refused.kind).toBe("InvalidInput");
    }).pipe(Effect.provide(layer));
  });

  it.live("keeps a thread waiting on its missing folder in Attention after a restart", () => {
    const { home, layer } = setUp();
    const gone = join(home, "gone");
    mkdirSync(gone);
    const begin = Effect.gen(function* () {
      const started = yield* start("Hello", gone);
      yield* settle(started.missionId, repliedWith(1));
      rmSync(gone, { recursive: true });
      yield* call({
        _tag: "SendMessage",
        delivery: null,
        requestId: "again",
        text: "Again",
        threadId: started.threadId,
      });
      yield* settle(started.missionId, (current) => current.thread.state === "Attention");
      return started;
    }).pipe(Effect.provide(layer));
    return Effect.gen(function* () {
      const started = yield* begin;
      const detail = yield* read(started.missionId).pipe(Effect.provide(layer));
      expect(detail.thread).toMatchObject({ blocker: "MissingWorkspace", state: "Attention" });
    });
  });

  it.live("clears the wait on Stop", () => {
    const { home, layer } = setUp();
    const gone = join(home, "gone");
    mkdirSync(gone);
    return Effect.gen(function* () {
      const started = yield* start("Hello", gone);
      yield* settle(started.missionId, repliedWith(1));
      rmSync(gone, { recursive: true });
      yield* call({
        _tag: "SendMessage",
        delivery: null,
        requestId: "again",
        text: "Again",
        threadId: started.threadId,
      });
      yield* settle(started.missionId, (current) => current.thread.state === "Attention");
      yield* call({ _tag: "StopThread", threadId: started.threadId });
      const detail = yield* read(started.missionId);
      expect(detail.thread).toMatchObject({ blocker: null, state: "Stopped" });
    }).pipe(Effect.provide(layer));
  });
});

/** Starts a mission in the folder whose question gets Always allow, and returns the saved permission. */
const alwaysAllowIn = (folder: string) =>
  Effect.gen(function* () {
    const first = yield* start(ask, folder);
    const asking = yield* settle(first.missionId, isAsking);
    const question = asking.questions.find((item) => item.outcome === null);
    if (question === undefined) return yield* Effect.die(new Error("no open question"));
    yield* call({ _tag: "AnswerQuestion", answer: "AlwaysAllow", message: null, questionId: question.id });
    yield* settle(first.missionId, repliedWith(1));
    return { asking, permission: (yield* call({ _tag: "ReadPermissions", missionId: null })).permissions[0] };
  });

describe("standing permissions in a workspace", () => {
  it.live("are saved for the workspace and spare later missions in it", () => {
    const { home, layer } = setUp();
    const app = join(home, "app");
    return Effect.gen(function* () {
      const { asking, permission } = yield* alwaysAllowIn(app);
      expect(permission).toMatchObject({
        missionId: null,
        pattern: "git push *",
        workspaceId: asking.thread.workspace?.id,
        workspaceName: "app",
      });
      const sameWorkspace = yield* start(ask, app);
      const spared = yield* settle(sameWorkspace.missionId, repliedWith(1));
      expect(spared.questions[0]?.outcome).toBe("AllowedByPermission");
    }).pipe(Effect.provide(layer));
  });

  it.live("do not apply in a nested workspace or a scratch folder", () => {
    const { home, layer } = setUp();
    const app = join(home, "app");
    return Effect.gen(function* () {
      yield* alwaysAllowIn(app);
      const nested = yield* start(ask, join(app, "lib"));
      expect((yield* settle(nested.missionId, isAsking)).questions[0]?.outcome).toBeNull();
      const scratch = yield* start(ask, null);
      expect((yield* settle(scratch.missionId, isAsking)).questions[0]?.outcome).toBeNull();
    }).pipe(Effect.provide(layer));
  });
});
