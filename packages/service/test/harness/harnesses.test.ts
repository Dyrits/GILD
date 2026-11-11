import { mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import type {
  AccountId,
  HarnessName,
  MissionDetail,
  MissionId,
  Request,
  RequestTag,
  ResultOf,
} from "@gild/contracts";
import { type Duration, Effect, Layer } from "effect";
import { afterEach } from "vitest";
import { Endpoints, HarnessFailure } from "../../src/core/index.ts";
import { runnerOf } from "../../src/harness/index.ts";
import {
  type FakeUpdates,
  fakeHarnessToolsLayer,
  Harness,
  makeClaudeHarness,
  makeCodexHarness,
  makeOpenCodeHarness,
  routeHarnesses,
  Service,
  serviceLayer,
} from "../../src/index.ts";
import { turnRequestOf } from "../fixtures/turns.ts";

const fixtures = join(import.meta.dirname, "..", "fixtures");

const directories: string[] = [];
afterEach(() => {
  delete process.env.STAND_IN_LOG;
  delete process.env.STAND_IN_CODEX_ACCOUNT;
  delete process.env.STAND_IN_CODEX_LIMITS;
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

interface Logged {
  readonly config?: Record<string, unknown>;
  readonly env?: ReadonlyArray<string>;
  readonly home?: unknown;
  readonly method?: string;
  readonly params?: Record<string, unknown>;
  readonly pid?: number;
}

/** A service whose three adapters run stand-ins, all logging to one file. */
const withHarnesses = (idleTimeout: Duration.Input = "10 minutes") => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), "gild-harnesses-")));
  directories.push(directory);
  const log = join(directory, "log.jsonl");
  process.env.STAND_IN_LOG = log;
  const signIns: Array<string> = [];
  const updates: FakeUpdates = { available: {}, updated: [] };
  const missing = new Set<HarnessName>();
  const accountsRoot = join(directory, "accounts");
  const harness = Layer.effect(
    Harness,
    Effect.gen(function* () {
      return routeHarnesses({
        claude: yield* makeClaudeHarness({
          command: process.execPath,
          idleTimeout,
          prefixArgs: [join(fixtures, "stand-in-claude.mjs")],
          sandboxProblem: null,
          userSettingsPath: join(directory, "no-settings.json"),
        }),
        codex: yield* makeCodexHarness({
          command: process.execPath,
          idleTimeout,
          prefixArgs: [join(fixtures, "stand-in-codex.mjs")],
        }),
        opencode: yield* makeOpenCodeHarness({
          command: process.execPath,
          idleTimeout,
          instructionsFolder: join(directory, "instructions"),
          prefixArgs: [join(fixtures, "stand-in-opencode.mjs")],
        }),
      });
    }),
  );
  const layer = serviceLayer({
    accountsRoot,
    filename: join(directory, "gild.sqlite"),
    harness,
    harnessTools: fakeHarnessToolsLayer(signIns, updates, missing),
    homeFolder: directory,
    scratchRoot: join(directory, "missions"),
  });
  const logged = (): Array<Logged> => {
    try {
      return readFileSync(log, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
    } catch {
      return [];
    }
  };
  const requests = (method: string) => logged().filter((entry) => entry.method === method);
  return { accountsRoot, directory, layer, logged, missing, requests, signIns, updates };
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

const replies = (detail: MissionDetail) =>
  detail.messages.filter((message) => message.sender === "agent").map((message) => message.text);

const idleWith = (count: number) => (detail: MissionDetail) =>
  detail.thread.state === "Idle" && replies(detail).length === count;

const start = (fields: Partial<Extract<Request, { _tag: "StartMission" }>> & { text: string }) =>
  call({
    _tag: "StartMission",
    effort: "default",
    model: "default",
    requestId: crypto.randomUUID(),
    workspacePath: null,
    ...fields,
  });

/** The tool names a thread's MCP endpoint lists, as its harness reads them. */
const listTools = (threadId: string) =>
  Effect.gen(function* () {
    const url = yield* (yield* Endpoints).urlFor(threadId);
    const listed = yield* Effect.promise(async () => {
      const response = await fetch(url, {
        body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "tools/list" }),
        headers: { accept: "application/json, text/event-stream", "content-type": "application/json" },
        method: "POST",
      });
      return (await response.json()) as { result: { tools: Array<{ name: string }> } };
    });
    return listed.result.tools.map((tool) => tool.name);
  });

