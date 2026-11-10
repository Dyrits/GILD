import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { call, fixture, read, send, settle, start } from "./fixtures/service.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

const withService = <A, E, R>(body: Effect.Effect<A, E, R>) => {
  const value = fixture();
  fixtures.push(value);
  return body.pipe(Effect.provide(value.layer));
};

/** The text of the thread's latest reply. */
const lastReplyOf = (detail: { messages: ReadonlyArray<{ sender: string; text: string }> }) =>
  detail.messages.filter((message) => message.sender === "agent").at(-1)?.text ?? "";

const idle = (detail: { thread: { state: string } }) => detail.thread.state === "Idle";

describe("handover: changing a thread's harness, account, model, or effort mid-thread", () => {
  it.live("a model and effort change keeps the harness session and applies from the next turn", () =>
    withService(
      Effect.gen(function* () {
        const started = yield* start("runner");
        const first = yield* settle(started.missionId, idle);
        const threadId = first.thread.id;
        expect(lastReplyOf(first)).toBe("Echo: claude/default/default/session none");
        yield* call({
          _tag: "ChangeThreadRunner",
          accountId: null,
          effort: "high",
          harness: "claude",
          model: "opus",
          threadId,
        });
        yield* send(threadId, "runner");
        const second = yield* settle(started.missionId, (d) => d.messages.length === 4 && idle(d));
        expect(lastReplyOf(second)).toBe(`Echo: claude/opus/high/session fake-${threadId}`);
        expect(second.thread.model).toBe("opus");
        expect(second.thread.effort).toBe("high");
        // Same session: no history is replayed.
        yield* send(threadId, "context");
        const third = yield* settle(started.missionId, (d) => d.messages.length === 6 && idle(d));
        expect(lastReplyOf(third)).not.toContain("Conversation so far");
      }),
    ),
  );

  it.live("a harness change starts a new session and gives the new harness the whole conversation", () =>
    withService(
      Effect.gen(function* () {
        const started = yield* start("Plan the work");
        const first = yield* settle(started.missionId, idle);
        const threadId = first.thread.id;
        yield* call({
          _tag: "ChangeThreadRunner",
          accountId: null,
          effort: "default",
          harness: "codex",
          model: "gpt-5",
          threadId,
        });
        yield* send(threadId, "runner\ncontext");
        const second = yield* settle(started.missionId, (d) => d.messages.length === 4 && idle(d));
        const reply = lastReplyOf(second);
        expect(reply).toContain("codex/gpt-5/default/session none");
        expect(reply).toContain("Conversation so far");
        expect(reply).toContain("Plan the work");
        expect(reply).toContain("Echo: Plan the work");
        // This turn's own message is the turn's text, not history.
        expect(reply.split("Conversation so far")[1]).not.toContain("runner");
        expect(second.thread.harness).toBe("codex");
        expect(second.thread.model).toBe("gpt-5");
      }),
    ),
  );

  it.live("each reply keeps the harness and model that wrote it", () =>
    withService(
      Effect.gen(function* () {
        const started = yield* call({
          _tag: "StartMission",
          effort: "default",
          model: "sonnet",
          requestId: crypto.randomUUID(),
          text: "Plan the work",
          workspacePath: null,
        });
        const first = yield* settle(started.missionId, idle);
        yield* call({
          _tag: "ChangeThreadRunner",
          accountId: null,
          effort: "default",
          harness: "codex",
          model: "gpt-5",
          threadId: first.thread.id,
        });
        yield* send(first.thread.id, "Carry on");
        yield* settle(started.missionId, (d) => d.messages.length === 4 && idle(d));
        yield* call({
          _tag: "ChangeThreadRunner",
          accountId: null,
          effort: "default",
          harness: "opencode",
          model: "default",
          threadId: first.thread.id,
        });
        yield* send(first.thread.id, "And again");
        const after = yield* settle(started.missionId, (d) => d.messages.length === 6 && idle(d));
        const replies = after.messages.filter((message) => message.sender === "agent");
        expect(replies.map((reply) => [reply.harness, reply.model])).toEqual([
          ["claude", "sonnet"],
          ["codex", "gpt-5"],
          ["opencode", null],
        ]);
        expect(after.messages.filter((message) => message.sender !== "agent").every((m) => m.harness === null)).toBe(
          true,
        );
      }),
    ),
  );

  it.live("a thread's first turn carries no history", () =>
    withService(
      Effect.gen(function* () {
        const started = yield* start("context");
        const first = yield* settle(started.missionId, idle);
        expect(lastReplyOf(first)).not.toContain("Conversation so far");
      }),
    ),
  );

  it.live("leaves a line in the conversation naming the new harness and model", () =>
    withService(
      Effect.gen(function* () {
        const started = yield* start("Hello");
        const first = yield* settle(started.missionId, idle);
        expect(first.handovers).toEqual([]);
        yield* call({
          _tag: "ChangeThreadRunner",
          accountId: null,
          effort: "default",
          harness: "opencode",
          model: "default",
          threadId: first.thread.id,
        });
        const after = yield* read(started.missionId);
        expect(after.handovers.map((handover) => handover.text)).toEqual([
          "Handed over to OpenCode · default model · default effort",
        ]);
      }),
    ),
  );

  it.live("changing nothing records nothing", () =>
    withService(
      Effect.gen(function* () {
        const started = yield* start("Hello");
        const first = yield* settle(started.missionId, idle);
        yield* call({
          _tag: "ChangeThreadRunner",
          accountId: null,
          effort: "default",
          harness: "claude",
          model: "default",
          threadId: first.thread.id,
        });
        expect((yield* read(started.missionId)).handovers).toEqual([]);
      }),
    ),
  );

  it.live("is refused while the thread is in a turn, and changes nothing", () =>
    withService(
      Effect.gen(function* () {
        const started = yield* start("wait 400");
        const running = yield* settle(started.missionId, (d) => d.thread.state === "Running");
        const refused = yield* call({
          _tag: "ChangeThreadRunner",
          accountId: null,
          effort: "default",
          harness: "codex",
          model: "default",
          threadId: running.thread.id,
        }).pipe(Effect.flip);
        expect(JSON.stringify(refused)).toContain("in a turn");
        expect((yield* read(started.missionId)).thread.harness).toBe("claude");
      }),
    ),
  );

  it.live("is refused for an account that does not belong to the chosen harness", () =>
    withService(
      Effect.gen(function* () {
        const started = yield* start("Hello");
        const first = yield* settle(started.missionId, idle);
        const refused = yield* call({
          _tag: "ChangeThreadRunner",
          accountId: crypto.randomUUID() as never,
          effort: "default",
          harness: "codex",
          model: "default",
          threadId: first.thread.id,
        }).pipe(Effect.flip);
        expect(JSON.stringify(refused)).toContain("No such Codex account");
        expect((yield* read(started.missionId)).thread.harness).toBe("claude");
      }),
    ),
  );

  it.live("a message kept for a stopped thread runs on the new runner once it resumes", () =>
    withService(
      Effect.gen(function* () {
        const started = yield* start("Hello");
        const first = yield* settle(started.missionId, idle);
        yield* call({
          _tag: "StopThread",
          threadId: first.thread.id,
        });
        yield* send(first.thread.id, "runner");
        yield* call({
          _tag: "ChangeThreadRunner",
          accountId: null,
          effort: "default",
          harness: "codex",
          model: "default",
          threadId: first.thread.id,
        });
        yield* call({ _tag: "ResumeThread", threadId: first.thread.id });
        const after = yield* settle(started.missionId, (d) => d.messages.length === 4 && idle(d));
        expect(lastReplyOf(after)).toContain("codex/default/default/session none");
      }),
    ),
  );

  it.live("a failed thread retries its message at once on the new runner", () =>
    withService(
      Effect.gen(function* () {
        const started = yield* start("fail claude not signed in\nrunner");
        const failed = yield* settle(started.missionId, (d) => d.thread.state === "Failed");
        yield* call({
          _tag: "ChangeThreadRunner",
          accountId: null,
          effort: "default",
          harness: "codex",
          model: "default",
          threadId: failed.thread.id,
        });
        const after = yield* settle(started.missionId, (d) => d.thread.state === "Idle");
        expect(lastReplyOf(after)).toContain("codex");
      }),
    ),
  );

  it.live("deleting a mission erases its handovers", () =>
    withService(
      Effect.gen(function* () {
        const started = yield* start("Hello");
        const first = yield* settle(started.missionId, idle);
        yield* call({
          _tag: "ChangeThreadRunner",
          accountId: null,
          effort: "default",
          harness: "codex",
          model: "default",
          threadId: first.thread.id,
        });
        const preview = yield* call({ _tag: "PreviewDeletion", threadId: first.thread.id });
        yield* call({ _tag: "DeleteThread", confirmation: preview.confirmation, threadId: first.thread.id });
        expect((yield* Effect.flip(read(started.missionId))).kind).toBe("NotFound");
      }),
    ),
  );
});
