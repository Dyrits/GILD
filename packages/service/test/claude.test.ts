import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
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
const withClaude = (options: { idleTimeout?: Duration.Input; sandboxProblem?: string } = {}) => {
  const directory = temporary();
  const log = join(directory, "starts.jsonl");
  process.env.STAND_IN_LOG = log;
  const layer = serviceLayer({
    filename: join(directory, "openmission.sqlite"),
    harness: claudeHarnessLayer({
      command: process.execPath,
      idleTimeout: options.idleTimeout ?? "10 minutes",
      prefixArgs: [standIn],
      sandboxProblem: options.sandboxProblem ?? null,
      userSettingsPath: join(directory, "no-settings.json"),
    }),
    homeFolder: directory,
    scratchRoot: join(directory, "missions"),
  });
  const starts = (): Array<{ pid: number; args: string[]; cwd: string; env: string[] }> => {
    try {
      return readFileSync(log, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
    } catch {
      return [];
    }
  };
  return { directory, layer, starts };
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
  it.live(
    "runs the thread's model and effort sandboxed, prompts sent to OpenMission, and no OpenMission secrets",
    () => {
      const { layer, starts } = withClaude();
      return Effect.gen(function* () {
        const started = yield* call({
          _tag: "StartMission",
          effort: "high",
          model: "opus",
          requestId: "r1",
          text: "Hello",
          workspacePath: null,
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
        expect(args).toContain("--permission-prompts host --permission-prompt-tool mcp__openmission__answer_prompt");
        expect(args).toContain("--allowedTools mcp__openmission__request_approval");
        expect(args).toContain("--strict-mcp-config");
        expect(args).toContain("--permission-mode acceptEdits");
        expect(start?.args[start.args.indexOf("--tools") + 1]).toBe("default");
        const settings = JSON.parse(start?.args[start.args.indexOf("--settings") + 1] ?? "{}");
        expect(settings).toEqual({ sandbox: { autoAllowBashIfSandboxed: true, enabled: true } });
        const mcp = JSON.parse(start?.args[start.args.indexOf("--mcp-config") + 1] ?? "{}");
        expect(mcp.mcpServers.openmission.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/mcp\/[0-9a-f]{48}$/);
        // Claude Code aborts a silent call after 300 seconds unless the server sets its own timeout.
        expect(mcp.mcpServers.openmission.timeout).toBe(2147483647);
        expect(args).toMatch(/--session-id [0-9a-f-]{36}/);
        expect(start?.env).toEqual([]);
      }).pipe(Effect.provide(layer));
    },
  );

  it.live("starts Claude Code in the workspace with its instructions in the system prompt", () => {
    const { directory, layer, starts } = withClaude();
    const app = join(realpathSync(directory), "app");
    mkdirSync(app);
    writeFileSync(join(app, "AGENTS.md"), "Use Bun, never pnpm.");
    return Effect.gen(function* () {
      const started = yield* call({
        _tag: "StartMission",
        effort: "default",
        model: "default",
        requestId: "r1",
        text: "Hi",
        workspacePath: app,
      });
      yield* settle(started.missionId, idleWith(1));
      const [start] = starts();
      expect(start?.cwd).toBe(app);
      const prompt = start?.args[start.args.indexOf("--append-system-prompt") + 1] ?? "";
      expect(prompt).toContain(`You work in the workspace "app" at ${app}.`);
      expect(prompt).toContain("## AGENTS.md\nUse Bun, never pnpm.");
      expect(prompt).toContain("# Approvals in OpenMission");
    }).pipe(Effect.provide(layer));
  });

  it.live("lets a sandboxed workspace thread reach the package registry and release downloads unasked", () => {
    const { directory, layer, starts } = withClaude();
    const app = join(realpathSync(directory), "app");
    mkdirSync(app);
    return Effect.gen(function* () {
      const started = yield* call({
        _tag: "StartMission",
        effort: "default",
        model: "default",
        requestId: "r1",
        text: "Hi",
        workspacePath: app,
      });
      yield* settle(started.missionId, idleWith(1));
      const [start] = starts();
      const settings = JSON.parse(start?.args[start.args.indexOf("--settings") + 1] ?? "{}");
      expect(settings.sandbox).toMatchObject({ autoAllowBashIfSandboxed: true, enabled: true });
      expect(settings.sandbox.network).toEqual({
        allowedDomains: [
          "registry.npmjs.org",
          "github.com",
          "objects.githubusercontent.com",
          "release-assets.githubusercontent.com",
        ],
        allowLocalBinding: true,
      });
      expect(settings.sandbox.filesystem.allowWrite).toEqual([
        "~/.bun/install/cache",
        "~/Library/Caches/electron",
        "~/.cache/electron",
      ]);
      expect(settings.env).toEqual({ NODE_USE_ENV_PROXY: "1" });
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
        workspacePath: null,
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
        workspacePath: null,
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

  it.live("restarts the process, resuming its session, when the approval level changes", () => {
    const { layer, starts } = withClaude();
    return Effect.gen(function* () {
      const started = yield* call({
        _tag: "StartMission",
        effort: "low",
        model: "haiku",
        requestId: "r1",
        text: "One",
        workspacePath: null,
      });
      yield* settle(started.missionId, idleWith(1));
      const settings = yield* call({ _tag: "ReadSettings" });
      yield* call({ _tag: "UpdateSettings", settings: { ...settings, approvalLevel: "CommandsAndEdits" } });
      yield* call({ _tag: "SendMessage", requestId: "r2", text: "Two", threadId: started.threadId });
      yield* settle(started.missionId, idleWith(2));

      const [first, second] = starts();
      expect(second?.pid).not.toBe(first?.pid);
      const args = second?.args.join(" ") ?? "";
      expect(args).toMatch(/--resume [0-9a-f-]{36}/);
      expect(args).toContain("--permission-mode default");
      expect(JSON.parse(second?.args[(second?.args.indexOf("--settings") ?? 0) + 1] ?? "{}")).toEqual({
        permissions: {},
      });
    }).pipe(Effect.provide(layer));
  });

  it.live("asks for every prompt at the default level when the sandbox is unavailable", () => {
    const { layer, starts } = withClaude({ sandboxProblem: "Sandbox unavailable: install bubblewrap." });
    return Effect.gen(function* () {
      const started = yield* call({
        _tag: "StartMission",
        effort: "low",
        model: "haiku",
        requestId: "r1",
        text: "One",
        workspacePath: null,
      });
      yield* settle(started.missionId, idleWith(1));
      const args = starts()[0]?.args.join(" ") ?? "";
      expect(args).toContain("--permission-mode default");
      expect(args).not.toContain("sandbox");
      const view = yield* call({ _tag: "ReadPermissions", missionId: null });
      expect(view.level).toBe("RiskyOnly");
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
        workspacePath: null,
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
        workspacePath: null,
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
      const started = yield* call({
        _tag: "StartMission",
        effort: "low",
        model: "haiku",
        requestId: "r1",
        text: "Hi",
        workspacePath: null,
      });
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

      const on = yield* call({
        _tag: "StartMission",
        effort: "low",
        model: "haiku",
        requestId: "r1",
        text: "Hi",
        workspacePath: null,
      });
      yield* settle(on.missionId, idleWith(1));
      const seen = (yield* PubSub.takeAll(drafts)).map((d) => d.text);
      expect(seen.some((text) => text.startsWith("Reply 1 "))).toBe(true);
      expect(seen.at(-1)).toBe("");

      yield* call({
        _tag: "UpdateSettings",
        settings: {
          approvalLevel: "RiskyOnly",
          defaultEffort: "default",
          defaultModel: "default",
          shouldStreamReplies: false,
        },
      });
      const off = yield* call({
        _tag: "StartMission",
        effort: "low",
        model: "haiku",
        requestId: "r2",
        text: "Hi",
        workspacePath: null,
      });
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
      harness: claudeHarnessLayer({
        command: process.execPath,
        idleTimeout: "1 minute",
        prefixArgs: [standIn],
        sandboxProblem: null,
      }),
      homeFolder: directory,
      scratchRoot: join(directory, "missions"),
    };
    return Effect.gen(function* () {
      const defaults = yield* call({ _tag: "ReadSettings" }).pipe(Effect.provide(serviceLayer(options)));
      expect(defaults).toEqual({
        approvalLevel: "RiskyOnly",
        defaultEffort: "default",
        defaultModel: "default",
        shouldStreamReplies: true,
      });

      const updated = {
        approvalLevel: "CommandsAndEdits",
        defaultEffort: "high",
        defaultModel: "sonnet",
        shouldStreamReplies: false,
      } as const;
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
          workspacePath: null,
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
              sandboxProblem: null,
            }),
            homeFolder: directory,
            scratchRoot: join(directory, "missions"),
          }),
        ),
      );
    },
    120_000,
  );

  it.live(
    "runs an action outside the working folder only after an approval, recording each one",
    () => {
      const directory = temporary();
      const outside = join(directory, "outside", "approved.txt");
      const settleLong = (missionId: MissionId, check: (detail: MissionDetail) => boolean) =>
        Effect.gen(function* () {
          for (let i = 0; i < 1200; i++) {
            const detail = yield* read(missionId);
            if (check(detail)) return detail;
            yield* Effect.sleep("100 millis");
          }
          return yield* Effect.die(new Error(`did not settle: ${JSON.stringify(yield* read(missionId))}`));
        });
      return Effect.gen(function* () {
        mkdirSync(join(directory, "outside"));
        const started = yield* call({
          _tag: "StartMission",
          effort: "low",
          model: "haiku",
          requestId: "r1",
          text: `Create the file ${outside} with the Bash command: touch ${outside}`,
          workspacePath: null,
        });
        // The model may ask through request_approval, quote the owner's message, or go
        // straight to the command, whose harness prompt then asks (CHG-0031); allow
        // whatever opens until the turn ends.
        const isSettled = (d: MissionDetail) => d.thread.state === "Idle" || d.thread.state === "Failed";
        let detail = yield* settleLong(started.missionId, (d) => isSettled(d) || d.thread.state === "Attention");
        for (let round = 0; round < 3 && !isSettled(detail); round++) {
          const question = detail.questions.find((q) => q.outcome === null);
          expect(question?.details).toContain(outside);
          yield* call({
            _tag: "AnswerQuestion",
            answer: "Allow",
            message: null,
            questionId: question?.id ?? ("" as never),
          });
          detail = yield* settleLong(started.missionId, (d) => isSettled(d) || d.thread.state === "Attention");
        }
        expect(detail.thread.failure).toBeNull();
        expect(existsSync(outside)).toBe(true);
        expect(detail.questions.length, JSON.stringify(detail.questions)).toBeGreaterThan(0);
        expect(detail.questions.every((q) => q.outcome !== null)).toBe(true);
      }).pipe(
        Effect.provide(
          serviceLayer({
            filename: join(directory, "openmission.sqlite"),
            harness: claudeHarnessLayer({
              command: process.env.OPENMISSION_CLAUDE_PATH ?? "claude",
              idleTimeout: "1 minute",
              sandboxProblem: null,
            }),
            homeFolder: directory,
            scratchRoot: join(directory, "missions"),
          }),
        ),
      );
    },
    180_000,
  );
});