const answerOpen = (answer: "Allow" | "Deny", message: string | null = null) =>
  Effect.gen(function* () {
    for (let i = 0; i < 300; i++) {
      const [question] = yield* call({ _tag: "ListOpenQuestions" });
      if (question !== undefined)
        return yield* call({ _tag: "AnswerQuestion", answer, message, questionId: question.id });
      yield* Effect.sleep("20 millis");
    }
    return yield* Effect.die(new Error("no question was asked"));
  });

describe("choosing a thread's runner", () => {
  it("keeps the parent's account and model on the parent's harness", () => {
    const parent = { accountId: "work", effort: "high", harness: "codex", model: "gpt-x" } as const;
    expect(runnerOf(parent, {})).toEqual(parent);
    expect(runnerOf(parent, { effort: "low" })).toEqual({ ...parent, effort: "low" });
  });

  it("takes another harness's own sign-in and default model unless chosen", () => {
    const parent = { accountId: "work", effort: "high", harness: "codex", model: "gpt-x" } as const;
    expect(runnerOf(parent, { harness: "claude" })).toEqual({
      accountId: null,
      effort: "high",
      harness: "claude",
      model: "default",
    });
    expect(runnerOf(parent, { accountId: "other", harness: "claude", model: "opus" })).toEqual({
      accountId: "other",
      effort: "high",
      harness: "claude",
      model: "opus",
    });
  });

  it("takes the computer's own sign-in when the account is chosen as null", () => {
    const parent = { accountId: "work", effort: "high", harness: "codex", model: "gpt-x" } as const;
    expect(runnerOf(parent, { accountId: null }).accountId).toBeNull();
  });
});

/** A file that starts like a PNG, which is all the service checks. */
const pngBytes = () =>
  Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20, 1)]);

const attachedPng = () => call({ _tag: "AddAttachment", data: pngBytes().toString("base64"), name: "shot.png" });

describe("handing images to a harness", () => {
  it.live("gives Codex one localImage item per image, by the stored path", () => {
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      const card = yield* attachedPng();
      const started = yield* start({ attachmentIds: [card.id], harness: "codex", model: "gpt-x", text: "See" });
      yield* settle(started.missionId, idleWith(1));
      const input = requests("turn/start")[0]?.params as { input: Array<Record<string, unknown>> };
      expect(input.input[0]).toMatchObject({ text: expect.stringContaining("See"), type: "text" });
      expect(input.input[1]).toMatchObject({ type: "localImage" });
      expect(readFileSync(String(input.input[1]?.path)).subarray(0, 4)).toEqual(pngBytes().subarray(0, 4));
    }).pipe(Effect.provide(layer));
  });

  it.live("gives OpenCode one base64 ACP image block per image", () => {
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      const card = yield* attachedPng();
      const started = yield* start({
        attachmentIds: [card.id],
        harness: "opencode",
        model: "provider/model-a",
        text: "See",
      });
      yield* settle(started.missionId, idleWith(1));
      const params = requests("session/prompt")[0]?.params as { prompt: Array<Record<string, unknown>> } | undefined;
      const prompt = params?.prompt ?? [];
      expect(prompt[0]).toMatchObject({ type: "text" });
      expect(prompt[1]).toEqual({
        data: pngBytes().toString("base64"),
        mimeType: "image/png",
        type: "image",
      });
    }).pipe(Effect.provide(layer));
  });
});

