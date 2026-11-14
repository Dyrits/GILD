import { describe, expect, it } from "@effect/vitest";
import { AccountId, type BackupCompanion, type Tier } from "@iskios/contracts";
import { Effect, Schema } from "effect";
import { call, read, send, settle, start, withService } from "../fixtures/service.ts";

const codex: BackupCompanion = { accountId: null, effort: "default", harness: "codex", model: "gpt-5" };
const opencode: BackupCompanion = { accountId: null, effort: "default", harness: "opencode", model: "opencode/big" };
const heavy: Tier = { accountId: null, backups: [codex], effort: "high", harness: "claude", model: "opus" };

describe("choosing a preset on a thread", () => {
  it.live("falls back through the copied stack when the primary fails", () =>
    withService(
      Effect.gen(function* () {
        const { missionId, threadId } = yield* start("Hello");
        yield* settle(missionId, (detail) => detail.thread.state === "Idle");
        yield* call({ _tag: "ChangeThreadRunner", ...heavy, threadId });
        yield* send(threadId, "fail claude Usage limit reached\nrunner");
        const detail = yield* settle(
          missionId,
          (detail) => detail.thread.harness === "codex" && detail.thread.state === "Idle",
        );
        expect(detail.thread.model).toBe(codex.model);
        expect(detail.handovers.some((line) => line.text.startsWith("Fell back to Codex"))).toBe(true);
      }),
    ),
  );

  it.live("hands the thread over and replaces its backups in one step", () =>
    withService(
      Effect.gen(function* () {
        const { missionId, threadId } = yield* start("Hello");
        yield* settle(missionId, (detail) => detail.thread.state === "Idle");
        yield* call({ _tag: "SetThreadBackups", backups: [opencode], threadId });
        yield* call({
          _tag: "ChangeThreadRunner",
          accountId: null,
          backups: heavy.backups,
          effort: heavy.effort,
          harness: heavy.harness,
          model: heavy.model,
          threadId,
        });
        expect((yield* call({ _tag: "ReadThreadPanel", threadId })).backups).toEqual([codex]);
        expect((yield* read(missionId, threadId)).thread.model).toBe("opus");
      }),
    ),
  );

  it.live("replaces the backups even when the Companion is already the thread's", () =>
    withService(
      Effect.gen(function* () {
        const { missionId, threadId } = yield* start("Hello");
        const detail = yield* settle(missionId, (detail) => detail.thread.state === "Idle");
        yield* call({
          _tag: "ChangeThreadRunner",
          accountId: detail.thread.accountId,
          backups: [codex],
          effort: detail.thread.effort,
          harness: detail.thread.harness,
          model: detail.thread.model,
          threadId,
        });
        expect((yield* call({ _tag: "ReadThreadPanel", threadId })).backups).toEqual([codex]);
      }),
    ),
  );

  it.live("leaves the backups as they are when changing only the primary by hand", () =>
    withService(
      Effect.gen(function* () {
        const { missionId, threadId } = yield* start("Hello");
        yield* settle(missionId, (detail) => detail.thread.state === "Idle");
        yield* call({ _tag: "SetThreadBackups", backups: [opencode], threadId });
        yield* call({
          _tag: "ChangeThreadRunner",
          accountId: null,
          effort: "high",
          harness: "claude",
          model: "opus",
          threadId,
        });
        expect((yield* call({ _tag: "ReadThreadPanel", threadId })).backups).toEqual([opencode]);
      }),
    ),
  );

  it.live("clears previous backups when a preset has none", () =>
    withService(
      Effect.gen(function* () {
        const { missionId, threadId } = yield* start("Hello");
        const detail = yield* settle(missionId, (detail) => detail.thread.state === "Idle");
        yield* call({ _tag: "SetThreadBackups", backups: [opencode], threadId });
        yield* call({
          _tag: "ChangeThreadRunner",
          accountId: detail.thread.accountId,
          backups: [],
          effort: detail.thread.effort,
          harness: detail.thread.harness,
          model: detail.thread.model,
          threadId,
        });
        expect((yield* call({ _tag: "ReadThreadPanel", threadId })).backups).toEqual([]);
        expect((yield* read(missionId, threadId)).handovers).toEqual([]);
      }),
    ),
  );

  it.live("opens a side-quest with the chosen stack instead of inheriting the parent's backups", () =>
    withService(
      Effect.gen(function* () {
        const { missionId, threadId } = yield* start("Hello");
        yield* settle(missionId, (detail) => detail.thread.state === "Idle");
        yield* call({ _tag: "SetThreadBackups", backups: [opencode], threadId });
        const opened = yield* call({
          _tag: "OpenThread",
          ...heavy,
          parentThreadId: threadId,
          requestId: crypto.randomUUID(),
          shouldStartAnyway: true,
          text: "Hello",
        });
        expect((yield* call({ _tag: "ReadThreadPanel", threadId: opened.threadId })).backups).toEqual([codex]);
        expect((yield* call({ _tag: "ReadThreadPanel", threadId })).backups).toEqual([opencode]);
      }),
    ),
  );

  it.live("leaves a side-quest's backups as they are when the preset it used changes later", () =>
    withService(
      Effect.gen(function* () {
        const { missionId, threadId } = yield* start("Hello");
        yield* settle(missionId, (detail) => detail.thread.state === "Idle");
        const opened = yield* call({
          _tag: "OpenThread",
          ...heavy,
          parentThreadId: threadId,
          requestId: crypto.randomUUID(),
          shouldStartAnyway: true,
          text: "Hello",
        });
        yield* call({ _tag: "ChangeSettings", change: { tiers: { Heavy: { ...heavy, backups: [] } } } });
        expect((yield* call({ _tag: "ReadThreadPanel", threadId: opened.threadId })).backups).toEqual([codex]);
      }),
    ),
  );

  it.live("opens a side-quest without inherited backups when the chosen preset has none", () =>
    withService(
      Effect.gen(function* () {
        const { missionId, threadId } = yield* start("Hello");
        yield* settle(missionId, (detail) => detail.thread.state === "Idle");
        yield* call({ _tag: "SetThreadBackups", backups: [opencode], threadId });
        const opened = yield* call({
          _tag: "OpenThread",
          ...heavy,
          backups: [],
          parentThreadId: threadId,
          requestId: crypto.randomUUID(),
          shouldStartAnyway: true,
          text: "Hello",
        });
        expect((yield* call({ _tag: "ReadThreadPanel", threadId: opened.threadId })).backups).toEqual([]);
        expect((yield* call({ _tag: "ReadThreadPanel", threadId })).backups).toEqual([opencode]);
      }),
    ),
  );

  it.live("applies to a running thread too: its backups and runner, for the next turn", () =>
    withService(
      Effect.gen(function* () {
        const { threadId } = yield* start("wait 3000");
        yield* call({
          _tag: "ChangeThreadRunner",
          accountId: null,
          backups: [codex],
          effort: "high",
          harness: "claude",
          model: "opus",
          threadId,
        });
        expect((yield* call({ _tag: "ReadThreadPanel", threadId })).backups).toEqual([codex]);
      }),
    ),
  );

  it.live("changes nothing when a backup names an account that does not exist", () =>
    withService(
      Effect.gen(function* () {
        const { missionId, threadId } = yield* start("Hello");
        yield* settle(missionId, (detail) => detail.thread.state === "Idle");
        yield* call({ _tag: "SetThreadBackups", backups: [opencode], threadId });
        const failure = yield* Effect.flip(
          call({
            _tag: "ChangeThreadRunner",
            accountId: null,
            backups: [{ ...codex, accountId: Schema.decodeSync(AccountId)("missing") }],
            effort: "high",
            harness: "claude",
            model: "opus",
            threadId,
          }),
        );
        expect(failure).toBeDefined();
        expect((yield* read(missionId, threadId)).thread.model).not.toBe("opus");
        expect((yield* call({ _tag: "ReadThreadPanel", threadId })).backups).toEqual([opencode]);
      }),
    ),
  );
});
