import { describe, expect, it } from "@effect/vitest";
import type { ThreadId } from "@openmission/contracts";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { call, fixture, open, read, send, settle, start, tool } from "./fixtures/batch7.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
const live = () => {
  const value = fixture();
  fixtures.push(value);
  return value.layer;
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});
const message = (from: ThreadId, to: ThreadId, text = "Thread message") =>
  tool(from, "send_thread_message", { text, to });
const pair = Effect.gen(function* () {
  // Waiting for the fake's approval question proves that its turn has entered the harness,
  // rather than merely having a Running row reserved by admission.
  const request = 'ask {"action":"Start the check","command":"check readiness"}\nwait 5000';
  const started = yield* start(request);
  const child = yield* open(started.threadId, request);
  for (const id of [started.threadId, child.threadId]) {
    const detail = yield* settle(started.missionId, (d) => d.questions.some((q) => q.outcome === null), id);
    const question = detail.questions.find((q) => q.outcome === null);
    if (question === undefined) return yield* Effect.die("Missing readiness question");
    yield* call({ _tag: "AnswerQuestion", answer: "Deny", message: null, questionId: question.id });
  }
  return { ...started, childId: child.threadId };
});

describe("guarding against chatter", () => {
  it.live("pauses both threads on their twentieth message and keeps further messages undelivered", () =>
    Effect.gen(function* () {
      const { missionId, threadId, childId } = yield* pair;
      for (let i = 0; i < 19; i++) yield* message(i % 2 === 0 ? threadId : childId, i % 2 === 0 ? childId : threadId);
      expect((yield* read(missionId)).thread.state).toBe("Running");
      yield* message(childId, threadId, "Twentieth");
      const detail = yield* read(missionId);
      expect(detail.threads.map((t) => t.state)).toEqual(["Attention", "Attention"]);
      expect(detail.chatter).toHaveLength(1);
      expect(detail.chatter[0]?.count).toBe(20);
      yield* message(threadId, childId, "Kept after the threshold");
      const paused = yield* read(missionId, childId);
      expect(paused.thread.waitingCount).toBe(1);
      expect(paused.messages.some((m) => m.text === "Kept after the threshold")).toBe(true);
      yield* Effect.sleep("50 millis");
      expect((yield* read(missionId)).thread.state).toBe("Attention");
    }).pipe(Effect.provide(live())),
  );
  it.live("uses the adjustable threshold and rejects values below two", () =>
    Effect.gen(function* () {
      const settings = yield* call({ _tag: "ReadSettings" });
      expect(settings.chatterThreshold).toBe(20);
      const failure = yield* Effect.flip(
        call({ _tag: "UpdateSettings", settings: { ...settings, chatterThreshold: 1 } }),
      );
      expect(failure.kind).toBe("InvalidInput");
      yield* call({ _tag: "UpdateSettings", settings: { ...settings, chatterThreshold: 2 } });
      const { missionId, threadId, childId } = yield* pair;
      yield* message(threadId, childId);
      expect((yield* read(missionId)).chatter).toHaveLength(0);
      yield* message(childId, threadId);
      expect((yield* read(missionId)).chatter[0]?.count).toBe(2);
    }).pipe(Effect.provide(live())),
  );

  it.live("resets exchanges on an owner message to either participant without resetting other pairs", () =>
    Effect.gen(function* () {
      const settings = yield* call({ _tag: "ReadSettings" });
      yield* call({ _tag: "UpdateSettings", settings: { ...settings, chatterThreshold: 3 } });
      const { missionId, threadId, childId } = yield* pair;
      const other = yield* open(threadId, "wait 5000");
      yield* message(threadId, other.threadId);
      yield* message(other.threadId, threadId);
      yield* message(threadId, childId);
      yield* message(childId, threadId);
      yield* send(childId, "Owner resets only this participant");
      yield* message(threadId, childId);
      expect((yield* read(missionId)).chatter).toHaveLength(0);
      yield* message(threadId, other.threadId);
      expect((yield* read(missionId)).chatter).toHaveLength(1);
      yield* send(threadId, "Owner resets every pair involving this participant");
      yield* message(childId, threadId);
      expect((yield* read(missionId, childId)).chatter).toHaveLength(0);
    }).pipe(Effect.provide(live())),
  );

  it.live("resets a pair on its result and does not count the result as a message", () =>
    Effect.gen(function* () {
      const settings = yield* call({ _tag: "ReadSettings" });
      yield* call({ _tag: "UpdateSettings", settings: { ...settings, chatterThreshold: 2 } });
      const { missionId, threadId, childId } = yield* pair;
      yield* message(threadId, childId);
      yield* tool(childId, "report_result", { result: "Finished" });
      yield* message(childId, threadId);
      expect((yield* read(missionId)).chatter).toHaveLength(0);
      yield* message(threadId, childId);
      expect((yield* read(missionId)).chatter[0]?.count).toBe(2);
    }).pipe(Effect.provide(live())),
  );

  it.live("continues both threads with the kept messages and starts a fresh count", () =>
    Effect.gen(function* () {
      const settings = yield* call({ _tag: "ReadSettings" });
      yield* call({ _tag: "UpdateSettings", settings: { ...settings, chatterThreshold: 2 } });
      const { missionId, threadId, childId } = yield* pair;
      yield* message(threadId, childId, "Before");
      yield* message(childId, threadId, "At threshold");
      yield* message(threadId, childId, "Kept for child");
      const notice = (yield* read(missionId)).chatter[0];
      if (notice === undefined) return yield* Effect.die("Missing pause");
      yield* call({ _tag: "ResolveChatter", choice: "Continue", id: notice.id });
      const parent = yield* settle(missionId, (d) => d.thread.state === "Idle");
      const child = yield* settle(missionId, (d) => d.thread.state === "Idle", childId);
      expect(parent.chatter).toHaveLength(0);
      expect(parent.messages.some((m) => m.sender === "agent" && m.text.includes("At threshold"))).toBe(true);
      expect(child.messages.some((m) => m.sender === "agent" && m.text.includes("Kept for child"))).toBe(true);
      yield* message(threadId, childId);
      expect((yield* read(missionId)).chatter).toHaveLength(0);
      yield* message(childId, threadId);
      expect((yield* read(missionId)).chatter).toHaveLength(1);
      expect((yield* Effect.flip(call({ _tag: "ResolveChatter", choice: "Continue", id: notice.id }))).kind).toBe(
        "InvalidInput",
      );
    }).pipe(Effect.provide(live())),
  );

  it.live("stops both threads with their messages kept until explicit resume", () =>
    Effect.gen(function* () {
      const settings = yield* call({ _tag: "ReadSettings" });
      yield* call({ _tag: "UpdateSettings", settings: { ...settings, chatterThreshold: 2 } });
      const { missionId, threadId, childId } = yield* pair;
      yield* message(threadId, childId);
      yield* message(childId, threadId, "Keep for parent");
      const notice = (yield* read(missionId)).chatter[0];
      if (notice === undefined) return yield* Effect.die("Missing pause");
      yield* call({ _tag: "ResolveChatter", choice: "Stop", id: notice.id });
      const stopped = yield* read(missionId);
      expect(stopped.threads.map((t) => t.state)).toEqual(["Stopped", "Stopped"]);
      expect(stopped.thread.waitingCount).toBe(1);
      expect(stopped.chatter).toHaveLength(0);
      yield* call({ _tag: "ResumeThread", threadId });
      const resumed = yield* settle(missionId, (d) => d.thread.state === "Idle");
      expect(resumed.messages.some((m) => m.sender === "agent" && m.text.includes("Keep for parent"))).toBe(true);
      expect(resumed.threads.find((t) => t.id === childId)?.state).toBe("Stopped");
    }).pipe(Effect.provide(live())),
  );

  it.live("trips once when simultaneous sends cross the threshold and retains both messages", () =>
    Effect.gen(function* () {
      const settings = yield* call({ _tag: "ReadSettings" });
      yield* call({ _tag: "UpdateSettings", settings: { ...settings, chatterThreshold: 2 } });
      const { missionId, threadId, childId } = yield* pair;
      yield* message(threadId, childId);
      yield* Effect.all([message(threadId, childId, "Concurrent A"), message(childId, threadId, "Concurrent B")], {
        concurrency: "unbounded",
      });
      const parent = yield* read(missionId);
      const child = yield* read(missionId, childId);
      expect(parent.chatter).toHaveLength(1);
      expect(parent.chatter[0]?.id).toBe(child.chatter[0]?.id);
      expect(parent.chatter[0]?.count).toBe(2);
      expect(parent.thread.waitingCount + child.thread.waitingCount).toBe(2);
    }).pipe(Effect.provide(live())),
  );
  it.live("keeps an existing pause until its explicit decision even after an owner message or individual Stop", () =>
    Effect.gen(function* () {
      const settings = yield* call({ _tag: "ReadSettings" });
      yield* call({ _tag: "UpdateSettings", settings: { ...settings, chatterThreshold: 2 } });
      const { missionId, threadId, childId } = yield* pair;
      yield* message(threadId, childId);
      yield* message(childId, threadId);
      const notice = (yield* read(missionId)).chatter[0];
      if (notice === undefined) return yield* Effect.die("Missing pause");
      yield* send(threadId, "New instructions");
      expect((yield* read(missionId)).thread.state).toBe("Attention");
      yield* call({ _tag: "StopThread", threadId });
      expect((yield* Effect.flip(call({ _tag: "ResumeThread", threadId }))).kind).toBe("InvalidInput");
      expect((yield* read(missionId)).thread.state).toBe("Stopped");
      yield* call({ _tag: "ResolveChatter", choice: "Stop", id: notice.id });
      yield* call({ _tag: "ResumeThread", threadId });
      const detail = yield* settle(missionId, (d) => d.thread.state === "Idle");
      expect(detail.messages.some((m) => m.sender === "agent" && m.text.includes("New instructions"))).toBe(true);
    }).pipe(Effect.provide(live())),
  );
});