describe("running Codex threads", () => {
  it.live("runs a thread through the app server with its model, effort, tools, and no Gild secrets", () => {
    const { layer, logged, requests } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* start({ effort: "high", harness: "codex", model: "gpt-x", text: "Hello" });
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(replies(detail)).toEqual(["Echo: Hello"]);
      expect(detail.thread).toMatchObject({ accountId: null, accountLabel: "This computer", harness: "codex" });
      // The input counts Codex reports include the cached part, which is counted apart.
      expect(detail.mission.usage).toEqual({ cacheCreation: 1, cacheRead: 30, input: 69, output: 7 });
      // The context is the latest call's input, which includes the cached part, and its output.
      expect((yield* call({ _tag: "ReadThreadPanel", threadId: started.threadId })).context?.tokens).toBe(107);
      const [thread] = requests("thread/start");
      expect(thread?.params).toMatchObject({
        approvalPolicy: "on-request",
        config: { "features.multi_agent": false, project_doc_max_bytes: 0 },
        model: "gpt-x",
        sandbox: "workspace-write",
      });
      expect(JSON.stringify(thread?.params?.config)).toMatch(/"mcp_servers\.gild\.url":"http:\/\/127\.0\.0\.1:\d+\//);
      expect(String(thread?.params?.developerInstructions)).toContain("# Approvals in Gild");
      expect(String(thread?.params?.developerInstructions)).not.toContain("dangerouslyDisableSandbox");
      expect(requests("turn/start")[0]?.params).toMatchObject({ effort: "high", model: "gpt-x" });
      expect(logged().find((entry) => entry.pid !== undefined)?.env).toEqual([]);
    }).pipe(Effect.provide(layer));
  });

  it.live("counts a ChatGPT sign-in's turn as subscription tokens", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* start({ harness: "codex", text: "Hello" });
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(detail.mission.budget.spent).toEqual({ cost: 0, tokens: 107 });
    }).pipe(Effect.provide(layer));
  });

  it.live("counts an API-key sign-in's turn as cost, which Codex reports none for, so no tokens count", () => {
    process.env.STAND_IN_CODEX_ACCOUNT = "apiKey";
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* start({ harness: "codex", text: "Hello" });
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(detail.mission.budget.spent).toEqual({ cost: 0, tokens: 0 });
    }).pipe(Effect.provide(layer));
  });

  it.live("reads an account's plan limits from the app server, once, and keeps the reading", () => {
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      const own = () =>
        call({ _tag: "ReadAccountBudgets" }).pipe(
          Effect.map((budgets) => budgets.find((budget) => budget.harness === "codex" && budget.accountId === null)),
        );
      // The first answer carries none yet and starts the read; the reading arrives with the next.
      yield* own();
      let reading = yield* own();
      for (let attempt = 0; attempt < 100 && (reading?.planLimits ?? null) === null; attempt++) {
        yield* Effect.sleep("50 millis");
        reading = yield* own();
      }
      expect(reading?.planLimits?.windows).toEqual([
        { label: "5-hour", resetsAt: 1794405450000, usedPercent: 40 },
        { label: "Weekly", resetsAt: 1794412621000, usedPercent: 93 },
      ]);
      yield* own();
      yield* own();
      expect(requests("account/rateLimits/read")).toHaveLength(1);
    }).pipe(Effect.provide(layer));
  });

  it.live("gives an API-key account no plan limits, and asks for none", () => {
    process.env.STAND_IN_CODEX_ACCOUNT = "apiKey";
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      for (let attempt = 0; attempt < 5; attempt++) {
        yield* call({ _tag: "ReadAccountBudgets" });
        yield* Effect.sleep("100 millis");
      }
      expect(requests("account/rateLimits/read")).toHaveLength(0);
      const own = (yield* call({ _tag: "ReadAccountBudgets" })).find(
        (budget) => budget.harness === "codex" && budget.accountId === null,
      );
      expect(own?.planLimits).toBeNull();
    }).pipe(Effect.provide(layer));
  });

  it.live("shows no plan limits when the app server cannot give them, and does not ask again at once", () => {
    process.env.STAND_IN_CODEX_LIMITS = "fail";
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      for (let attempt = 0; attempt < 6; attempt++) {
        yield* call({ _tag: "ReadAccountBudgets" });
        yield* Effect.sleep("100 millis");
      }
      expect(requests("account/rateLimits/read")).toHaveLength(1);
      const own = (yield* call({ _tag: "ReadAccountBudgets" })).find(
        (budget) => budget.harness === "codex" && budget.accountId === null,
      );
      expect(own?.planLimits).toBeNull();
    }).pipe(Effect.provide(layer));
  });

  it.live("asks the owner before a sensitive command and runs an ordinary one unasked", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* start({ harness: "codex", text: "run git push origin main" });
      const answered = yield* answerOpen("Allow");
      expect(answered.details).toBe("git push origin main");
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(replies(detail)).toEqual(["git push origin main: accept"]);
      yield* call({ _tag: "SendMessage", delivery: null, requestId: "r2", text: "run ls", threadId: started.threadId });
      const after = yield* settle(started.missionId, idleWith(2));
      expect(replies(after).at(-1)).toBe("ls: accept");
      expect(after.questions.at(-1)?.outcome).toBe("AllowedAutomatically");
    }).pipe(Effect.provide(layer));
  });

  it.live("fails the turn, rather than leave Codex waiting, when the owner cannot be asked", () =>
    Effect.gen(function* () {
      const harness = yield* makeCodexHarness({
        command: process.execPath,
        idleTimeout: "10 minutes",
        prefixArgs: [join(fixtures, "stand-in-codex.mjs")],
      });
      const failure = yield* harness
        .runTurn(
          turnRequestOf({
            askOwner: () => Effect.fail(new HarnessFailure({ reason: "Gild could not ask about Bash." })),
            harness: "codex",
            text: "run git push origin main",
          }),
        )
        .pipe(Effect.flip);
      expect(failure.reason).toBe("Gild could not ask about Bash.");
    }).pipe(Effect.scoped),
  );

  it.live("lists the thread tools without Claude Code's permission prompt tool", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const codex = yield* start({ harness: "codex", text: "Hello" });
      const claude = yield* start({ harness: "claude", text: "Hello" });
      yield* settle(codex.missionId, idleWith(1));
      const codexTools = yield* listTools(codex.threadId);
      const claudeTools = yield* listTools(claude.threadId);
      expect(codexTools).not.toContain("answer_prompt");
      expect(codexTools).toContain("request_approval");
      expect(claudeTools).toContain("answer_prompt");
    }).pipe(Effect.provide(layer));
  });

  it.live("declines a command the owner denies", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* start({ harness: "codex", text: "run git push origin main" });
      yield* answerOpen("Deny");
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(replies(detail)).toEqual(["git push origin main: decline"]);
    }).pipe(Effect.provide(layer));
  });

  it.live("resumes the same Codex thread once an idle process has closed", () => {
    const { layer, requests } = withHarnesses("50 millis");
    return Effect.gen(function* () {
      const started = yield* start({ harness: "codex", text: "one" });
      yield* settle(started.missionId, idleWith(1));
      yield* Effect.sleep("200 millis");
      yield* call({ _tag: "SendMessage", delivery: null, requestId: "r2", text: "two", threadId: started.threadId });
      yield* settle(started.missionId, idleWith(2));
      const first = requests("thread/start")[0];
      expect(first).toBeDefined();
      expect(requests("thread/resume")[0]?.params?.threadId).toMatch(/^codex-thread-\d+$/);
    }).pipe(Effect.provide(layer));
  });

  it.live("hands a Claude Code thread over to Codex with its conversation, in a new Codex thread", () => {
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* start({ text: "Plan the work" });
      yield* settle(started.missionId, idleWith(1));
      yield* call({
        _tag: "ChangeThreadRunner",
        accountId: null,
        effort: "high",
        harness: "codex",
        model: "gpt-x",
        threadId: started.threadId,
      });
      yield* call({
        _tag: "SendMessage",
        delivery: null,
        requestId: "r2",
        text: "Carry on",
        threadId: started.threadId,
      });
      const detail = yield* settle(started.missionId, idleWith(2));
      expect(detail.thread).toMatchObject({ harness: "codex", model: "gpt-x" });
      // A new Codex thread, not a resumed one, and the turn's input holds the earlier conversation.
      expect(requests("thread/start")).toHaveLength(1);
      expect(requests("thread/resume")).toHaveLength(0);
      const input = JSON.stringify(requests("turn/start")[0]?.params?.input);
      expect(input).toContain("Conversation so far");
      expect(input).toContain("Plan the work");
      // The first reply, as the JSON input escapes it.
      expect(input).toContain(JSON.stringify(replies(detail)[0]).slice(1, -1));
      expect(input).toContain("Carry on");
    }).pipe(Effect.provide(layer));
  });

  it.live("takes a steered message into the running turn", () => {
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* start({ harness: "codex", text: "slow 600" });
      yield* settle(started.missionId, (detail) => detail.thread.state === "Running");
      yield* Effect.sleep("150 millis");
      yield* call({
        _tag: "SendMessage",
        delivery: "Steer",
        requestId: "r2",
        text: "also this",
        threadId: started.threadId,
      });
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(replies(detail)).toEqual(["Echo: slow 600 + also this"]);
      expect(requests("turn/start")).toHaveLength(1);
    }).pipe(Effect.provide(layer));
  });

  it.live("ends an interrupted turn without a reply", () => {
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* start({ harness: "codex", text: "slow 5000" });
      yield* settle(started.missionId, (detail) => detail.thread.state === "Running");
      yield* Effect.sleep("150 millis");
      yield* call({ _tag: "InterruptThread", threadId: started.threadId });
      const detail = yield* settle(started.missionId, (d) => d.thread.state === "Idle");
      expect(replies(detail)).toEqual([]);
      expect(requests("turn/interrupt")).toHaveLength(1);
    }).pipe(Effect.provide(layer));
  });

  it.live("fails the thread with Codex's reason when a turn fails", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* start({ harness: "codex", text: "fail" });
      const detail = yield* settle(started.missionId, (d) => d.thread.state === "Failed");
      expect(detail.thread.failure).toBe("stand-in: the turn failed");
    }).pipe(Effect.provide(layer));
  });
});

