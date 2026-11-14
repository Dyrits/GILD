import { spawn } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
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
  ThreadId,
} from "@iskios/contracts";
import { type Duration, Effect, Layer } from "effect";
import { afterEach } from "vitest";
import { Endpoints, HarnessFailure } from "../../src/core/index.ts";
import { runnerOf } from "../../src/harness/index.ts";
import { type OpenCodeSandbox, ownerMarkerOf } from "../../src/harness/openCodeSandbox.ts";
import { isOpenCodeCommand, markedProcessesOf } from "../../src/harness/processTree.ts";
import {
  type FakeUpdates,
  fakeHarnessToolsLayer,
  Harness,
  HarnessTools,
  listOpenCodeEfforts,
  liveHarnessToolsLayer,
  makeClaudeHarness,
  makeCodexHarness,
  makeOpenCodeHarness,
  routeHarnesses,
  Service,
  serviceLayer,
} from "../../src/index.ts";
import { computerNameOf } from "../../src/remote/config.ts";
import { callTool } from "../fixtures/mcp.ts";
import { turnRequestOf } from "../fixtures/turns.ts";

const fixtures = join(import.meta.dirname, "..", "fixtures");

const directories: string[] = [];
afterEach(() => {
  delete process.env.STAND_IN_LOG;
  delete process.env.STAND_IN_CODEX_ACCOUNT;
  delete process.env.STAND_IN_CODEX_LIMITS;
  delete process.env.STAND_IN_CODEX_START_DELAY;
  delete process.env.STAND_IN_OPENCODE_LIMITS;
  delete process.env.STAND_IN_OPENCODE_CHILD;
  delete process.env.STAND_IN_OPENCODE_EXECUTOR;
  delete process.env.STAND_IN_OPENCODE_MISSING_SESSIONS;
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

/** Folders standing for the computer's own OpenCode configuration and data, outside every writable folder. */
const realHomes = () => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), "iskios-real-")));
  directories.push(directory);
  return directory;
};

/** Seatbelt as the service sets it up, with the computer's own folders in `real`. */
const seatbeltIn =
  (real: string) =>
  (root: string): OpenCodeSandbox => ({
    // The checks' own log sits in the temporary folder, so it is a writable cache here.
    caches: [root],
    command: "/usr/bin/sandbox-exec",
    computerConfigHome: join(real, "config"),
    computerDataHome: join(real, "share"),
    kind: "seatbelt",
    root: join(root, "opencode-sandbox"),
  });

const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

interface Logged {
  readonly args?: ReadonlyArray<string>;
  readonly auth?: string;
  readonly config?: Record<string, unknown>;
  readonly cwd?: string;
  readonly data?: string;
  readonly env?: ReadonlyArray<string>;
  readonly executor?: number;
  readonly grandchild?: number;
  readonly home?: unknown;
  readonly method?: string;
  readonly params?: Record<string, unknown>;
  readonly pid?: number;
  readonly pwd?: string | null;
  readonly xdg?: Record<string, string | null>;
}

