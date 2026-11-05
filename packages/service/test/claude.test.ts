import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import type { MissionDetail, MissionId, Request, RequestTag, ResultOf } from "@openmission/contracts";
import { type Duration, Effect, PubSub } from "effect";
import { afterEach } from "vitest";
import { Changes, claudeHarnessLayer, Service, serviceLayer } from "../src/index.ts";

const standIn = join(import.meta.dirname, "fixtures", "stand-in-claude.mjs");

const directories: string[] = [];
const temporary = () => {
  const directory = mkdtempSync(join(tmpdir(), "openmission-claude-"));
  directories.push(directory);
  return directory;
};
afterEach(() => {
  delete process.env.STAND_IN_MODE;
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

/** A service whose Claude Code adapter runs the stand-in on the current runtime. */
const withClaude = (options: { idleTimeout?: Duration.Input } = {}) => {
  const directory = temporary();
  const log = join(directory, "starts.jsonl");
  process.env.STAND_IN_LOG = log;
  const layer = serviceLayer({
    filename: join(directory, "openmission.sqlite"),
    harness: claudeHarnessLayer({
      command: process.execPath,
      idleTimeout: options.idleTimeout ?? "10 minutes",
      prefixArgs: [standIn],
    }),
    scratchRoot: join(directory, "missions"),
  });
  const starts = (): Array<{ pid: number; args: string[]; env: string[] }> => {
    try {
      return readFileSync(log, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
    } catch {
      return [];
    }
  };
  return { layer, starts };
};

const call = <R extends Request>(request: R) =>
  Effect.gen(function* () {
    const service = yield* Service;
    return (yield* service.handle(request)) as ResultOf<R["_tag"] & RequestTag>;
  });

const read = (missionId: MissionId) => call({ _tag: "ReadMission", missionId });

const settle = (missionId: MissionId, check: (detail: MissionDetail) => boolean) =>
  Effect.gen(function* () {
    for (let i = 0; i < 300; i++) {
      const detail = yield* read(missionId);
      if (check(detail)) return detail;
      yield* Effect.sleep("20 millis");
    }
    return yield* Effect.die(new Error(`mission did not settle: ${JSON.stringify(yield* read(missionId))}`));
  });

const idleWith = (count: number) => (detail: MissionDetail) =>
  detail.thread.state === "Idle" && detail.messages.filter((m) => m.sender === "agent").length === count;

describe("Claude Code adapter", () => {
  it.live("runs the thread's model and effort with no tools, prompts denied, and no OpenMission secrets", () => {
    const { layer, starts } = withClaude();
    return Effect.gen(function* () {
      const started = yield* call({
        _tag: "StartMission",
        effort: "high",
        model: "opus",
        requestId: "r1",
        text: "Hello",
      });
      const detail = yield* settle(started.missionId, idleWith(1));

      expect(detail.messages.map((m) => m.sender)).toEqual(["user", "agent"]);
      expect(detail.messages[1]?.text).toMatch(/^Reply 1 .* to: Hello$/);
      expect(detail.thread).toMatchObject({ effort: "high", failure: null, model: "opus" });

      const [start] = starts();
      const args = start?.args.join(" ") ?? "";
      expect(args).toContain("--input-format stream-json --output-format stream-json");
      expect(args).toContain("--model opus");
      expect(args).toContain("--effort high");
      expect(args).toContain("--permission-prompts none");
      expect(args).toContain("--strict-mcp-config");
      expect(start?.args[start.args.indexOf("--tools") + 1]).toBe("");
      expect(args).toMatch(/--session-id [0-9a-f-]{36}/);
      expect(start?.env).toEqual([]);
    }).pipe(Effect.provide(layer));
  });

  it.live("omits model and effort when the thread uses Claude Code's defaults", () => {
    const { layer, starts } = withClaude();
    return Effect.gen(function* () {
      const started = yield* call({
        _tag: "StartMission",
        effort: "default",
        model: "default",
        requestId: "r1",
        text: "Hi",
      });
      yield* settle(started.missionId, idleWith(1));
      const args = starts()[0]?.args ?? [];
      expect(args).not.toContain("--model");
      expect(args).not.toContain("--effort");
    }).pipe(Effect.provide(layer));
  });

  it.live("keeps one process per thread across turns and adds up token usage", () => {
    const { layer, starts } = withClaude();
    return Effect.gen(function* () {
      const started = yield* call({
        _tag: "StartMission",
        effort: "low",
        model: "haiku",
        requestId: "r1",
        text: "One",
      });
      yield* settle(started.missionId, idleWith(1));
      yield* call({ _tag: "SendMessage", requestId: "r2", text: "Two", threadId: started.threadId });
      const detail = yield* settle(started.missionId, idleWith(2));

      expect(starts()).toHaveLength(1);
      expect(detail.messages.at(-1)?.text).toMatch(/^Reply 2 .* to: Two$/);
      expect(detail.mission.usage).toEqual({ cacheCreation: 100, cacheRead: 200, input: 4, output: 20 });
      const [summary] = yield* call({ _tag: "ListMissions" });
      expect(summary?.usage.output).toBe(20);
    }).pipe(Effect.provide(layer));
  });

  it.live("closes an idle process and resumes the same session for the next message", () => {
    const { layer, starts } = withClaude({ idleTimeout: "100 millis" });
    return Effect.gen(function* () {
      const started = yield* call({
        _tag: "StartMission",
        effort: "low",
        model: "haiku",
        requestId: "r1",
        text: "One",
      });
      yield* settle(started.missionId, idleWith(1));
      yield* Effect.sleep("400 millis");
      yield* call({ _tag: "SendMessage", requestId: "r2", text: "Two", threadId: started.threadId });
      const detail = yield* settle(started.missionId, idleWith(2));

      const [first, second] = starts();
      const sessionId = first?.args[first.args.indexOf("--session-id") + 1];
      expect(second?.args[second.args.indexOf("--resume") + 1]).toBe(sessionId);
      expect(detail.messages.at(-1)?.text).toMatch(/^Reply 1 .* to: Two$/);
    }).pipe(Effect.provide(layer));
  });

  it.live("shows Failed with the reason, and the next message retries the failed turn's messages", () => {
    const { layer } = withClaude();
    return Effect.gen(function* () {
      process.env.STAND_IN_MODE = "fail-start";
      const started = yield* call({
        _tag: "StartMission",
        effort: "low",
        model: "haiku",
        requestId: "r1",
        text: "First",
      });
      const failed = yield* settle(started.missionId, (d) => d.thread.state === "Failed");
      expect(failed.thread.failure).toContain("stand-in: cannot start");
      expect(failed.mission.state).toBe("Failed");

      process.env.STAND_IN_MODE = "ok";
      yield* call({ _tag: "SendMessage", requestId: "r2", text: "Second", threadId: started.threadId });
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(detail.messages.at(-1)?.text).toMatch(/to: First\n\nSecond$/);
      expect(detail.thread.failure).toBeNull();
    }).pipe(Effect.provide(layer));
  });

  it.live("treats an error reported by Claude Code as a failure, not as a reply", () => {
    const { layer } = withClaude();
    return Effect.gen(function* () {
      process.env.STAND_IN_MODE = "error-result";
      const started = yield* call({ _tag: "StartMission", effort: "low", model: "haiku", requestId: "r1", text: "Hi" });
      const failed = yield* settle(started.missionId, (d) => d.thread.state === "Failed");
      expect(failed.thread.failure).toBe("There's an issue with the selected model.");
      expect(failed.messages.map((m) => m.sender)).toEqual(["user"]);
    }).pipe(Effect.provide(layer));
  });

  it.live("shows the reply as it is written only while the setting is on", () => {
    const { layer } = withClaude();
    return Effect.gen(function* () {
      const changes = yield* Changes;
      const drafts = yield* PubSub.subscribe(changes.drafts);

      const on = yield* call({ _tag: "StartMission", effort: "low", model: "haiku", requestId: "r1", text: "Hi" });
      yield* settle(on.missionId, idleWith(1));
      const seen = (yield* PubSub.takeAll(drafts)).map((d) => d.text);
      expect(seen.some((text) => text.startsWith("Reply 1 "))).toBe(true);
      expect(seen.at(-1)).toBe("");

      yield* call({
        _tag: "UpdateSettings",
        settings: { defaultEffort: "default", defaultModel: "default", shouldStreamReplies: false },
      });
      const off = yield* call({ _tag: "StartMission", effort: "low", model: "haiku", requestId: "r2", text: "Hi" });
      yield* settle(off.missionId, idleWith(1));
      expect((yield* PubSub.takeAll(drafts)).filter((d) => d.text !== "")).toEqual([]);
    }).pipe(Effect.provide(layer));
  });
});

describe("settings", () => {
  it.live("start from defaults and persist updates", () => {
    const directory = temporary();
    const options = {
      filename: join(directory, "openmission.sqlite"),
      harness: claudeHarnessLayer({ command: process.execPath, idleTimeout: "1 minute", prefixArgs: [standIn] }),
      scratchRoot: join(directory, "missions"),
    };
    return Effect.gen(function* () {
      const defaults = yield* call({ _tag: "ReadSettings" }).pipe(Effect.provide(serviceLayer(options)));
      expect(defaults).toEqual({ defaultEffort: "default", defaultModel: "default", shouldStreamReplies: true });

      const updated = { defaultEffort: "high", defaultModel: "sonnet", shouldStreamReplies: false } as const;
      yield* call({ _tag: "UpdateSettings", settings: updated }).pipe(Effect.provide(serviceLayer(options)));
      expect(yield* call({ _tag: "ReadSettings" }).pipe(Effect.provide(serviceLayer(options)))).toEqual(updated);
    });
  });
});

describe.runIf(process.env.OPENMISSION_LIVE_CLAUDE === "1")("live Claude Code (uses a few tokens)", () => {
  it.live(
    "answers through the installed claude",
    () => {
      const directory = temporary();
      return Effect.gen(function* () {
        const started = yield* call({
          _tag: "StartMission",
          effort: "low",
          model: "haiku",
          requestId: "r1",
          text: "Reply with exactly: ok",
        });
        const detail = yield* settle(started.missionId, (d) => d.thread.state !== "Running");
        expect(detail.thread.failure).toBeNull();
        expect(detail.messages.at(-1)?.text.toLowerCase()).toContain("ok");
        expect(detail.mission.usage.output).toBeGreaterThan(0);
      }).pipe(
        Effect.provide(
          serviceLayer({
            filename: join(directory, "openmission.sqlite"),
            harness: claudeHarnessLayer({
              command: process.env.OPENMISSION_CLAUDE_PATH ?? "claude",
              idleTimeout: "1 minute",
            }),
            scratchRoot: join(directory, "missions"),
          }),
        ),
      );
    },
    120_000,
  );
});