describe("running OpenCode threads", () => {
  it.live("runs a thread over ACP with Gild's tools, permissions, context, and model", () => {
    const { layer, logged, requests } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* start({ harness: "opencode", model: "provider/model-a", text: "Hello" });
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(replies(detail)).toEqual(["Echo: Hello "]);
      expect(detail.mission.usage).toEqual({ cacheCreation: 0, cacheRead: 40, input: 90, output: 8 });
      expect((yield* call({ _tag: "ReadThreadPanel", threadId: started.threadId })).context?.tokens).toBe(138);
      const process = logged().find((entry) => entry.pid !== undefined);
      expect(process?.env).toEqual([]);
      const config = process?.config as {
        instructions: Array<string>;
        mcp: { servers: Record<string, { url: string }> };
        permissions: Array<{ action: string; effect: string }>;
      };
      expect(config.permissions).toEqual([
        { action: "shell", effect: "ask", resource: "*" },
        { action: "edit", effect: "ask", resource: "*" },
        { action: "subagent", effect: "deny", resource: "*" },
      ]);
      expect(config.mcp.servers.gild?.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\//);
      expect(readFileSync(config.instructions[0] ?? "", "utf8")).toContain("# Threads in Gild");
      expect(requests("session/set_config_option")[0]?.params).toMatchObject({
        configId: "model",
        value: "provider/model-a",
      });
    }).pipe(Effect.provide(layer));
  });

  it.live("carries on in the same turn after the owner's refusal cancels OpenCode's prompt", () => {
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* start({ harness: "opencode", text: "run git push origin main" });
      yield* answerOpen("Deny");
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(replies(detail)).toEqual([
        "Echo: Gild refused the command `git push origin main`. Not approved by the owner. Do not do this action; carry on without it. ",
      ]);
      expect(requests("session/prompt")).toHaveLength(2);
      expect(detail.mission.usage).toEqual({ cacheCreation: 0, cacheRead: 80, input: 180, output: 16 });
    }).pipe(Effect.provide(layer));
  });

  it.live("gives OpenCode the owner's message with a refusal", () => {
    const { directory, layer } = withHarnesses();
    const outside = join(directory, "outside.txt");
    return Effect.gen(function* () {
      const started = yield* start({ harness: "opencode", text: `edit ${outside}` });
      yield* answerOpen("Deny", "Write it in the notes folder instead.");
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(replies(detail)).toEqual([
        `Echo: Gild refused the change to \`${outside}\`. Denied by the owner: Write it in the notes folder instead. `,
      ]);
    }).pipe(Effect.provide(layer));
  });

  it.live("sends no refusal after an interrupt cancels a prompt waiting on a question", () => {
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* start({ harness: "opencode", text: "run git push origin main" });
      yield* settle(started.missionId, (detail) => detail.questions.length === 1);
      yield* call({ _tag: "InterruptThread", threadId: started.threadId });
      const detail = yield* settle(started.missionId, (d) => d.thread.state === "Idle");
      yield* Effect.sleep("200 millis");
      expect(replies(detail)).toEqual([]);
      expect(requests("session/prompt")).toHaveLength(1);
    }).pipe(Effect.provide(layer));
  });

  it.live("keeps the usage of a turn's earlier prompts when OpenCode exits during an interrupt", () => {
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* start({ harness: "opencode", text: "fragile run git push origin main" });
      yield* answerOpen("Deny");
      for (let i = 0; i < 100 && requests("session/prompt").length < 2; i++) yield* Effect.sleep("10 millis");
      yield* call({ _tag: "InterruptThread", threadId: started.threadId });
      const detail = yield* settle(started.missionId, (d) => d.thread.state === "Idle");
      expect(detail.mission.usage).toEqual({ cacheCreation: 0, cacheRead: 40, input: 90, output: 8 });
    }).pipe(Effect.provide(layer));
  });

  it.live("lets an edit inside the thread's folder run without a question", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* start({ harness: "opencode", text: "edit notes/plan.md" });
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(replies(detail)).toEqual(["notes/plan.md: once "]);
      expect(detail.questions).toEqual([]);
    }).pipe(Effect.provide(layer));
  });

  it.live("asks the owner before an edit outside the thread's folder", () => {
    const { directory, layer } = withHarnesses();
    const outside = join(directory, "outside.txt");
    return Effect.gen(function* () {
      const started = yield* start({ harness: "opencode", text: `edit ${outside}` });
      const answered = yield* answerOpen("Deny");
      expect(answered.details).toBe(`Edit ${outside}`);
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(replies(detail)).toEqual([
        `Echo: Gild refused the change to \`${outside}\`. Not approved by the owner. Do not do this action; carry on without it. `,
      ]);
    }).pipe(Effect.provide(layer));
  });

  it.live("asks the owner before a relative edit that climbs out of the thread's folder", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* start({ harness: "opencode", text: "edit ../../outside.txt" });
      yield* answerOpen("Allow");
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(replies(detail)).toEqual(["../../outside.txt: once "]);
    }).pipe(Effect.provide(layer));
  });

  it.live("loads its session again after an idle close, without saving the replayed conversation", () => {
    const { layer, requests } = withHarnesses("50 millis");
    return Effect.gen(function* () {
      const started = yield* start({ harness: "opencode", text: "one" });
      yield* settle(started.missionId, idleWith(1));
      yield* Effect.sleep("200 millis");
      yield* call({ _tag: "SendMessage", delivery: null, requestId: "r2", text: "two", threadId: started.threadId });
      const detail = yield* settle(started.missionId, idleWith(2));
      expect(replies(detail)).toEqual(["Echo: one ", "Echo: two "]);
      expect(requests("session/load")[0]?.params?.sessionId).toMatch(/^ses-\d+$/);
    }).pipe(Effect.provide(layer));
  });

  it.live("cancels an interrupted prompt and counts the usage OpenCode reports for it", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* start({ harness: "opencode", text: "slow 5000" });
      yield* settle(started.missionId, (detail) => detail.thread.state === "Running");
      yield* Effect.sleep("150 millis");
      yield* call({ _tag: "InterruptThread", threadId: started.threadId });
      const detail = yield* settle(started.missionId, (d) => d.thread.state === "Idle");
      expect(replies(detail)).toEqual([]);
      expect(detail.mission.usage).toEqual({ cacheCreation: 0, cacheRead: 40, input: 90, output: 8 });
    }).pipe(Effect.provide(layer));
  });
});