/** A service whose three adapters run stand-ins, all logging to one file; OpenCode wrapped when a sandbox is given. */
const withHarnesses = (
  idleTimeout: Duration.Input = "10 minutes",
  openCodeSandbox: (directory: string) => OpenCodeSandbox | null = () => null,
) => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), "iskios-harnesses-")));
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
          sandbox: openCodeSandbox(directory),
        }),
      });
    }),
  );
  const layer = serviceLayer({
    accountsRoot,
    filename: join(directory, "iskios.sqlite"),
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

/**
 * Waits until the stand-in harness has received `method`. A thread reads Running while its harness process still starts,
 * and an interrupt or a steered message sent then finds no turn to act on, so a test sends one only once the turn is under way.
 */
const untilRequested = (requests: (method: string) => ReadonlyArray<unknown>, method: string) =>
  Effect.gen(function* () {
    for (let i = 0; i < 500 && requests(method).length < 1; i++) yield* Effect.sleep("10 millis");
    if (requests(method).length < 1) return yield* Effect.die(new Error(`the harness never received ${method}`));
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

/** The first open question, once one is asked. */
const openQuestionOf = () =>
  Effect.gen(function* () {
    for (let i = 0; i < 300; i++) {
      const [question] = yield* call({ _tag: "ListOpenQuestions" });
      if (question !== undefined) return question;
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
  it.live("runs a thread through the app server with its model, effort, tools, and no Iskios secrets", () => {
    const { layer, logged, requests } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* start({ effort: "high", harness: "codex", model: "gpt-x", text: "Hello" });
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(replies(detail)).toEqual(["Echo: Hello"]);
      expect(detail.thread).toMatchObject({ accountId: null, accountLabel: computerNameOf(), harness: "codex" });
      // The input counts Codex reports include the cached part, which is counted apart.
      expect(detail.mission.usage).toEqual({ cacheCreation: 1, cacheRead: 30, input: 69, output: 7 });
      // The context is the latest call's input, which includes the cached part, and its output.
      expect((yield* call({ _tag: "ReadThreadPanel", threadId: started.threadId })).context?.tokens).toBe(107);
      const [thread] = requests("thread/start");
      expect(thread?.params).toMatchObject({
        approvalPolicy: "on-request",
        // Codex's own workspace sandbox, with its network open; never its full-access mode.
        config: {
          "features.multi_agent": false,
          project_doc_max_bytes: 0,
          "sandbox_workspace_write.network_access": true,
        },
        model: "gpt-x",
        sandbox: "workspace-write",
      });
      expect(JSON.stringify(logged())).not.toContain("danger-full-access");
      expect(JSON.stringify(thread?.params?.config)).toMatch(/"mcp_servers\.iskios\.url":"http:\/\/127\.0\.0\.1:\d+\//);
      expect(String(thread?.params?.developerInstructions)).toContain("# Approvals in Iskios");
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

  it.live("reads an OpenCode account's Go plan limits from its own local API, once, in three windows", () => {
    const { layer, logged } = withHarnesses();
    return Effect.gen(function* () {
      const own = () =>
        call({ _tag: "ReadAccountBudgets" }).pipe(
          Effect.map((budgets) => budgets.find((budget) => budget.harness === "opencode" && budget.accountId === null)),
        );
      yield* own();
      let reading = yield* own();
      for (let attempt = 0; attempt < 100 && (reading?.planLimits ?? null) === null; attempt++) {
        yield* Effect.sleep("50 millis");
        reading = yield* own();
      }
      expect(reading?.planLimits?.windows).toEqual([
        { label: "5-hour", resetsAt: 1794481927000, usedPercent: 12 },
        { label: "Weekly", resetsAt: 1794787200000, usedPercent: 40 },
        { label: "Monthly", resetsAt: 1796315927000, usedPercent: 7 },
      ]);
      yield* own();
      yield* own();
      expect(logged().filter((entry) => entry.method === "usage/limits")).toHaveLength(1);
    }).pipe(Effect.provide(layer));
  });

  for (const [reason, mode] of [
    ["is not signed in to its Console", "none"],
    ["cannot answer", "fail"],
  ] as const) {
    it.live(`shows no OpenCode plan limits when it ${reason}, and does not ask again at once`, () => {
      process.env.STAND_IN_OPENCODE_LIMITS = mode;
      const { layer, logged } = withHarnesses();
      return Effect.gen(function* () {
        for (let attempt = 0; attempt < 6; attempt++) {
          yield* call({ _tag: "ReadAccountBudgets" });
          yield* Effect.sleep("150 millis");
        }
        expect(logged().filter((entry) => entry.method === "usage/limits")).toHaveLength(1);
        const own = (yield* call({ _tag: "ReadAccountBudgets" })).find(
          (budget) => budget.harness === "opencode" && budget.accountId === null,
        );
        expect(own?.planLimits).toBeNull();
      }).pipe(Effect.provide(layer));
    });
  }

  it.live("asks the owner, naming the exact command, before any command Codex would run outside its sandbox", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* start({ harness: "codex", text: "run ls" });
      const answered = yield* answerOpen("Allow");
      expect(answered).toMatchObject({ details: "ls", permission: "Run outside the sandbox" });
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(replies(detail)).toEqual(["ls: accept"]);
    }).pipe(Effect.provide(layer));
  });

  it.live(
    "asks about a command as an ordinary one, not an escape, at the level asking before commands and edits",
    () => {
      const { layer } = withHarnesses();
      return Effect.gen(function* () {
        const settings = yield* call({ _tag: "ReadSettings" });
        yield* call({ _tag: "UpdateSettings", settings: { ...settings, approvalLevel: "CommandsAndEdits" } });
        const started = yield* start({ harness: "codex", text: "run ls" });
        const answered = yield* answerOpen("Allow");
        expect(answered).toMatchObject({ details: "ls", permission: "Run a command" });
        expect(answered.summary).not.toContain("outside the sandbox");
        expect(replies(yield* settle(started.missionId, idleWith(1)))).toEqual(["ls: accept"]);
      }).pipe(Effect.provide(layer));
    },
  );

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
            askOwner: () => Effect.fail(new HarnessFailure({ reason: "Iskios could not ask about Bash." })),
            harness: "codex",
            text: "run git push origin main",
          }),
        )
        .pipe(Effect.flip);
      expect(failure.reason).toBe("Iskios could not ask about Bash.");
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

  it.live("refuses Claude Code's permission prompt tool to a harness that does not use it", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const codex = yield* start({ harness: "codex", text: "Hello" });
      yield* settle(codex.missionId, idleWith(1));
      const answered = yield* callTool(codex.threadId, "answer_prompt", {
        input: { command: "echo dummy" },
        tool_name: "Bash",
      });
      expect(answered.result.isError).toBe(true);
      expect(answered.result.content[0]?.text).toBe("This tool is not available to this thread.");
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
      yield* untilRequested(requests, "turn/start");
      // The adapter learns the turn's id from Codex's answer to `turn/start`, a moment after the stand-in logs the
      // request; a message steered before that waits for the next turn, as designed, which this test is not about.
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
      yield* untilRequested(requests, "turn/start");
      yield* call({ _tag: "InterruptThread", threadId: started.threadId });
      const detail = yield* settle(started.missionId, (d) => d.thread.state === "Idle");
      expect(replies(detail)).toEqual([]);
      expect(requests("turn/interrupt")).toHaveLength(1);
    }).pipe(Effect.provide(layer));
  });

  it.live("ends a turn interrupted before Codex has answered turn/start, once it has the turn", () => {
    process.env.STAND_IN_CODEX_START_DELAY = "300";
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* start({ harness: "codex", text: "slow 5000" });
      yield* untilRequested(requests, "turn/start");
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
  it.live("runs a thread over ACP with Iskios's tools, permissions, context, and model", () => {
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
      expect(config.mcp.servers.iskios?.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\//);
      expect(readFileSync(config.instructions[0] ?? "", "utf8")).toContain("# Threads in Iskios");
      expect(requests("session/set_config_option")[0]?.params).toMatchObject({
        configId: "model",
        value: "provider/model-a",
      });
    }).pipe(Effect.provide(layer));
  });

  it.live("sets the chosen effort on OpenCode's session after its model", () => {
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* start({ effort: "high", harness: "opencode", model: "provider/model-a", text: "Hello" });
      yield* settle(started.missionId, idleWith(1));
      expect(requests("session/set_config_option").map((request) => request.params)).toMatchObject([
        { configId: "model", value: "provider/model-a" },
        { configId: "effort", value: "high" },
      ]);
    }).pipe(Effect.provide(layer));
  });

  it.live("reads a model's effort levels from OpenCode, none for a model without them", () =>
    Effect.gen(function* () {
      const standIn = [join(fixtures, "stand-in-opencode.mjs")];
      expect(yield* listOpenCodeEfforts(process.execPath, null, "provider/model-a", standIn)).toEqual(["none", "high"]);
      expect(yield* listOpenCodeEfforts(process.execPath, null, "provider/plain", standIn)).toEqual([]);
    }),
  );

  it.live("an OpenCode that cannot be asked for effort levels fails, which is not a model without levels", () =>
    Effect.gen(function* () {
      const failure = yield* listOpenCodeEfforts(join(tmpdir(), "no-such-opencode"), null, "provider/model-a").pipe(
        Effect.flip,
      );
      expect(JSON.stringify(failure)).toContain("effort levels");
    }),
  );

  it.live("reads OpenCode's effort levels ahead when it lists its models, so a pick starts no session", () => {
    const directory = realpathSync(mkdtempSync(join(tmpdir(), "iskios-warm-")));
    directories.push(directory);
    const log = join(directory, "log.jsonl");
    process.env.STAND_IN_LOG = log;
    // A command that lists two models and runs the stand-in as `opencode acp`.
    const command = join(directory, "opencode");
    writeFileSync(
      command,
      `#!/bin/sh\nif [ "$1" = models ]; then printf 'provider/model-a\\nprovider/plain\\n'; exit 0; fi\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(join(fixtures, "stand-in-opencode.mjs"))} "$@"\n`,
    );
    chmodSync(command, 0o755);
    const sessions = () =>
      (existsSync(log) ? readFileSync(log, "utf8") : "").split("\n").filter((line) => line.includes('"pid"')).length;
    return Effect.gen(function* () {
      const tools = yield* HarnessTools;
      const listed = yield* tools.listModels("opencode", null);
      expect(listed.map((option) => option.id)).toEqual(["provider/model-a", "provider/plain"]);
      // The levels are read in the background; wait for both models' sessions.
      for (let i = 0; i < 100 && sessions() < 2; i++) yield* Effect.sleep("100 millis");
      yield* Effect.sleep("500 millis");
      const before = sessions();
      expect(before).toBe(2);
      // A pick now answers from what was kept, without opening a session.
      expect(yield* tools.listEfforts("opencode", null, "provider/model-a")).toEqual(["none", "high"]);
      expect(sessions()).toBe(before);
    }).pipe(Effect.provide(liveHarnessToolsLayer({ claude: "claude", codex: "codex", opencode: command })));
  });

  it.live("carries on in the same turn after the owner's refusal cancels OpenCode's prompt", () => {
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* start({ harness: "opencode", text: "run git push origin main" });
      yield* answerOpen("Deny");
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(replies(detail)).toEqual([
        "Echo: Iskios refused the command `git push origin main`. Not approved by the owner. Do not do this action; carry on without it. ",
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
        `Echo: Iskios refused the change to \`${outside}\`. Denied by the owner: Write it in the notes folder instead. `,
      ]);
    }).pipe(Effect.provide(layer));
  });

  it.live("asks about the file outside the folder when one edit names a file inside and one outside", () => {
    const { directory, layer } = withHarnesses();
    const outside = join(directory, "outside.txt");
    return Effect.gen(function* () {
      const started = yield* start({ harness: "opencode", text: `edit inside.txt and ${outside}` });
      const detail = yield* settle(started.missionId, (current) => current.questions.length === 1);
      expect(detail.questions[0]?.details).toContain(outside);
      expect(detail.questions[0]?.outcome).toBeNull();
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
      expect(answered.details).toBe(`Edit ${outside}\n${JSON.stringify({ file_path: outside }, null, 2)}`);
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(replies(detail)).toEqual([
        `Echo: Iskios refused the change to \`${outside}\`. Not approved by the owner. Do not do this action; carry on without it. `,
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

  it.live("asks before every command when no sandbox protects OpenCode, naming it exactly", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* start({ harness: "opencode", text: "run ls" });
      const answered = yield* answerOpen("Allow");
      expect(answered).toMatchObject({ details: "ls", permission: "Run without a sandbox" });
      expect(replies(yield* settle(started.missionId, idleWith(1)))).toEqual(["ls: once "]);
    }).pipe(Effect.provide(layer));
  });

  it.live.skipIf(process.platform !== "darwin")(
    "runs OpenCode inside Seatbelt: commands go unasked, and writes land only in its folders",
    () => {
      const real = realHomes();
      const { directory, layer, logged } = withHarnesses("10 minutes", seatbeltIn(real));
      const elsewhere = realpathSync(mkdtempSync(join(tmpdir(), "iskios-elsewhere-")));
      directories.push(elsewhere);
      return Effect.gen(function* () {
        const started = yield* start({ harness: "opencode", text: "run ls" });
        const detail = yield* settle(started.missionId, idleWith(1));
        expect(replies(detail)).toEqual(["ls: once "]);
        expect(detail.questions.map((question) => question.outcome)).toEqual(["AllowedAutomatically"]);
        const xdg = logged().find((entry) => entry.pid !== undefined)?.xdg;
        // Its data too is the service's copy for this computer's account, never OpenCode's own data folder.
        expect(xdg).toEqual({
          cache: join(directory, "opencode-sandbox", "cache"),
          config: join(directory, "opencode-sandbox", "config"),
          data: join(directory, "opencode-sandbox", "data", "computer"),
          state: join(directory, "opencode-sandbox", "state"),
          tmp: join(directory, "opencode-sandbox", "tmp"),
        });
        const send = (text: string, count: number) =>
          Effect.gen(function* () {
            yield* call({
              _tag: "SendMessage",
              delivery: null,
              requestId: `w${count}`,
              text,
              threadId: started.threadId,
            });
            return replies(yield* settle(started.missionId, idleWith(count))).at(-1);
          });
        const outside = join(elsewhere, "outside.txt");
        expect(yield* send(`write ${outside}`, 2)).toBe(`${outside}: EPERM `);
        expect(existsSync(outside)).toBe(false);
        // A file planted for OpenCode runs outside the sandbox cannot reach its real data folder; the copy takes it,
        // and it never shows in the real folder.
        mkdirSync(join(real, "share", "opencode", "bin"), { recursive: true });
        const planted = join(real, "share", "opencode", "bin", "rg");
        expect(yield* send(`write ${planted}`, 3)).toBe(`${planted}: EPERM `);
        const copied = join(directory, "opencode-sandbox", "data", "computer", "opencode", "plugin.js");
        expect(yield* send(`write ${copied}`, 4)).toBe(`${copied}: written `);
        expect(existsSync(planted)).toBe(false);
        expect(existsSync(join(real, "share", "opencode", "plugin.js"))).toBe(false);
      }).pipe(Effect.provide(layer));
    },
  );

  it.live.skipIf(process.platform !== "darwin")(
    "asks, as for an escape, when no executor descends from the wrapped OpenCode",
    () => {
      // An `acp` that serves from a process outside its own tree (an existing daemon) is not contained by the wrapper.
      process.env.STAND_IN_OPENCODE_EXECUTOR = "none";
      const { layer } = withHarnesses("10 minutes", seatbeltIn(realHomes()));
      return Effect.gen(function* () {
        const started = yield* start({ harness: "opencode", text: "run ls" });
        const answered = yield* answerOpen("Deny");
        expect(answered).toMatchObject({ details: "ls", permission: "Run outside the sandbox" });
        yield* settle(started.missionId, idleWith(1));
      }).pipe(Effect.provide(layer));
    },
  );

  it.live.skipIf(process.platform !== "darwin")(
    "asks before an edit inside the folder too when containment cannot be confirmed",
    () => {
      process.env.STAND_IN_OPENCODE_EXECUTOR = "none";
      const { layer } = withHarnesses("10 minutes", seatbeltIn(realHomes()));
      return Effect.gen(function* () {
        const started = yield* start({ harness: "opencode", text: "edit notes/plan.md" });
        const answered = yield* answerOpen("Deny");
        expect(answered.permission).toBe("Change a file outside the workspace");
        yield* settle(started.missionId, idleWith(1));
      }).pipe(Effect.provide(layer));
    },
  );

  it.live.skipIf(process.platform !== "darwin")(
    "seeds its data copy from the real folder at each start, while the probes keep reading the real folder",
    () => {
      const real = realHomes();
      const { directory, layer, logged } = withHarnesses("50 millis", seatbeltIn(real));
      const copy = join(directory, "opencode-sandbox", "data", "computer");
      const exportsFrom = (data: string) =>
        logged().filter((entry) => entry.auth === "export" && entry.data === data).length;
      return Effect.gen(function* () {
        const started = yield* start({ harness: "opencode", text: "one" });
        yield* settle(started.missionId, idleWith(1));
        expect([exportsFrom(join(real, "share")), exportsFrom(copy)]).toEqual([1, 1]);
        // Closed when idle, then started again for the next message: seeded again.
        yield* Effect.sleep("200 millis");
        yield* call({ _tag: "SendMessage", delivery: null, requestId: "r2", text: "two", threadId: started.threadId });
        yield* settle(started.missionId, idleWith(2));
        expect([exportsFrom(join(real, "share")), exportsFrom(copy)]).toEqual([2, 2]);

        // The plan-limit probe runs outside the sandbox on the account's real folder, as the owner's OpenCode does.
        for (let i = 0; i < 100 && !logged().some((entry) => entry.method === "usage/limits"); i++) {
          yield* call({ _tag: "ReadAccountBudgets" });
          yield* Effect.sleep("50 millis");
        }
        const probe = logged().find((entry) => entry.pid !== undefined && entry.args?.includes("serve"));
        expect(probe?.home).toBe(process.env.XDG_DATA_HOME ?? null);
        expect(probe?.xdg?.config).toBe(process.env.XDG_CONFIG_HOME ?? null);
        // So does the effort probe, here for an added account's folder.
        const account = join(real, "accounts", "work");
        yield* listOpenCodeEfforts(process.execPath, account, "provider/model-a", [
          join(fixtures, "stand-in-opencode.mjs"),
        ]);
        expect(
          logged()
            .filter((entry) => entry.pid !== undefined)
            .at(-1)?.home,
        ).toBe(account);
      }).pipe(Effect.provide(layer));
    },
  );

  it.live.skipIf(process.platform !== "darwin")(
    "ends an executor that outlived its `acp`, found by the service's marker",
    () => {
      process.env.STAND_IN_OPENCODE_EXECUTOR = "survivor";
      const { layer, logged } = withHarnesses("10 minutes", seatbeltIn(realHomes()));
      let executor = -1;
      return Effect.gen(function* () {
        const started = yield* start({ harness: "opencode", text: "Hello" });
        yield* settle(started.missionId, idleWith(1));
        executor = logged().find((entry) => entry.executor !== undefined)?.executor ?? -1;
        const acp = logged().find((entry) => entry.pid !== undefined && entry.args?.includes("acp"))?.pid ?? -1;
        expect(isAlive(executor)).toBe(true);
        // `acp` dies alone, before anything reads its tree: its executor is an orphan in a group of its own.
        process.kill(acp, "SIGKILL");
        for (let i = 0; i < 200 && isAlive(executor); i++) yield* Effect.sleep("25 millis");
        expect(isAlive(executor)).toBe(false);
      }).pipe(
        Effect.ensuring(Effect.sync(() => executor > 0 && isAlive(executor) && process.kill(executor, "SIGKILL"))),
        Effect.provide(layer),
      );
    },
  );

  it.live.skipIf(process.platform !== "darwin")("leaves no marked OpenCode process after a normal close", () => {
    const real = realHomes();
    const { directory, layer, logged } = withHarnesses("100 millis", seatbeltIn(real));
    return Effect.gen(function* () {
      const started = yield* start({ harness: "opencode", text: "Hello" });
      yield* settle(started.missionId, idleWith(1));
      const executor = logged().find((entry) => entry.executor !== undefined)?.executor ?? -1;
      const marker = ownerMarkerOf(seatbeltIn(real)(directory));
      expect(markedProcessesOf(marker).map((found) => found.pid)).toContain(executor);
      for (let i = 0; i < 200 && isAlive(executor); i++) yield* Effect.sleep("25 millis");
      expect(isAlive(executor)).toBe(false);
      expect(markedProcessesOf(marker).filter((found) => isOpenCodeCommand(found.command))).toEqual([]);
    }).pipe(Effect.provide(layer));
  });

  it.live.skipIf(process.platform !== "darwin")(
    "ends, when the service starts, the OpenCode processes an earlier run lost",
    () => {
      const real = realHomes();
      const { directory, layer } = withHarnesses("10 minutes", seatbeltIn(real));
      const marker = ownerMarkerOf(seatbeltIn(real)(directory));
      const pidFile = join(directory, "lost");
      // A parent that leaves a marked executor behind, as a service that stopped would.
      spawn(
        process.execPath,
        [
          "-e",
          `const child = require("node:child_process").spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)", "serve", "--stdio"], { detached: true, stdio: "ignore" });
           require("node:fs").writeFileSync(${JSON.stringify(pidFile)}, String(child.pid));
           process.exit(0);`,
        ],
        { env: { ...process.env, [marker.name]: marker.value }, stdio: "ignore" },
      );
      let lost = -1;
      return Effect.gen(function* () {
        for (let i = 0; i < 200 && !existsSync(pidFile); i++) yield* Effect.sleep("25 millis");
        lost = Number(readFileSync(pidFile, "utf8"));
        yield* Effect.sleep("200 millis");
        expect(isAlive(lost)).toBe(true);
        // The OpenCode adapter is made with the service: it ends the lost process before any thread starts.
        yield* Effect.provide(call({ _tag: "ListHarnesses" }), layer);
        for (let i = 0; i < 200 && isAlive(lost); i++) yield* Effect.sleep("25 millis");
        expect(isAlive(lost)).toBe(false);
      }).pipe(Effect.ensuring(Effect.sync(() => lost > 0 && isAlive(lost) && process.kill(lost, "SIGKILL"))));
    },
  );

  it.live("ends OpenCode's whole process tree when it closes, a child in its own process group included", () => {
    const { layer, logged } = withHarnesses("100 millis");
    process.env.STAND_IN_OPENCODE_CHILD = "1";
    return Effect.gen(function* () {
      const started = yield* start({ harness: "opencode", text: "Hello" });
      yield* settle(started.missionId, idleWith(1));
      const grandchild = logged().find((entry) => entry.grandchild !== undefined)?.grandchild ?? -1;
      expect(grandchild).toBeGreaterThan(0);
      for (let i = 0; i < 200 && isAlive(grandchild); i++) yield* Effect.sleep("25 millis");
      expect(isAlive(grandchild)).toBe(false);
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
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* start({ harness: "opencode", text: "slow 5000" });
      yield* settle(started.missionId, (detail) => detail.thread.state === "Running");
      yield* untilRequested(requests, "session/prompt");
      yield* call({ _tag: "InterruptThread", threadId: started.threadId });
      const detail = yield* settle(started.missionId, (d) => d.thread.state === "Idle");
      expect(replies(detail)).toEqual([]);
      expect(detail.mission.usage).toEqual({ cacheCreation: 0, cacheRead: 40, input: 90, output: 8 });
    }).pipe(Effect.provide(layer));
  });

  it.live.skipIf(process.platform !== "darwin")(
    "starts a new session, and says so in the thread, when a sandboxed OpenCode cannot load the earlier one",
    () => {
      const { layer, logged, requests } = withHarnesses("50 millis", seatbeltIn(realHomes()));
      return Effect.gen(function* () {
        const started = yield* start({ harness: "opencode", text: "one" });
        yield* settle(started.missionId, idleWith(1));
        // The earlier session lives where the sandbox's copy does not have it.
        const earlier = `ses-${acpPidsOf(logged)[0]}`;
        process.env.STAND_IN_OPENCODE_MISSING_SESSIONS = earlier;
        yield* Effect.sleep("200 millis");
        yield* sendTo(started.threadId, "two");
        const detail = yield* settle(started.missionId, idleWith(2));
        expect(replies(detail)).toEqual(["Echo: one ", "Echo: two "]);
        expect(requests("session/load").map((request) => request.params?.sessionId)).toEqual([earlier]);
        expect(requests("session/new")).toHaveLength(2);
        expect(detail.thread.failure).toBeNull();
        expect(detail.handovers.map((line) => line.text)).toEqual([expect.stringContaining("could not pick up")]);
        expect(detail.handovers[0]?.text).toContain("handover notes");
        // The new session's first prompt carries the thread's conversation so far, then the turn's own message.
        const replacing = `ses-${acpPidsOf(logged)[1]}`;
        const promptsOf = (sessionId: string) =>
          requests("session/prompt")
            .filter((request) => request.params?.sessionId === sessionId)
            .map((request) => JSON.stringify(request.params?.prompt));
        const [first] = promptsOf(replacing);
        expect(first).toContain("Conversation so far");
        expect(first).toContain("The owner: one");
        expect(first).toContain("You: Echo: one");
        expect(first?.indexOf("Conversation so far")).toBeLessThan(first?.lastIndexOf("two") ?? -1);
        // The new session replaced the earlier one: the next start loads it, with no new note.
        yield* Effect.sleep("200 millis");
        yield* sendTo(started.threadId, "three");
        const after = yield* settle(started.missionId, idleWith(3));
        expect(requests("session/load").map((request) => request.params?.sessionId)).toEqual([earlier, replacing]);
        expect(requests("session/new")).toHaveLength(2);
        expect(after.handovers).toHaveLength(1);
        // The loaded session remembers: its later prompts carry no conversation again.
        expect(promptsOf(replacing).slice(1).join("")).not.toContain("Conversation so far");
      }).pipe(Effect.provide(layer));
    },
  );

  it.live("still fails the turn when an unsandboxed OpenCode cannot load its session", () => {
    const { layer, logged, requests } = withHarnesses("50 millis");
    return Effect.gen(function* () {
      const started = yield* start({ harness: "opencode", text: "one" });
      yield* settle(started.missionId, idleWith(1));
      process.env.STAND_IN_OPENCODE_MISSING_SESSIONS = `ses-${acpPidsOf(logged)[0]}`;
      yield* Effect.sleep("200 millis");
      yield* sendTo(started.threadId, "two");
      const detail = yield* settle(started.missionId, (d) => d.thread.state === "Failed");
      expect(detail.thread.failure).toContain("Session not found");
      expect(requests("session/new")).toHaveLength(1);
      expect(detail.handovers).toEqual([]);
    }).pipe(Effect.provide(layer));
  });

  it.live(
    "asks before an edit in a folder that is a link when no sandbox tool exists, without asking about the start",
    () => {
      const { layer } = withHarnesses("50 millis");
      const { elsewhere, workspace } = linkedFolders();
      return Effect.gen(function* () {
        const started = yield* start({ harness: "opencode", text: "one", workspacePath: workspace });
        yield* settle(started.missionId, idleWith(1));
        yield* Effect.sleep("200 millis");
        linkInPlace(workspace, elsewhere);
        yield* sendTo(started.threadId, "edit notes/plan.md");
        // The only question is the edit's: nothing is sandboxed, so there is no start to ask about.
        const edit = yield* answerOpen("Deny");
        expect(edit.permission).toBe("Change a file outside the workspace");
        yield* settle(started.missionId, idleWith(2));
      }).pipe(Effect.provide(layer));
    },
  );

  /** A workspace folder in its own temporary folder, and a folder outside it, both real paths. */
  const linkedFolders = () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), "iskios-linked-")));
    directories.push(base);
    const workspace = join(base, "workspace");
    const elsewhere = join(base, "elsewhere");
    mkdirSync(workspace);
    mkdirSync(elsewhere);
    return { elsewhere, workspace };
  };

  /** Replaces a folder with a link to the target. */
  const linkInPlace = (folder: string, target: string) => {
    rmSync(folder, { force: true, recursive: true });
    symlinkSync(target, folder);
  };

  it.live.skipIf(process.platform !== "darwin")(
    "asks before running a thread whose workspace folder became a link, then runs it unsandboxed, asking per action",
    () => {
      const { layer, logged } = withHarnesses("50 millis", seatbeltIn(realHomes()));
      const { elsewhere, workspace } = linkedFolders();
      return Effect.gen(function* () {
        const started = yield* start({ harness: "opencode", text: "one", workspacePath: workspace });
        yield* settle(started.missionId, idleWith(1));
        yield* Effect.sleep("200 millis");
        linkInPlace(workspace, elsewhere);
        yield* sendTo(started.threadId, "run ls");
        // A boundary anomaly: each start asks, and the question offers no standing permission (no Always allow).
        const open = yield* openQuestionOf();
        expect(open).toMatchObject({ pattern: null, permission: null });
        const refused = yield* Effect.flip(
          call({ _tag: "AnswerQuestion", answer: "AlwaysAllow", message: null, questionId: open.id }),
        );
        expect(refused.message).toContain("one-time");
        const asked = yield* answerOpen("Allow");
        expect(asked.outcome).toBe("Allowed");
        expect((yield* call({ _tag: "ReadPermissions", missionId: null })).permissions).toEqual([]);
        expect(asked.summary).toContain(workspace);
        expect(asked.summary).toContain(elsewhere);
        expect(asked.summary).toContain("write outside the workspace");
        // Allowed: OpenCode runs where the link points, with no sandbox, and every command asks.
        const command = yield* answerOpen("Allow");
        expect(command).toMatchObject({ details: "ls", permission: "Run without a sandbox" });
        expect(replies(yield* settle(started.missionId, idleWith(2))).at(-1)).toBe("ls: once ");
        const unwrapped = logged().filter((entry) => entry.pid !== undefined && entry.args?.includes("acp"))[1];
        expect(unwrapped?.xdg?.data).toBe(process.env.XDG_DATA_HOME ?? null);
      }).pipe(Effect.provide(layer));
    },
  );

  it.live.skipIf(process.platform !== "darwin")(
    "asks before an edit inside the linked folder once running unsandboxed",
    () => {
      const { layer } = withHarnesses("50 millis", seatbeltIn(realHomes()));
      const { elsewhere, workspace } = linkedFolders();
      return Effect.gen(function* () {
        const started = yield* start({ harness: "opencode", text: "one", workspacePath: workspace });
        yield* settle(started.missionId, idleWith(1));
        yield* Effect.sleep("200 millis");
        linkInPlace(workspace, elsewhere);
        yield* sendTo(started.threadId, "edit notes/plan.md");
        yield* answerOpen("Allow");
        const edit = yield* answerOpen("Deny");
        expect(edit.permission).toBe("Change a file outside the workspace");
        yield* settle(started.missionId, idleWith(2));
      }).pipe(Effect.provide(layer));
    },
  );

  for (const [label, target] of [
    ["the whole disk", () => "/"],
    ["a folder outside the scratch root", () => linkedFolders().elsewhere],
  ] as const)
    it.live.skipIf(process.platform !== "darwin")(
      `fails the turn with the reason when the owner refuses a scratch folder linked to ${label}`,
      () => {
        const { directory, layer, logged } = withHarnesses("50 millis", seatbeltIn(realHomes()));
        const pointed = target();
        return Effect.gen(function* () {
          const started = yield* start({ harness: "opencode", text: "one" });
          yield* settle(started.missionId, idleWith(1));
          yield* Effect.sleep("200 millis");
          const scratch = join(directory, "missions", started.missionId);
          linkInPlace(scratch, pointed);
          yield* sendTo(started.threadId, "two");
          const asked = yield* answerOpen("Deny");
          expect(asked.summary).toContain(scratch);
          expect(asked.summary).toContain(`points to ${pointed}`);
          const detail = yield* settle(started.missionId, (d) => d.thread.state === "Failed");
          expect(detail.thread.failure).toContain(scratch);
          expect(detail.thread.failure).toContain("outside the workspace");
          // No OpenCode started for the refused turn, sandboxed or not.
          expect(acpPidsOf(logged)).toHaveLength(1);
        }).pipe(Effect.provide(layer));
      },
    );

  it.live.skipIf(process.platform !== "darwin")("asks when the scratch root itself became a link", () => {
    const { directory, layer, logged } = withHarnesses("50 millis", seatbeltIn(realHomes()));
    const { elsewhere } = linkedFolders();
    return Effect.gen(function* () {
      const started = yield* start({ harness: "opencode", text: "one" });
      yield* settle(started.missionId, idleWith(1));
      yield* Effect.sleep("200 millis");
      const root = join(directory, "missions");
      renameSync(root, join(elsewhere, "missions"));
      symlinkSync(join(elsewhere, "missions"), root);
      yield* sendTo(started.threadId, "two");
      const asked = yield* answerOpen("Deny");
      expect(asked.summary).toContain(root);
      expect(asked.summary).toContain(join(elsewhere, "missions"));
      yield* settle(started.missionId, (d) => d.thread.state === "Failed");
      expect(acpPidsOf(logged)).toHaveLength(1);
    }).pipe(Effect.provide(layer));
  });

  it.live.skipIf(process.platform !== "darwin")(
    "runs a thread in a plain workspace folder sandboxed, asking nothing",
    () => {
      const { layer, logged } = withHarnesses("10 minutes", seatbeltIn(realHomes()));
      const { workspace } = linkedFolders();
      return Effect.gen(function* () {
        const started = yield* start({ harness: "opencode", text: "run ls", workspacePath: workspace });
        const detail = yield* settle(started.missionId, idleWith(1));
        expect(detail.questions.map((question) => question.outcome)).toEqual(["AllowedAutomatically"]);
        const wrapped = logged().find((entry) => entry.pid !== undefined && entry.args?.includes("acp"));
        expect(wrapped?.cwd).toBe(workspace);
        expect(wrapped?.xdg?.data).not.toBe(process.env.XDG_DATA_HOME ?? null);
      }).pipe(Effect.provide(layer));
    },
  );
});

