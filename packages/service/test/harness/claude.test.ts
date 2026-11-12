import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import type { MissionDetail, MissionId, Request, RequestTag, ResultOf } from "@iskios/contracts";
import { type Duration, Effect, PubSub } from "effect";
import { SqlClient } from "effect/sql";
import { afterEach } from "vitest";
import { Changes, claudeHarnessLayer, makeClaudeHarness, Service, serviceLayer } from "../../src/index.ts";
import { unaskedToolNamesOf } from "../../src/work/threadTools.ts";
import { turnRequestOf } from "../fixtures/turns.ts";

// Stored and wire names keep `intel` so existing data and agents still work: settings keys (`intelHalfLives`, `intelWarningPercent`).

const standIn = join(import.meta.dirname, "..", "fixtures", "stand-in-claude.mjs");

/** A stand-in reply without the turn's note (journal, lore, budget) that precedes the messages. */
const withoutNote = (text: string | undefined) => text?.replace(/ to: [\s\S]*?\n---\n\n/, " to: ") ?? "";

const directories: string[] = [];
const temporary = () => {
  const directory = mkdtempSync(join(tmpdir(), "iskios-claude-"));
  directories.push(directory);
  return directory;
};
afterEach(() => {
  delete process.env.STAND_IN_MODE;
  delete process.env.STAND_IN_COST;
  delete process.env.STAND_IN_API_KEY_SOURCE;
  delete process.env.STAND_IN_MODEL;
  delete process.env.STAND_IN_INPUT;
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

/** A service whose Claude Code adapter runs the stand-in on the current runtime. */
const withClaude = (options: { idleTimeout?: Duration.Input; sandboxProblem?: string } = {}) => {
  const directory = temporary();
  const log = join(directory, "starts.jsonl");
  process.env.STAND_IN_LOG = log;
  const layer = serviceLayer({
    filename: join(directory, "iskios.sqlite"),
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

const read = (missionId: MissionId) => call({ _tag: "ReadMission", missionId, threadId: null });

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

describe("running Claude Code threads", () => {
  it.live("runs the thread's model and effort sandboxed, prompts sent to Iskios, and no Iskios secrets", () => {
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
      expect(detail.messages.map((m) => m.model)).toEqual([null, "claude-sonnet-5-5"]);
      expect(withoutNote(detail.messages[1]?.text)).toMatch(/^Reply 1 .* to: Hello$/);
      expect(detail.thread).toMatchObject({ effort: "high", failure: null, model: "opus" });

      const [start] = starts();
      const args = start?.args.join(" ") ?? "";
      expect(args).toContain("--input-format stream-json --output-format stream-json");
      expect(args).toContain("--model opus");
      expect(args).toContain("--effort high");
      expect(args).toContain("--permission-prompts host --permission-prompt-tool mcp__iskios__answer_prompt");
      expect(args).toContain("--allowedTools mcp__iskios__request_approval");
      expect(args).toContain(`--allowedTools mcp__iskios__request_approval ${unaskedToolNamesOf("iskios").join(" ")}`);
      expect(args).toContain("--strict-mcp-config");
      expect(args).toContain("--permission-mode acceptEdits");
      expect(start?.args[start.args.indexOf("--tools") + 1]).toBe("default");
      const settings = JSON.parse(start?.args[start.args.indexOf("--settings") + 1] ?? "{}");
      // Never unsandboxed on a warning: a sandbox that cannot start stops Claude Code instead.
      expect(settings.sandbox).toMatchObject({
        autoAllowBashIfSandboxed: true,
        enabled: true,
        failIfUnavailable: true,
      });
      const mcp = JSON.parse(start?.args[start.args.indexOf("--mcp-config") + 1] ?? "{}");
      expect(mcp.mcpServers.iskios.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/mcp\/[0-9a-f]{48}$/);
      // Claude Code aborts a silent call after 300 seconds unless the server sets its own timeout.
      expect(mcp.mcpServers.iskios.timeout).toBe(2147483647);
      expect(args).toMatch(/--session-id [0-9a-f-]{36}/);
      expect(start?.env).toEqual([]);
    }).pipe(Effect.provide(layer));
  });

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
      expect(prompt).toContain("# Approvals in Iskios");
    }).pipe(Effect.provide(layer));
  });

  it.live("lets a sandboxed thread reach a broad allowlist of hosts unasked, which Claude Code accepts", () => {
    const { directory, layer, starts } = withClaude();
    const app = join(realpathSync(directory), "app");
    mkdirSync(app);
    return Effect.gen(function* () {
      for (const workspacePath of [app, null]) {
        const started = yield* call({
          _tag: "StartMission",
          effort: "default",
          model: "default",
          requestId: crypto.randomUUID(),
          text: "Hi",
          workspacePath,
        });
        yield* settle(started.missionId, idleWith(1));
      }
      for (const start of starts()) {
        const settings = JSON.parse(start.args[start.args.indexOf("--settings") + 1] ?? "{}");
        const { allowedDomains, allowLocalBinding } = settings.sandbox.network;
        expect(allowLocalBinding).toBe(true);
        expect(allowedDomains).toEqual(
          expect.arrayContaining([
            "registry.npmjs.org",
            "github.com",
            "*.github.com",
            "*.githubusercontent.com",
            "pypi.org",
            "files.pythonhosted.org",
            "crates.io",
            "proxy.golang.org",
            "cdn.jsdelivr.net",
            "unpkg.com",
          ]),
        );
        // Claude Code 2.1.322 refuses "*" and a bare top-level wildcard such as "*.com": a broad allowlist, not open egress.
        for (const domain of allowedDomains) {
          expect(
            domain === "*" || /^\*\.[^.]+$/.test(domain) || domain.slice(domain.startsWith("*.") ? 2 : 0).includes("*"),
            domain,
          ).toBe(false);
        }
        expect(settings.sandbox.filesystem.allowWrite).toEqual([
          "~/.bun/install/cache",
          "~/.npm",
          "~/Library/Caches/electron",
          "~/.cache/electron",
        ]);
        expect(settings.env).toEqual({ NODE_USE_ENV_PROXY: "1" });
      }
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

  it.live("keeps its system prompt and process across a journal change, and sends the change with the turn", () => {
    const { layer, starts } = withClaude();
    return Effect.gen(function* () {
      const started = yield* call({
        _tag: "StartMission",
        effort: "default",
        model: "default",
        requestId: "r1",
        text: "One",
        workspacePath: null,
      });
      yield* settle(started.missionId, idleWith(1));
      yield* call({ _tag: "AddJournalEntry", missionId: started.missionId, requestId: "r2", text: "Chose SQLite." });
      yield* call({ _tag: "SendMessage", delivery: null, requestId: "r3", text: "Two", threadId: started.threadId });
      const detail = yield* settle(started.missionId, idleWith(2));

      expect(starts()).toHaveLength(1);
      const systemPrompt = starts()[0]?.args[(starts()[0]?.args.indexOf("--append-system-prompt") ?? -2) + 1] ?? "";
      expect(systemPrompt).toContain("# Quest journal");
      expect(systemPrompt).not.toContain("Briefing (version");
      expect(detail.messages.at(-1)?.text).toMatch(
        /# Quest journal at this turn[\s\S]*Chose SQLite\.[\s\S]*\n---\n\nTwo$/,
      );
    }).pipe(Effect.provide(layer));
  });

  it.live("keeps its system prompt and process across a mission rename, and gives the title with the turn", () => {
    const { layer, starts } = withClaude();
    return Effect.gen(function* () {
      const started = yield* call({
        _tag: "StartMission",
        effort: "default",
        model: "default",
        requestId: "t1",
        text: "One",
        workspacePath: null,
      });
      yield* settle(started.missionId, idleWith(1));
      yield* call({ _tag: "RenameMission", missionId: started.missionId, title: "Renamed mission" });
      yield* call({ _tag: "SendMessage", delivery: null, requestId: "t2", text: "Two", threadId: started.threadId });
      const detail = yield* settle(started.missionId, idleWith(2));

      expect(starts()).toHaveLength(1);
      const systemPrompt = starts()[0]?.args[(starts()[0]?.args.indexOf("--append-system-prompt") ?? -2) + 1] ?? "";
      expect(systemPrompt).toContain(`You are thread ${started.threadId}`);
      expect(detail.messages.at(-1)?.text).toContain('Your title: "Renamed mission".');
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
      yield* call({ _tag: "SendMessage", delivery: null, requestId: "r2", text: "Two", threadId: started.threadId });
      const detail = yield* settle(started.missionId, idleWith(2));

      expect(starts()).toHaveLength(1);
      expect(withoutNote(detail.messages.at(-1)?.text)).toMatch(/^Reply 2 .* to: Two$/);
      expect(detail.mission.usage).toEqual({ cacheCreation: 100, cacheRead: 200, input: 4, output: 20 });
      const {
        missions: [summary],
      } = yield* call({ _tag: "ListMissions", isArchived: false, search: null, state: null, workspaceId: null });
      expect(summary?.usage.output).toBe(20);
    }).pipe(Effect.provide(layer));
  });

  it.live("takes the thread's context from the latest call, not the turn's summed usage", () => {
    const { layer } = withClaude();
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
      const panel = yield* call({ _tag: "ReadThreadPanel", threadId: started.threadId });

      expect(panel.context?.tokens).toBe(75);
      expect(panel.turnCount).toBe(1);
    }).pipe(Effect.provide(layer));
  });

  it.live("shows the reply's own call under it, and the rest of the turn's usage with it, so the lines add up", () => {
    const { layer } = withClaude();
    return Effect.gen(function* () {
      const started = yield* call({
        _tag: "StartMission",
        effort: "low",
        model: "haiku",
        requestId: "r1",
        text: "One",
        workspacePath: null,
      });
      const detail = yield* settle(started.missionId, idleWith(1));
      const usage = detail.messages.filter((message) => message.sender === "agent").at(-1)?.usage;
      // The call used 3 input, 7 output, 60 cache read, and 5 cache write tokens; the turn, 2, 10, 100, and 50 in all.
      // What the turn used beyond the call (3 output, 40 cache read, 45 cache write) joins it.
      expect(usage?.tokens).toEqual({ cacheCreation: 50, cacheRead: 100, input: 3, output: 10 });
    }).pipe(Effect.provide(layer));
  });

  it.live("records no model for a reply under Claude Code's own `<synthetic>` placeholder", () => {
    process.env.STAND_IN_MODEL = "<synthetic>";
    const { layer } = withClaude();
    return Effect.gen(function* () {
      const started = yield* call({
        _tag: "StartMission",
        effort: "low",
        model: "default",
        requestId: "r1",
        text: "Hello",
        workspacePath: null,
      });
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(detail.messages.map((m) => m.model)).toEqual([null, null]);
    }).pipe(Effect.provide(layer));
  });

  it.live("records each turn's own cost from the running total Claude Code reports, on an API key", () => {
    process.env.STAND_IN_COST = "1";
    process.env.STAND_IN_API_KEY_SOURCE = "ANTHROPIC_API_KEY";
    const { layer } = withClaude();
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
      yield* call({ _tag: "SendMessage", delivery: null, requestId: "r2", text: "Two", threadId: started.threadId });
      const detail = yield* settle(started.missionId, idleWith(2));

      expect(detail.mission.budget.spent.cost).toBeCloseTo(0.02, 6);
    }).pipe(Effect.provide(layer));
  });

  it.live("counts a subscription turn's tokens, not the cost Claude Code reports, when no API key signed it in", () => {
    process.env.STAND_IN_COST = "1";
    process.env.STAND_IN_API_KEY_SOURCE = "none";
    const { layer } = withClaude();
    return Effect.gen(function* () {
      const started = yield* call({
        _tag: "StartMission",
        effort: "low",
        model: "haiku",
        requestId: "r1",
        text: "One",
        workspacePath: null,
      });
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(detail.mission.budget.spent.cost).toBe(0);
      expect(detail.mission.budget.spent.tokens).toBeGreaterThan(0);
    }).pipe(Effect.provide(layer));
  });

  it.live("counts a turn as subscription tokens when Claude Code does not report how it signed in", () => {
    process.env.STAND_IN_COST = "1";
    const { layer } = withClaude();
    return Effect.gen(function* () {
      const started = yield* call({
        _tag: "StartMission",
        effort: "low",
        model: "haiku",
        requestId: "r1",
        text: "One",
        workspacePath: null,
      });
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(detail.mission.budget.spent.cost).toBe(0);
      expect(detail.mission.budget.spent.tokens).toBeGreaterThan(0);
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
      yield* call({ _tag: "SendMessage", delivery: null, requestId: "r2", text: "Two", threadId: started.threadId });
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

  it.live("restarts the process, resuming its session, when the thread's model changes", () => {
    const directory = temporary();
    const log = join(directory, "starts.jsonl");
    process.env.STAND_IN_LOG = log;
    const starts = (): Array<{ pid: number; args: string[] }> =>
      readFileSync(log, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
    return Effect.gen(function* () {
      const harness = yield* makeClaudeHarness({
        command: process.execPath,
        idleTimeout: "10 minutes",
        prefixArgs: [standIn],
        sandboxProblem: null,
        userSettingsPath: join(directory, "no-settings.json"),
      });
      const first = yield* harness.runTurn(turnRequestOf({ cwd: directory, model: "haiku", text: "One" }));
      yield* harness.runTurn(turnRequestOf({ cwd: directory, model: "opus", sessionId: first.sessionId, text: "Two" }));
      const [before, after] = starts();
      expect(after?.pid).not.toBe(before?.pid);
      expect(after?.args.join(" ")).toContain("--model opus");
      expect(after?.args[(after?.args.indexOf("--resume") ?? -2) + 1]).toBe(first.sessionId);
    }).pipe(Effect.scoped);
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
      const start = starts()[0];
      const settings = JSON.parse(start?.args[start.args.indexOf("--settings") + 1] ?? "{}");
      expect(settings.sandbox).toBeUndefined();
      const view = yield* call({ _tag: "ReadPermissions", missionId: null });
      expect(view.level).toBe("RiskyOnly");
    }).pipe(Effect.provide(layer));
  });

  it.live("reports itself sandboxed only at the default level on a host that can sandbox", () =>
    Effect.gen(function* () {
      const options = { command: process.execPath, idleTimeout: "10 minutes", prefixArgs: [standIn] } as const;
      const capable = yield* makeClaudeHarness({ ...options, sandboxProblem: null });
      const incapable = yield* makeClaudeHarness({ ...options, sandboxProblem: "Sandbox unavailable." });
      expect(capable.containmentOf?.("claude", "RiskyOnly")).toBe("Sandboxed");
      expect(capable.containmentOf?.("claude", "CommandsAndEdits")).toBe("Unprotected");
      expect(incapable.containmentOf?.("claude", "RiskyOnly")).toBe("Unprotected");
    }).pipe(Effect.scoped),
  );

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
      yield* call({ _tag: "SendMessage", delivery: null, requestId: "r2", text: "Two", threadId: started.threadId });
      const detail = yield* settle(started.missionId, idleWith(2));

      const [first, second] = starts();
      const sessionId = first?.args[first.args.indexOf("--session-id") + 1];
      expect(second?.args[second.args.indexOf("--resume") + 1]).toBe(sessionId);
      expect(withoutNote(detail.messages.at(-1)?.text)).toMatch(/^Reply 1 .* to: Two$/);
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
      yield* call({ _tag: "SendMessage", delivery: null, requestId: "r2", text: "Second", threadId: started.threadId });
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(withoutNote(detail.messages.at(-1)?.text)).toMatch(/to: First\n\nSecond$/);
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
          autoArchiveDays: 30,
          backups: [],
          briefingLimit: 2000,
          chatterThreshold: 20,
          defaultDelivery: "Steer",
          defaultEffort: "default",
          defaultHarness: "claude",
          defaultMissionBudget: { cost: null, tokens: null },
          defaultModel: "default",
          globalBudget: { cost: null, tokens: null },
          globalBudgetPeriod: "Month",
          inactivityDays: 14,
          intelHalfLives: { decision: 45, fact: 45, preference: 90, temporary: 3 },
          intelWarningPercent: 10,
          shouldAutoArchive: false,
          shouldFetchPrices: true,
          shouldOpenOffTopicMissions: false,
          shouldShowAgentThreads: true,
          shouldShowFinishedQuests: false,
          shouldShowGuildmaster: true,
          shouldStreamReplies: false,
          tiers: { Balanced: null, Heavy: null, Light: null },
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

describe("network hosts asked about by a sandboxed Claude Code thread", () => {
  const ask = (text: string) =>
    call({ _tag: "StartMission", effort: "low", model: "haiku", requestId: "r1", text, workspacePath: null });
  const lastReply = (detail: MissionDetail) => withoutNote(detail.messages.at(-1)?.text);
  const inputLines = (directory: string): Array<{ type?: string; response?: unknown }> =>
    readFileSync(join(directory, "input.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));

  it.live("allows a blocked host inside the sandbox, answering only that ask", () => {
    const { directory, layer } = withClaude();
    process.env.STAND_IN_INPUT = join(directory, "input.jsonl");
    return Effect.gen(function* () {
      const started = yield* ask("ask-net example.com");
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(lastReply(detail)).toContain("answered allow");
      const answer = inputLines(directory).find((line) => line.type === "control_response");
      expect(answer?.response).toMatchObject({
        request_id: "ask-1",
        response: { behavior: "allow", updatedInput: { host: "example.com" } },
        subtype: "success",
      });
    }).pipe(Effect.provide(layer));
  });

  it.live("leaves a sandbox escape unanswered: the network allowance covers hosts only", () => {
    const { directory, layer } = withClaude();
    process.env.STAND_IN_INPUT = join(directory, "input.jsonl");
    return Effect.gen(function* () {
      const started = yield* ask("ask-bash-escape");
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(lastReply(detail)).toContain("unanswered");
      expect(inputLines(directory).some((line) => line.type === "control_response")).toBe(false);
    }).pipe(Effect.provide(layer));
  });

  it.live("answers no host ask when the sandbox could not start", () => {
    const { directory, layer } = withClaude({ sandboxProblem: "Sandbox unavailable: install bubblewrap." });
    process.env.STAND_IN_INPUT = join(directory, "input.jsonl");
    return Effect.gen(function* () {
      const started = yield* ask("ask-net example.com");
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(lastReply(detail)).toContain("unanswered");
      expect(inputLines(directory).some((line) => line.type === "control_response")).toBe(false);
    }).pipe(Effect.provide(layer));
  });

  it.live("answers no ask whose host is not one plain host name", () => {
    const { directory, layer } = withClaude();
    process.env.STAND_IN_INPUT = join(directory, "input.jsonl");
    return Effect.gen(function* () {
      const started = yield* ask("ask-net bad/host");
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(lastReply(detail)).toContain("unanswered");
    }).pipe(Effect.provide(layer));
  });
});

describe("steering and interrupting Claude Code", () => {
  const inputLines = (directory: string): Array<Record<string, unknown>> => {
    try {
      return readFileSync(join(directory, "input.jsonl"), "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
    } catch {
      return [];
    }
  };
  const startSlow = (text: string) =>
    call({ _tag: "StartMission", effort: "low", model: "haiku", requestId: "r1", text, workspacePath: null });
  const isRunning = (detail: MissionDetail) => detail.thread.state === "Running";

  it.live("gives Claude Code the text then one base64 image block per image, as the turn's message", () => {
    const { directory, layer } = withClaude();
    process.env.STAND_IN_INPUT = join(directory, "input.jsonl");
    const bytes = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20, 1)]);
    return Effect.gen(function* () {
      const card = yield* call({ _tag: "AddAttachment", data: bytes.toString("base64"), name: "shot.png" });
      const started = yield* call({
        _tag: "StartMission",
        attachmentIds: [card.id],
        effort: "low",
        model: "haiku",
        requestId: "r1",
        text: "See",
        workspacePath: null,
      });
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(withoutNote(detail.messages.at(-1)?.text)).toMatch(/to: See$/);
      const message = inputLines(directory)[0]?.message as { content: Array<Record<string, unknown>> };
      expect(message.content[0]).toMatchObject({ type: "text" });
      expect(message.content[1]).toEqual({
        source: { data: bytes.toString("base64"), media_type: "image/png", type: "base64" },
        type: "image",
      });
    }).pipe(Effect.provide(layer));
  });

  it.live("writes a steered message with its identifier into the running turn and marks it delivered", () => {
    const { directory, layer, starts } = withClaude();
    process.env.STAND_IN_INPUT = join(directory, "input.jsonl");
    return Effect.gen(function* () {
      const started = yield* startSlow("slow 600");
      yield* settle(started.missionId, isRunning);
      const sent = yield* call({
        _tag: "SendMessage",
        delivery: "Steer",
        requestId: "r2",
        text: "Also this",
        threadId: started.threadId,
      });
      const detail = yield* settle(started.missionId, idleWith(1));

      expect(withoutNote(detail.messages.at(-1)?.text)).toMatch(/^Reply 1 .* to: slow 600 \+ Also this$/);
      expect(starts()).toHaveLength(1);
      expect(starts()[0]?.args).toContain("--replay-user-messages");
      expect(inputLines(directory).at(-1)).toEqual({
        message: { content: "Also this", role: "user" },
        type: "user",
        uuid: sent.messageId,
      });
      expect(detail.messages.find((message) => message.id === sent.messageId)?.isQueued).toBe(false);
    }).pipe(Effect.provide(layer));
  });

  it.live(
    "closes the process when a steered message was not taken in by the turn's end, then sends it next turn",
    () => {
      const { layer, starts } = withClaude();
      return Effect.gen(function* () {
        const started = yield* startSlow("slow 400");
        yield* settle(started.missionId, isRunning);
        yield* call({
          _tag: "SendMessage",
          delivery: "Steer",
          requestId: "r2",
          text: "unseen",
          threadId: started.threadId,
        });
        const detail = yield* settle(started.missionId, idleWith(2));
        yield* Effect.sleep("400 millis");

        const replies = (yield* read(started.missionId)).messages.filter((message) => message.sender === "agent");
        expect(replies.map((message) => withoutNote(message.text).replace(/ \(pid \d+\)/, ""))).toEqual([
          "Reply 1 to: slow 400",
          "Reply 1 to: unseen",
        ]);
        expect(starts()).toHaveLength(2);
        expect(starts()[1]?.args.join(" ")).toContain("--resume");
        expect(detail.thread.failure).toBeNull();
      }).pipe(Effect.provide(layer));
    },
  );

  it.live("interrupts the turn with a control request and keeps the process for the next turn", () => {
    const { directory, layer, starts } = withClaude();
    process.env.STAND_IN_INPUT = join(directory, "input.jsonl");
    return Effect.gen(function* () {
      const started = yield* startSlow("slow 5000");
      yield* settle(started.missionId, isRunning);
      yield* call({ _tag: "InterruptThread", threadId: started.threadId });
      const interrupted = yield* settle(started.missionId, (detail) => detail.thread.state === "Idle");
      expect(interrupted.thread.failure).toBeNull();
      expect(interrupted.messages.filter((message) => message.sender === "agent")).toEqual([]);
      expect(inputLines(directory).find((line) => line.type === "control_request")).toMatchObject({
        request: { subtype: "interrupt" },
      });

      yield* call({ _tag: "SendMessage", delivery: null, requestId: "r2", text: "Again", threadId: started.threadId });
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(withoutNote(detail.messages.at(-1)?.text)).toMatch(/^Reply 2 .* to: Again$/);
      expect(starts()).toHaveLength(1);
    }).pipe(Effect.provide(layer));
  });
});

describe("reading and saving settings", () => {
  it.live("starts from defaults and persists updates", () => {
    const directory = temporary();
    const options = {
      filename: join(directory, "iskios.sqlite"),
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
        autoArchiveDays: 30,
        backups: [],
        briefingLimit: 2000,
        chatterThreshold: 20,
        defaultDelivery: "Steer",
        defaultEffort: "default",
        defaultHarness: "claude",
        defaultMissionBudget: { cost: null, tokens: null },
        defaultModel: "claude-sonnet-5-5",
        globalBudget: { cost: null, tokens: null },
        globalBudgetPeriod: "Month",
        inactivityDays: 14,
        intelHalfLives: { decision: 45, fact: 45, preference: 90, temporary: 3 },
        intelWarningPercent: 10,
        shouldAutoArchive: false,
        shouldFetchPrices: true,
        shouldOpenOffTopicMissions: false,
        shouldShowAgentThreads: true,
        shouldShowFinishedQuests: false,
        shouldShowGuildmaster: true,
        shouldStreamReplies: true,
        tiers: { Balanced: null, Heavy: null, Light: null },
      });

      const updated = {
        approvalLevel: "CommandsAndEdits",
        autoArchiveDays: 10,
        backups: [],
        briefingLimit: 500,
        chatterThreshold: 20,
        defaultDelivery: "Queue",
        defaultEffort: "high",
        defaultHarness: "codex",
        defaultMissionBudget: { cost: null, tokens: null },
        defaultModel: "sonnet",
        globalBudget: { cost: null, tokens: null },
        globalBudgetPeriod: "Month",
        inactivityDays: 7,
        intelHalfLives: { decision: 30, fact: 60, preference: 120, temporary: 5 },
        intelWarningPercent: 25,
        shouldAutoArchive: true,
        shouldFetchPrices: true,
        shouldOpenOffTopicMissions: true,
        shouldShowAgentThreads: true,
        shouldShowFinishedQuests: false,
        shouldShowGuildmaster: true,
        shouldStreamReplies: false,
        tiers: { Balanced: null, Heavy: null, Light: null },
      } as const;
      yield* call({ _tag: "UpdateSettings", settings: updated }).pipe(Effect.provide(serviceLayer(options)));
      expect(yield* call({ _tag: "ReadSettings" }).pipe(Effect.provide(serviceLayer(options)))).toEqual(updated);
    });
  });

  it.live("keep the owner's saved choices when a setting added later is missing", () => {
    const { layer } = withClaude();
    return Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const saved = { approvalLevel: "CommandsAndEdits", defaultEffort: "high", defaultModel: "sonnet" };
      yield* sql`INSERT INTO settings (key, value) VALUES ('settings', ${JSON.stringify({ ...saved, shouldStreamReplies: false })})
        ON CONFLICT (key) DO UPDATE SET value = excluded.value`;
      expect(yield* call({ _tag: "ReadSettings" })).toEqual({
        ...saved,
        autoArchiveDays: 30,
        backups: [],
        briefingLimit: 2000,
        chatterThreshold: 20,
        defaultDelivery: "Steer",
        defaultHarness: "claude",
        defaultMissionBudget: { cost: null, tokens: null },
        globalBudget: { cost: null, tokens: null },
        globalBudgetPeriod: "Month",
        inactivityDays: 14,
        intelHalfLives: { decision: 45, fact: 45, preference: 90, temporary: 3 },
        intelWarningPercent: 10,
        shouldAutoArchive: false,
        shouldFetchPrices: true,
        shouldOpenOffTopicMissions: false,
        shouldShowAgentThreads: true,
        shouldShowFinishedQuests: false,
        shouldShowGuildmaster: true,
        shouldStreamReplies: false,
        tiers: { Balanced: null, Heavy: null, Light: null },
      });
    }).pipe(Effect.provide(layer));
  });
});