describe("managing provider accounts", () => {
  it.live("lists every harness with the computer's own sign-in first", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const { harnesses } = yield* call({ _tag: "ListHarnesses" });
      expect(harnesses.map((harness) => harness.name)).toEqual(["claude", "codex", "opencode"]);
      for (const harness of harnesses) {
        expect(harness.accounts[0]).toMatchObject({ id: null, label: "This computer", signIn: "SignedIn" });
        expect(harness.models.map((model) => model.id)).not.toContain("default");
      }
      expect(harnesses[0]?.models.map((model) => model.label)).toEqual([
        "Fable 5.2",
        "Opus 5.5",
        "Sonnet 5.5",
        "Haiku 5.5",
      ]);
    }).pipe(Effect.provide(layer));
  });

  it.live("offers an update only to a harness with a newer version, and updates it", () => {
    const { layer, updates } = withHarnesses();
    updates.available.codex = "0.167.0";
    return Effect.gen(function* () {
      const before = yield* call({ _tag: "ListHarnesses" });
      expect(before.harnesses.map((harness) => harness.update)).toEqual([null, "0.167.0", null]);
      const after = yield* call({ _tag: "UpdateHarness", harness: "codex" });
      expect(updates.updated).toEqual(["codex"]);
      expect(after.harnesses.map((harness) => harness.update)).toEqual([null, null, null]);
    }).pipe(Effect.provide(layer));
  });

  it.live("installs a missing harness and returns its refreshed status", () => {
    const { layer, missing } = withHarnesses();
    missing.add("codex");
    return Effect.gen(function* () {
      const before = yield* call({ _tag: "ListHarnesses" });
      expect(before.harnesses[1]?.problem).toBe("Not installed");
      const result = yield* call({ _tag: "InstallHarness", harness: "codex" });
      expect(missing.has("codex")).toBe(false);
      expect(result.harnesses[1]).toMatchObject({ problem: null, version: "fake" });
    }).pipe(Effect.provide(layer));
  });

  it.live("refuses installation over a working harness", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const result = yield* call({ _tag: "InstallHarness", harness: "codex" }).pipe(Effect.flip);
      expect(result.message).toContain("already installed");
    }).pipe(Effect.provide(layer));
  });

  it.live("runs a thread with an added account's own folder", () => {
    const { accountsRoot, layer, logged } = withHarnesses();
    return Effect.gen(function* () {
      const added = yield* call({ _tag: "AddAccount", harness: "codex", label: " Work " });
      const account = added.harnesses.find((harness) => harness.name === "codex")?.accounts[1];
      expect(account).toMatchObject({ label: "Work", signIn: "SignedIn" });
      const accountId = account?.id as AccountId;
      const started = yield* start({ accountId, harness: "codex", text: "Hello" });
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(detail.thread).toMatchObject({ accountId, accountLabel: "Work", harness: "codex" });
      expect(logged().find((entry) => entry.pid !== undefined)?.home).toEqual({
        CODEX_HOME: join(accountsRoot, accountId),
      });
      expect(yield* call({ _tag: "ReadStartChoices" })).toMatchObject({ accountId, harness: "codex" });
    }).pipe(Effect.provide(layer));
  });

  it.live("runs Claude Code with an added account's own configuration folder", () => {
    const { accountsRoot, layer, logged } = withHarnesses();
    return Effect.gen(function* () {
      const added = yield* call({ _tag: "AddAccount", harness: "claude", label: "Second" });
      const accountId = added.harnesses[0]?.accounts[1]?.id as AccountId;
      const started = yield* start({ accountId, harness: "claude", text: "Hello" });
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(detail.thread.accountLabel).toBe("Second");
      expect(logged().find((entry) => entry.pid !== undefined)?.home).toBe(join(accountsRoot, accountId));
    }).pipe(Effect.provide(layer));
  });

  it.live("refuses an account of another harness", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const added = yield* call({ _tag: "AddAccount", harness: "codex", label: "Work" });
      const accountId = added.harnesses[1]?.accounts[1]?.id as AccountId;
      const refused = yield* start({ accountId, harness: "claude", text: "Hello" }).pipe(Effect.flip);
      expect(refused.message).toBe("No such Claude Code account.");
    }).pipe(Effect.provide(layer));
  });

  it.live("refuses to remove an account a mission still uses, and removes it once the mission ended", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const added = yield* call({ _tag: "AddAccount", harness: "codex", label: "Work" });
      const accountId = added.harnesses[1]?.accounts[1]?.id as AccountId;
      const started = yield* start({ accountId, harness: "codex", text: "Hello" });
      yield* settle(started.missionId, idleWith(1));
      const refused = yield* call({ _tag: "RemoveAccount", accountId }).pipe(Effect.flip);
      expect(refused.message).toContain('run on "Work"');
      const preview = yield* call({ _tag: "PreviewEnding", ending: "Archived", missionId: started.missionId });
      yield* call({ _tag: "EndMission", ending: "Archived", missionId: started.missionId, snapshot: preview.snapshot });
      const removed = yield* call({ _tag: "RemoveAccount", accountId });
      expect(removed.harnesses[1]?.accounts).toHaveLength(1);
      expect((yield* read(started.missionId)).thread.accountLabel).toBe("Removed account");
    }).pipe(Effect.provide(layer));
  });

  it.live("fails a turn on a removed account with the reason, without starting the harness", () => {
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      const added = yield* call({ _tag: "AddAccount", harness: "codex", label: "Work" });
      const accountId = added.harnesses[1]?.accounts[1]?.id as AccountId;
      const started = yield* start({ accountId, harness: "codex", text: "Hello" });
      yield* settle(started.missionId, idleWith(1));
      const preview = yield* call({ _tag: "PreviewEnding", ending: "Archived", missionId: started.missionId });
      yield* call({ _tag: "EndMission", ending: "Archived", missionId: started.missionId, snapshot: preview.snapshot });
      yield* call({ _tag: "RemoveAccount", accountId });
      yield* call({ _tag: "ReopenMission", missionId: started.missionId });
      const turns = requests("turn/start").length;
      yield* call({ _tag: "SendMessage", delivery: null, requestId: "r2", text: "two", threadId: started.threadId });
      const failed = yield* settle(started.missionId, (detail) => detail.thread.state === "Failed");
      expect(failed.thread.failure).toContain("removed");
      expect(requests("turn/start")).toHaveLength(turns);
    }).pipe(Effect.provide(layer));
  });

  it.live("opens the harness's own sign-in pointed at the account's folder", () => {
    const { accountsRoot, layer, signIns } = withHarnesses();
    return Effect.gen(function* () {
      const added = yield* call({ _tag: "AddAccount", harness: "claude", label: "Second" });
      const accountId = added.harnesses[0]?.accounts[1]?.id as AccountId;
      yield* call({ _tag: "SignInAccount", accountId, harness: "claude" });
      yield* call({ _tag: "SignInAccount", accountId: null, harness: "opencode" });
      expect(signIns).toEqual([`claude:${join(accountsRoot, accountId)}`, "opencode:"]);
    }).pipe(Effect.provide(layer));
  });

  it.live("lets a thread open a thread on another harness", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* start({
        harness: "codex",
        model: "gpt-x",
        text: 'call open_thread {"request":"Hello from below","harness":"opencode"}',
      });
      const parent = yield* settle(started.missionId, (detail) => detail.threads.length === 2 && idleWith(1)(detail));
      const childId = parent.threads[1]?.id;
      expect(childId).toBeDefined();
      for (let i = 0; i < 300; i++) {
        const child = yield* call({ _tag: "ReadMission", missionId: started.missionId, threadId: childId ?? null });
        if (replies(child).length === 1) {
          // On another harness the thread starts on that harness's own sign-in and default model.
          expect(child.thread).toMatchObject({ accountId: null, harness: "opencode", model: "default" });
          expect(replies(child)[0]).toMatch(/^Echo: Message from thread .*\nHello from below $/s);
          return;
        }
        yield* Effect.sleep("20 millis");
      }
      expect.fail("the thread beneath never replied");
    }).pipe(Effect.provide(layer));
  });
});