/** The process starts of a Claude Code or Codex stand-in, in order. */
const startsOf = (logged: () => Array<Logged>) => logged().filter((entry) => entry.pid !== undefined);

/** The folder a harness was started in, as the adapter gave it: Claude Code's process, Codex's thread settings too. */
const startedFolderOf = (harness: "claude" | "codex", logged: () => Array<Logged>, index: number) => {
  const pwd = startsOf(logged)[index]?.pwd;
  if (harness === "claude") return pwd;
  const settings = logged().filter((entry) => entry.method === "thread/start" || entry.method === "thread/resume");
  const cwd = settings[index]?.params?.cwd;
  return pwd === cwd ? pwd : `process ${pwd}, thread ${String(cwd)}`;
};

describe.each(["claude", "codex"] as const)("checking a %s thread's folder before it starts", (harness) => {
  /** A workspace folder in its own temporary folder, and a folder outside it, both real paths. */
  const linkedFolders = () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), "iskios-linked-")));
    directories.push(base);
    const workspace = join(base, "workspace");
    const elsewhere = join(base, "elsewhere");
    mkdirSync(workspace);
    mkdirSync(elsewhere);
    return { elsewhere, workspace };
  };
  const linkInPlace = (folder: string, target: string) => {
    rmSync(folder, { force: true, recursive: true });
    symlinkSync(target, folder);
  };

  it.live("starts in a plain workspace folder, asking nothing", () => {
    const { layer, logged } = withHarnesses();
    const { workspace } = linkedFolders();
    return Effect.gen(function* () {
      const started = yield* start({ harness, text: "one", workspacePath: workspace });
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(detail.questions).toEqual([]);
      expect(detail.handovers).toEqual([]);
      expect(startedFolderOf(harness, logged, 0)).toBe(workspace);
    }).pipe(Effect.provide(layer));
  });

  it.live("asks once a kept thread's workspace folder became a link, then starts where it points and says so", () => {
    const { layer, logged } = withHarnesses();
    const { elsewhere, workspace } = linkedFolders();
    return Effect.gen(function* () {
      const started = yield* start({ harness, text: "one", workspacePath: workspace });
      yield* settle(started.missionId, idleWith(1));
      // The process is kept between turns: the changed link alone must restart it.
      linkInPlace(workspace, elsewhere);
      yield* sendTo(started.threadId, "two");
      const open = yield* openQuestionOf();
      expect(open).toMatchObject({ pattern: null, permission: null, source: "Harness" });
      expect(open.summary).toContain(workspace);
      expect(open.summary).toContain(elsewhere);
      const refused = yield* Effect.flip(
        call({ _tag: "AnswerQuestion", answer: "AlwaysAllow", message: null, questionId: open.id }),
      );
      expect(refused.message).toContain("one-time");
      yield* answerOpen("Allow");
      const detail = yield* settle(started.missionId, idleWith(2));
      expect(startsOf(logged)).toHaveLength(2);
      expect(startedFolderOf(harness, logged, 1)).toBe(elsewhere);
      expect(detail.handovers.map((line) => line.text)).toEqual([
        expect.stringMatching(new RegExp(`${workspace}.*is a link.*${elsewhere}`)),
      ]);
      expect((yield* call({ _tag: "ReadPermissions", missionId: null })).permissions).toEqual([]);
      // The process it started is kept for the next turn, asking nothing more.
      yield* sendTo(started.threadId, "three");
      const kept = yield* settle(started.missionId, idleWith(3));
      expect(kept.questions).toHaveLength(1);
      expect(startsOf(logged)).toHaveLength(2);
      // The link pointed elsewhere restarts the process, and the start asks again: the answer covered one start.
      const other = join(elsewhere, "..", "other");
      mkdirSync(other);
      linkInPlace(workspace, other);
      yield* sendTo(started.threadId, "four");
      expect((yield* answerOpen("Deny")).summary).toContain(other);
      yield* settle(started.missionId, (d) => d.thread.state === "Failed");
      expect(startsOf(logged)).toHaveLength(2);
    }).pipe(Effect.provide(layer));
  });

  for (const [label, target] of [
    ["the whole disk", () => "/"],
    ["a folder outside the scratch root", () => linkedFolders().elsewhere],
  ] as const)
    it.live(`fails the turn with the reason when the owner refuses a scratch folder linked to ${label}`, () => {
      const { directory, layer, logged } = withHarnesses();
      const pointed = target();
      return Effect.gen(function* () {
        const started = yield* start({ harness, text: "one" });
        yield* settle(started.missionId, idleWith(1));
        const scratch = join(directory, "missions", started.missionId);
        linkInPlace(scratch, pointed);
        yield* sendTo(started.threadId, "two");
        const asked = yield* answerOpen("Deny");
        expect(asked.summary).toContain(scratch);
        expect(asked.summary).toContain(`points to ${pointed}`);
        const detail = yield* settle(started.missionId, (d) => d.thread.state === "Failed");
        expect(detail.thread.failure).toContain(scratch);
        expect(detail.thread.failure).toContain(pointed);
        expect(startsOf(logged)).toHaveLength(1);
      }).pipe(Effect.provide(layer));
    });

  it.live("asks when the scratch root itself became a link, and starts in the resolved folder once allowed", () => {
    const { directory, layer, logged } = withHarnesses();
    const { elsewhere } = linkedFolders();
    return Effect.gen(function* () {
      const started = yield* start({ harness, text: "one" });
      yield* settle(started.missionId, idleWith(1));
      const root = join(directory, "missions");
      renameSync(root, join(elsewhere, "missions"));
      symlinkSync(join(elsewhere, "missions"), root);
      yield* sendTo(started.threadId, "two");
      const asked = yield* answerOpen("Allow");
      expect(asked.summary).toContain(root);
      expect(asked.summary).toContain(join(elsewhere, "missions"));
      yield* settle(started.missionId, idleWith(2));
      expect(startedFolderOf(harness, logged, 1)).toBe(join(elsewhere, "missions", started.missionId));
    }).pipe(Effect.provide(layer));
  });
});

