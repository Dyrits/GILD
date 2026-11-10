import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { call, fixture, open, read, settle, start, tool } from "../fixtures/service.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
const setup = () => {
  const value = fixture();
  fixtures.push(value);
  return value;
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

describe("deleting threads", () => {
  it.live("previews a subtree and erases it after stopping its turns and withdrawing its questions", () =>
    Effect.gen(function* () {
      const started = yield* start("wait 5000");
      const branch = yield* open(started.threadId, "wait 5000");
      const leaf = yield* open(branch.threadId, 'ask {"action":"Push","command":"git push"}');
      yield* settle(started.missionId, (d) => d.thread.state === "Attention", leaf.threadId);
      yield* tool(started.threadId, "send_thread_message", { text: "Erase with receiver", to: branch.threadId });
      const preview = yield* call({ _tag: "PreviewDeletion", threadId: branch.threadId });
      expect(preview).toMatchObject({ descendantCount: 1, isMission: false, runningCount: 2 });
      yield* call({ _tag: "DeleteThread", confirmation: preview.confirmation, threadId: branch.threadId });
      const detail = yield* read(started.missionId);
      expect(detail.threads.map((t) => t.id)).toEqual([started.threadId]);
      expect(detail.thread.state).toBe("Running");
      expect(yield* call({ _tag: "ListOpenQuestions" })).toEqual([]);
      expect((yield* call({ _tag: "ReadPermissions", missionId: null })).history).toEqual([]);
      expect((yield* Effect.flip(read(started.missionId, leaf.threadId))).kind).toBe("NotFound");
      expect(yield* tool(branch.threadId, "open_thread", { request: "Must not return" })).toContain("Unknown thread");
    }).pipe(Effect.provide(setup().layer)),
  );
  it.live(
    "deletes a mission's scratch folder and permissions while preserving unrelated missions and global permissions",
    () => {
      const value = setup();
      return Effect.gen(function* () {
        const started = yield* start('ask {"action":"Push","command":"git push","pattern":"git push *"}');
        const question = (yield* settle(started.missionId, (d) => d.questions.length > 0)).questions[0];
        if (question === undefined) return yield* Effect.die("Missing question");
        yield* call({ _tag: "AnswerQuestion", answer: "AlwaysAllow", message: null, questionId: question.id });
        const other = yield* start('ask {"action":"Deploy","command":"deploy elsewhere"}');
        const global = (yield* settle(other.missionId, (d) => d.questions.length > 0)).questions[0];
        if (global === undefined) return yield* Effect.die("Missing question");
        yield* call({ _tag: "AnswerQuestion", answer: "AlwaysAllow", message: null, questionId: global.id });
        const permission = (yield* call({ _tag: "ReadPermissions", missionId: null })).permissions.find(
          (p) => p.missionId === other.missionId,
        );
        if (permission === undefined) return yield* Effect.die("Missing permission");
        yield* call({ _tag: "WidenPermission", permissionId: permission.id });
        yield* settle(started.missionId, (d) => d.thread.state === "Idle");
        const scratch = join(value.directory, "missions", started.missionId);
        expect(existsSync(scratch)).toBe(true);
        const preview = yield* call({ _tag: "PreviewDeletion", threadId: started.threadId });
        expect(preview).toMatchObject({ descendantCount: 0, isMission: true, runningCount: 0 });
        yield* call({ _tag: "DeleteThread", confirmation: preview.confirmation, threadId: started.threadId });
        expect(existsSync(scratch)).toBe(false);
        expect(
          (yield* call({
            _tag: "ListMissions",
            isArchived: false,
            search: null,
            state: null,
            workspaceId: null,
          })).missions.map((m) => m.id),
        ).toEqual([other.missionId]);
        expect((yield* call({ _tag: "ReadPermissions", missionId: null })).permissions.map((p) => p.id)).toEqual([
          permission.id,
        ]);
        expect((yield* Effect.flip(read(started.missionId))).kind).toBe("NotFound");
      }).pipe(Effect.provide(value.layer));
    },
  );

  it.live("never removes an attached workspace or its standing permissions", () => {
    const value = setup();
    const workspace = join(value.directory, "workspace");
    mkdirSync(workspace);
    writeFileSync(join(workspace, "keep.txt"), "Keep this");
    return Effect.gen(function* () {
      const started = yield* start('ask {"action":"Push","command":"git push"}', workspace);
      const question = (yield* settle(started.missionId, (d) => d.questions.length > 0)).questions[0];
      if (question === undefined) return yield* Effect.die("Missing question");
      yield* call({ _tag: "AnswerQuestion", answer: "AlwaysAllow", message: null, questionId: question.id });
      yield* settle(started.missionId, (d) => d.thread.state === "Idle");
      const preview = yield* call({ _tag: "PreviewDeletion", threadId: started.threadId });
      yield* call({ _tag: "DeleteThread", confirmation: preview.confirmation, threadId: started.threadId });
      expect(readFileSync(join(workspace, "keep.txt"), "utf8")).toBe("Keep this");
      expect((yield* call({ _tag: "ReadPermissions", missionId: null })).permissions).toHaveLength(1);
    }).pipe(Effect.provide(value.layer));
  });

  it.live("requires a fresh confirmation when the subtree grows after the preview", () =>
    Effect.gen(function* () {
      const started = yield* start("wait 5000");
      const preview = yield* call({ _tag: "PreviewDeletion", threadId: started.threadId });
      yield* open(started.threadId, "wait 5000");
      const failure = yield* Effect.flip(
        call({ _tag: "DeleteThread", confirmation: preview.confirmation, threadId: started.threadId }),
      );
      expect(failure.kind).toBe("StaleVersion");
      expect((yield* read(started.missionId)).threads).toHaveLength(2);
    }).pipe(Effect.provide(setup().layer)),
  );
  it.live("preserves a scratch folder that another mission has attached as its workspace", () => {
    const value = setup();
    return Effect.gen(function* () {
      const started = yield* start();
      yield* settle(started.missionId, (d) => d.thread.state === "Idle");
      const scratch = join(value.directory, "missions", started.missionId);
      writeFileSync(join(scratch, "keep.txt"), "Workspace data");
      const other = yield* start("Hello", scratch);
      yield* settle(other.missionId, (d) => d.thread.state === "Idle");
      const preview = yield* call({ _tag: "PreviewDeletion", threadId: started.threadId });
      yield* call({ _tag: "DeleteThread", confirmation: preview.confirmation, threadId: started.threadId });
      expect(readFileSync(join(scratch, "keep.txt"), "utf8")).toBe("Workspace data");
      expect((yield* read(other.missionId)).thread.workspace?.isMissing).toBe(false);
    }).pipe(Effect.provide(value.layer));
  });
});
