import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import type { HarnessName, MissionDetail, MissionId, Request, RequestTag, ResultOf } from "@gild/contracts";
import { Effect, Layer } from "effect";
import { afterEach } from "vitest";
import {
  Harness,
  liveHarnessToolsLayer,
  makeClaudeHarness,
  makeCodexHarness,
  makeOpenCodeHarness,
  routeHarnesses,
  Service,
  serviceLayer,
} from "../../src/index.ts";

// Opt-in checks against the installed Codex and OpenCode (provider-accounts). Each uses a few tokens of the
// owner's own sign-in: GILD_LIVE_HARNESSES=1, and GILD_LIVE_OPENCODE_MODEL for OpenCode's model.

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

const commands = {
  claude: process.env.GILD_CLAUDE_PATH ?? "claude",
  codex: process.env.GILD_CODEX_PATH ?? "codex",
  opencode: process.env.GILD_OPENCODE_PATH ?? "opencode",
};

const live = (directory = realpathSync(mkdtempSync(join(tmpdir(), "gild-live-")))) => {
  directories.push(directory);
  const harness = Layer.effect(
    Harness,
    Effect.gen(function* () {
      return routeHarnesses({
        claude: yield* makeClaudeHarness({ command: commands.claude, idleTimeout: "1 minute", sandboxProblem: null }),
        codex: yield* makeCodexHarness({ command: commands.codex, idleTimeout: "1 minute" }),
        opencode: yield* makeOpenCodeHarness({ command: commands.opencode, idleTimeout: "1 minute" }),
      });
    }),
  );
  return serviceLayer({
    filename: join(directory, "gild.sqlite"),
    harness,
    harnessTools: liveHarnessToolsLayer(commands),
    homeFolder: directory,
    scratchRoot: join(directory, "missions"),
  });
};

const call = <R extends Request>(request: R) =>
  Effect.gen(function* () {
    const service = yield* Service;
    return (yield* service.handle(request)) as ResultOf<R["_tag"] & RequestTag>;
  });

const settle = (missionId: MissionId, check: (detail: MissionDetail) => boolean) =>
  Effect.gen(function* () {
    for (let i = 0; i < 1800; i++) {
      const detail = yield* call({ _tag: "ReadMission", missionId, threadId: null });
      if (check(detail)) return detail;
      yield* Effect.sleep("100 millis");
    }
    return yield* Effect.die(new Error("did not settle"));
  });

/** One turn that must call a thread tool, set_mission_title, which proves the thread reached its tools. */
const titledTurn = (harness: HarnessName, model: string) =>
  Effect.gen(function* () {
    const started = yield* call({
      _tag: "StartMission",
      effort: harness === "codex" ? "low" : "default",
      harness,
      model,
      requestId: crypto.randomUUID(),
      text: 'Call set_mission_title with the title "Live check", then reply with exactly: ok',
      workspacePath: null,
    });
    const detail = yield* settle(
      started.missionId,
      (d) => d.thread.state === "Idle" || d.thread.state === "Failed" || d.thread.state === "Attention",
    );
    expect(detail.thread.failure).toBeNull();
    expect(detail.mission.title).toBe("Live check");
    expect(detail.messages.at(-1)?.text.toLowerCase()).toContain("ok");
    return detail;
  });