/** The process ids of the `opencode acp` stand-ins started, in order. */
const acpPidsOf = (logged: () => Array<Logged>) =>
  logged()
    .filter((entry) => entry.pid !== undefined && entry.args?.includes("acp"))
    .map((entry) => entry.pid);

/** Sends the owner's message to a thread. */
const sendTo = (threadId: ThreadId, text: string) =>
  call({ _tag: "SendMessage", delivery: null, requestId: crypto.randomUUID(), text, threadId });

describe("managing provider accounts", () => {
  it.live("names the computer's own sign-in after the host, and follows a rename", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      yield* call({ _tag: "RenameHost", name: "Studio" });
      const { harnesses } = yield* call({ _tag: "ListHarnesses" });
      for (const harness of harnesses) expect(harness.accounts[0]).toMatchObject({ id: null, label: "Studio" });
      yield* call({ _tag: "RenameHost", name: "" });
      const reset = yield* call({ _tag: "ListHarnesses" });
      expect(reset.harnesses[0]?.accounts[0]?.label).toBe(computerNameOf());
    }).pipe(Effect.provide(layer));
  });

  it.live("renames each sign-in apart from the computer's name, and a blank name returns to it", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      yield* call({ _tag: "RenameHost", name: "Studio" });
      const renamed = yield* call({ _tag: "RenameOwnAccount", harness: "claude", label: " Personal " });
      const labelsOf = (list: typeof renamed) => list.harnesses.map((harness) => harness.accounts[0]?.label);
      expect(labelsOf(renamed)).toEqual(["Personal", "Studio", "Studio"]);
      // A later rename of the computer leaves the sign-in's own name alone.
      yield* call({ _tag: "RenameHost", name: "Laptop" });
      expect(labelsOf(yield* call({ _tag: "ListHarnesses" }))).toEqual(["Personal", "Laptop", "Laptop"]);
      // An added account renames the same way, and shows in the budgets that name it.
      const added = yield* call({ _tag: "AddAccount", harness: "codex", label: "Work" });
      const accountId = added.harnesses[1]?.accounts[1]?.id as AccountId;
      yield* call({ _tag: "RenameAccount", accountId, label: "Client" });
      const budgets = yield* call({ _tag: "ReadAccountBudgets" });
      expect(budgets.map((budget) => budget.label)).toContain("Personal");
      expect(budgets.map((budget) => budget.label)).toContain("Client");
      const reset = yield* call({ _tag: "RenameOwnAccount", harness: "claude", label: "  " });
      expect(labelsOf(reset)[0]).toBe("Laptop");
    }).pipe(Effect.provide(layer));
  });

  it.live("lists every harness with the computer's own sign-in first", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const { harnesses } = yield* call({ _tag: "ListHarnesses" });
      expect(harnesses.map((harness) => harness.name)).toEqual(["claude", "codex", "opencode"]);
      for (const harness of harnesses) {
        expect(harness.accounts[0]).toMatchObject({ id: null, label: computerNameOf(), signIn: "SignedIn" });
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

  it.live("lists the models of each signed-in account, so two subscriptions of one harness show apart", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const added = yield* call({ _tag: "AddAccount", harness: "claude", label: "Work" });
      const claude = added.harnesses.find((harness) => harness.name === "claude");
      expect(claude?.accounts.map((account) => account.label)).toHaveLength(2);
      for (const account of claude?.accounts ?? []) expect(account.models).toEqual(claude?.models);
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
      // The next quest starts on the default Companion and the computer's own sign-in, not on this account.
      expect(yield* call({ _tag: "ReadStartChoices" })).toMatchObject({ accountId: null, harness: "claude" });
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
