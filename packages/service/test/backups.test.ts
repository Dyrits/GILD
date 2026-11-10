import { describe, expect, it } from "@effect/vitest";
import type { BackupCompanion } from "@gild/contracts";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { call, fixture, open, read, send, settle, start } from "./fixtures/service.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});
const withService = <A, E, R>(body: Effect.Effect<A, E, R>) => {
  const value = fixture();
  fixtures.push(value);
  return body.pipe(Effect.provide(value.layer));
};

const codex: BackupCompanion = { accountId: null, effort: "default", harness: "codex", model: "gpt-5" };
const replies = (detail: { messages: ReadonlyArray<{ sender: string; text: string }> }) =>
  detail.messages.filter((message) => message.sender === "agent").map((message) => message.text);

describe("a thread's backup Companions", () => {
  it.live("are saved in order and shown in the thread's panel", () =>
    withService(
      Effect.gen(function* () {
        const { threadId } = yield* start("Hello");
        expect((yield* call({ _tag: "ReadThreadPanel", threadId })).backups).toEqual([]);
        yield* call({ _tag: "SetThreadBackups", backups: [codex], threadId });
        expect((yield* call({ _tag: "ReadThreadPanel", threadId })).backups).toEqual([codex]);
      }),
    ),
  );

  it.live("take over a failed turn, and the line says why", () =>
    withService(
      Effect.gen(function* () {
        const { missionId, threadId } = yield* start("Hello");
        yield* settle(missionId, (d) => d.thread.state === "Idle");
        yield* call({ _tag: "SetThreadBackups", backups: [codex], threadId });
        yield* send(threadId, "fail claude Usage limit reached\nrunner");
        const detail = yield* settle(missionId, (d) => replies(d).length === 2 && d.thread.state === "Idle");
        expect(replies(detail)[1]).toContain("codex/gpt-5");
        expect(detail.handovers.map((handover) => handover.text)).toEqual([
          expect.stringMatching(/^Fell back to Codex · gpt-5 · default effort · Usage limit reached/),
        ]);
      }),
    ),
  );

  it.live("leave a failed thread Failed when it has none", () =>
    withService(
      Effect.gen(function* () {
        const { missionId, threadId } = yield* start("fail claude no");
        yield* settle(missionId, (d) => d.thread.state === "Failed");
        expect((yield* read(missionId, threadId)).handovers).toEqual([]);
      }),
    ),
  );
});

describe("marking a side-quest done", () => {
  it.live("ends only the side-quest, and refuses the quest's own thread", () =>
    withService(
      Effect.gen(function* () {
        const { missionId, threadId } = yield* start("Hello");
        yield* settle(missionId, (d) => d.thread.state === "Idle");
        const opened = yield* open(threadId, "wait 2000");
        yield* call({ _tag: "MarkThreadDone", threadId: opened.threadId });
        const detail = yield* read(missionId, opened.threadId);
        expect(detail.thread.state).toBe("Done");
        expect((yield* read(missionId, threadId)).thread.state).toBe("Idle");
        const refusal = yield* call({ _tag: "MarkThreadDone", threadId }).pipe(Effect.flip);
        expect(String(refusal)).toContain("mark the quest done");
      }),
    ),
  );
});