describe.runIf(process.env.ISKIOS_LIVE_CLAUDE === "1")("live Claude Code (uses a few tokens)", () => {
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
            filename: join(directory, "iskios.sqlite"),
            harness: claudeHarnessLayer({
              command: process.env.ISKIOS_CLAUDE_PATH ?? "claude",
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
        // The model may ask through request_approval, or go straight to the command, whose escape from the sandbox
        // then asks (CHG-0031, CHG-0208); allow whatever opens until the turn ends.
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
            filename: join(directory, "iskios.sqlite"),
            harness: claudeHarnessLayer({
              command: process.env.ISKIOS_CLAUDE_PATH ?? "claude",
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

  it.live(
    "opens a thread beneath that reports its result back to the opener",
    () => {
      const directory = temporary();
      return Effect.gen(function* () {
        const started = yield* call({
          _tag: "StartMission",
          effort: "low",
          model: "haiku",
          requestId: "r1",
          text: "Call open_thread once with the request: 'Compute 6 times 7, then call report_result with only the number as result and 'nothing to record' as journal.' Then end your turn. When the result arrives, reply with only that number.",
          workspacePath: null,
        });
        let detail = yield* read(started.missionId);
        for (let i = 0; i < 1200; i++) {
          detail = yield* read(started.missionId);
          const child = detail.threads.find((thread) => thread.parentId === started.threadId);
          const hasResult = detail.messages.some((message) => message.isResult);
          if (child?.state === "Done" && hasResult && detail.thread.state === "Idle") break;
          yield* Effect.sleep("100 millis");
        }
        const child = detail.threads.find((thread) => thread.parentId === started.threadId);
        expect(child).toMatchObject({ depth: 1, isOpenedByAgent: true, state: "Done" });
        expect(detail.messages.find((message) => message.isResult)?.text).toContain("42");
        expect(detail.messages.at(-1)).toMatchObject({ sender: "agent" });
        expect(detail.messages.at(-1)?.text).toContain("42");
      }).pipe(
        Effect.provide(
          serviceLayer({
            filename: join(directory, "iskios.sqlite"),
            harness: claudeHarnessLayer({
              command: process.env.ISKIOS_CLAUDE_PATH ?? "claude",
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

  const liveLayer = (directory: string) =>
    serviceLayer({
      filename: join(directory, "iskios.sqlite"),
      harness: claudeHarnessLayer({
        command: process.env.ISKIOS_CLAUDE_PATH ?? "claude",
        idleTimeout: "1 minute",
        sandboxProblem: null,
      }),
      homeFolder: directory,
      scratchRoot: join(directory, "missions"),
    });
  const settleLive = (missionId: MissionId, check: (detail: MissionDetail) => boolean) =>
    Effect.gen(function* () {
      for (let i = 0; i < 1200; i++) {
        const detail = yield* read(missionId);
        if (check(detail)) return detail;
        yield* Effect.sleep("100 millis");
      }
      return yield* Effect.die(new Error(`did not settle: ${JSON.stringify(yield* read(missionId))}`));
    });

  it.live(
    "takes a steered message into the running turn",
    () => {
      const directory = temporary();
      return Effect.gen(function* () {
        const started = yield* call({
          _tag: "StartMission",
          effort: "low",
          model: "haiku",
          requestId: "r1",
          text: "Run the bash command `sleep 8` exactly once, then reply with one short sentence.",
          workspacePath: null,
        });
        yield* settleLive(started.missionId, (detail) => detail.thread.state === "Running");
        yield* Effect.sleep("4 seconds");
        const steered = yield* call({
          _tag: "SendMessage",
          delivery: "Steer",
          requestId: "r2",
          text: "Also end your final answer with the word PINEAPPLE.",
          threadId: started.threadId,
        });
        const detail = yield* settleLive(
          started.missionId,
          (d) => d.thread.state === "Idle" || d.thread.state === "Failed",
        );
        expect(detail.thread.failure).toBeNull();
        expect(detail.messages.at(-1)?.text).toContain("PINEAPPLE");
        expect(detail.messages.find((message) => message.id === steered.messageId)?.isQueued).toBe(false);
        // Taken in by the first turn: the steered message comes before the turn's last reply.
        const replies = detail.messages.filter((message) => message.sender === "agent");
        expect(replies.length).toBeGreaterThan(0);
      }).pipe(Effect.provide(liveLayer(directory)));
    },
    180_000,
  );

  it.live(
    "interrupts a running turn and keeps the thread usable",
    () => {
      const directory = temporary();
      return Effect.gen(function* () {
        const started = yield* call({
          _tag: "StartMission",
          effort: "low",
          model: "haiku",
          requestId: "r1",
          text: "Run this bash command exactly once in the foreground and wait for it: `for i in $(seq 1 60); do echo tick $i; sleep 1; done`. Then reply with: done.",
          workspacePath: null,
        });
        yield* settleLive(started.missionId, (detail) => detail.thread.state === "Running");
        yield* Effect.sleep("5 seconds");
        const before = Date.now();
        yield* call({ _tag: "InterruptThread", threadId: started.threadId });
        const interrupted = yield* settleLive(started.missionId, (detail) => detail.thread.state !== "Running");
        expect(Date.now() - before).toBeLessThan(15_000);
        expect(interrupted.thread).toMatchObject({ failure: null, state: "Idle" });

        yield* call({
          _tag: "SendMessage",
          delivery: null,
          requestId: "r2",
          text: "Reply with exactly: ok",
          threadId: started.threadId,
        });
        const detail = yield* settleLive(
          started.missionId,
          (d) => d.thread.state === "Idle" && d.messages.at(-1)?.sender === "agent",
        );
        expect(detail.thread.failure).toBeNull();
        expect(detail.messages.at(-1)?.text.toLowerCase()).toContain("ok");
      }).pipe(Effect.provide(liveLayer(directory)));
    },
    180_000,
  );
});

describe("telling a Claude Code thread its budget", () => {
  it.live("keeps one process as the budget line changes, and gives the line with the turn", () => {
    const { layer, starts } = withClaude();
    return Effect.gen(function* () {
      const started = yield* call({
        _tag: "StartMission",
        effort: "default",
        model: "default",
        requestId: "b1",
        text: "One",
        workspacePath: null,
      });
      yield* settle(started.missionId, idleWith(1));
      yield* call({ _tag: "SetMissionBudget", limits: { cost: null, tokens: 100000 }, missionId: started.missionId });
      yield* call({ _tag: "SendMessage", delivery: null, requestId: "b2", text: "Two", threadId: started.threadId });
      yield* settle(started.missionId, idleWith(2));
      yield* call({ _tag: "SendMessage", delivery: null, requestId: "b3", text: "Three", threadId: started.threadId });
      const detail = yield* settle(started.missionId, idleWith(3));
      expect(starts()).toHaveLength(1);
      expect(detail.messages.at(-1)?.text).toContain("Budget: ");
    }).pipe(Effect.provide(layer));
  });
});

describe("holding a failed thread at a reached budget", () => {
  it.live(
    "holds the message to a Failed thread in Attention and runs it once the budget is raised",
    () => {
      const { layer } = withClaude({ idleTimeout: "50 millis" });
      return Effect.gen(function* () {
        const started = yield* call({
          _tag: "StartMission",
          effort: "default",
          model: "default",
          requestId: "f1",
          text: "One",
          workspacePath: null,
        });
        yield* settle(started.missionId, idleWith(1));
        // The idle process closes, so the next turn starts one that fails.
        yield* Effect.sleep("200 millis");
        process.env.STAND_IN_MODE = "fail-start";
        yield* call({ _tag: "SendMessage", delivery: null, requestId: "f2", text: "Two", threadId: started.threadId });
        yield* settle(started.missionId, (d) => d.thread.state === "Failed");
        yield* call({ _tag: "SetMissionBudget", limits: { cost: null, tokens: 100 }, missionId: started.missionId });
        process.env.STAND_IN_MODE = "ok";
        yield* call({
          _tag: "SendMessage",
          delivery: null,
          requestId: "f3",
          text: "Three",
          threadId: started.threadId,
        });
        yield* settle(started.missionId, (d) => d.thread.state === "Attention" && d.thread.blocker === "Budget");
        yield* call({ _tag: "SetMissionBudget", limits: { cost: null, tokens: 100000 }, missionId: started.missionId });
        const detail = yield* settle(started.missionId, idleWith(2));
        expect(detail.messages.at(-1)?.text).toContain("Three");
      }).pipe(Effect.provide(layer));
    },
    20_000,
  );
});