describe.runIf(process.env.GILD_LIVE_HARNESSES === "1")("live harnesses (use a few tokens)", () => {
  it.live(
    "lists the installed harnesses, their sign-ins, and their models",
    () =>
      Effect.gen(function* () {
        const { harnesses } = yield* call({ _tag: "ListHarnesses" });
        for (const harness of harnesses) {
          expect(harness.problem).toBeNull();
          expect(harness.accounts[0]?.signIn).toBe("SignedIn");
        }
        expect(harnesses[1]?.models.length).toBeGreaterThan(1);
      }).pipe(Effect.provide(live())),
    120_000,
  );

  it.live(
    "runs a Codex turn that uses its thread tools",
    () =>
      Effect.gen(function* () {
        const detail = yield* titledTurn("codex", "default");
        expect(detail.mission.usage.output).toBeGreaterThan(0);
      }).pipe(Effect.provide(live())),
    300_000,
  );

  it.live(
    "lets OpenCode write inside its workspace unasked, asks before it writes outside, and carries on after a refusal",
    () => {
      const directory = realpathSync(mkdtempSync(join(tmpdir(), "gild-live-")));
      const workspace = join(directory, "project");
      mkdirSync(workspace);
      const outside = join(directory, "outside.txt");
      const isPaused = (d: MissionDetail) => d.thread.state !== "Running";
      return Effect.gen(function* () {
        const started = yield* call({
          _tag: "StartMission",
          effort: "default",
          harness: "opencode",
          model: process.env.GILD_LIVE_OPENCODE_MODEL ?? "default",
          requestId: crypto.randomUUID(),
          text: `Use your write tool to create notes.txt in the current folder containing "hi". Then use your write tool to create ${outside} containing "hi". Use no shell command. Then reply with exactly: done`,
          workspacePath: workspace,
        });
        const asking = yield* settle(
          started.missionId,
          (d) => isPaused(d) || d.questions.some((q) => q.outcome === null),
        );
        expect(existsSync(join(workspace, "notes.txt"))).toBe(true);
        const question = asking.questions.find((q) => q.outcome === null);
        expect(question?.details).toBe(`Edit ${outside}`);
        yield* call({
          _tag: "AnswerQuestion",
          answer: "Deny",
          message: "Skip that file and reply with exactly: skipped",
          questionId: question?.id ?? ("" as never),
        });
        const detail = yield* settle(
          started.missionId,
          (d) => d.thread.state === "Idle" || d.thread.state === "Failed",
        );
        expect(detail.questions.map((q) => q.outcome)).toEqual(["Denied"]);
        expect(existsSync(outside)).toBe(false);
        // OpenCode cancels its prompt on a refusal; the thread hears the owner's message and replies in the same turn.
        expect(detail.thread.failure).toBeNull();
        expect(detail.messages.at(-1)?.text.toLowerCase()).toContain("skipped");
      }).pipe(Effect.provide(live(directory)));
    },
    300_000,
  );

  it.live(
    "recognizes a git push from a Codex thread as Push code and runs it once allowed",
    () => {
      const directory = realpathSync(mkdtempSync(join(tmpdir(), "gild-live-")));
      const workspace = join(directory, "project");
      const remote = join(directory, "remote.git");
      const git = (cwd: string, ...args: Array<string>) => execFileSync("git", args, { cwd, encoding: "utf8" });
      mkdirSync(workspace);
      git(directory, "init", "--bare", "--initial-branch=main", remote);
      git(workspace, "init", "--initial-branch=main");
      git(
        workspace,
        "-c",
        "user.name=Gild",
        "-c",
        "user.email=gild@example.invalid",
        "commit",
        "--allow-empty",
        "-m",
        "Start",
      );
      git(workspace, "remote", "add", "origin", remote);
      return Effect.gen(function* () {
        const started = yield* call({
          _tag: "StartMission",
          effort: "low",
          harness: "codex",
          model: "default",
          requestId: crypto.randomUUID(),
          text: "Run exactly this shell command: git push origin main. If the sandbox blocks it, request approval to run it outside the sandbox. Then reply with exactly: done",
          workspacePath: workspace,
        });
        // Every question is allowed as it opens, so the turn runs to its end.
        const isDone = (d: MissionDetail) => d.thread.state === "Idle" || d.thread.state === "Failed";
        let detail = yield* settle(started.missionId, (d) => isDone(d) || d.questions.some((q) => q.outcome === null));
        while (!isDone(detail)) {
          const open = detail.questions.find((q) => q.outcome === null);
          if (open !== undefined)
            yield* call({ _tag: "AnswerQuestion", answer: "Allow", message: null, questionId: open.id });
          yield* Effect.sleep("500 millis");
          detail = yield* settle(started.missionId, (d) => isDone(d) || d.questions.some((q) => q.outcome === null));
        }
        // Recorded in the verification proof: what the thread and Codex asked, in order.
        const asked = detail.questions.map(({ details, outcome, permission, source }) => ({
          details,
          outcome,
          permission,
          source,
        }));
        console.log("CODEX_ESCALATION", JSON.stringify(asked));
        // One push is decided once: the escalation Codex wraps in `/bin/zsh -lc '…'` uses the allowance just given.
        expect(asked.filter((q) => q.permission === "Push code")).toHaveLength(1);
        expect(git(remote, "rev-parse", "main").trim()).toBe(git(workspace, "rev-parse", "main").trim());
      }).pipe(Effect.provide(live(directory)));
    },
    300_000,
  );

  it.live(
    "runs an OpenCode turn that uses its thread tools",
    () => titledTurn("opencode", process.env.GILD_LIVE_OPENCODE_MODEL ?? "default").pipe(Effect.provide(live())),
    300_000,
  );
});
