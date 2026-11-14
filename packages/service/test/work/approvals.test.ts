import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import type { MissionDetail, MissionId, Question, Request, RequestTag, ResultOf } from "@iskios/contracts";
import { Effect, Fiber, Layer, Option } from "effect";
import { afterEach } from "vitest";
import type { Containment } from "../../src/core/index.ts";
import { fakeHarnessLayer, Service, serviceLayer } from "../../src/index.ts";
import { matchesPattern, targetOf } from "../../src/policy/patterns.ts";
import { Approvals } from "../../src/work/approvals.ts";
import { createRepository, runGit } from "../fixtures/repositories.ts";

const directories: string[] = [];
const databaseFile = () => {
  const directory = mkdtempSync(join(tmpdir(), "iskios-approvals-"));
  directories.push(directory);
  return join(directory, "iskios.sqlite");
};
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

const serviceOn = (filename: string, containment: Containment = "Sandboxed") =>
  serviceLayer({
    filename,
    harness: fakeHarnessLayer("10 millis", containment),
    homeFolder: join(filename, ".."),
    scratchRoot: join(filename, "..", "missions"),
  });
const live = () => serviceOn(databaseFile());
/** A service whose harness runs with no enforced sandbox, as on a host where none can start. */
const unprotected = () => serviceOn(databaseFile(), "Unprotected");

const call = <R extends Request>(request: R) =>
  Effect.gen(function* () {
    const service = yield* Service;
    return (yield* service.handle(request)) as ResultOf<R["_tag"] & RequestTag>;
  });

const failureOf = <R extends Request>(request: R) =>
  Effect.gen(function* () {
    const service = yield* Service;
    return yield* Effect.flip(service.handle(request));
  });

const read = (missionId: MissionId) => call({ _tag: "ReadMission", missionId, threadId: null });

const settle = (missionId: MissionId, check: (detail: MissionDetail) => boolean) =>
  Effect.gen(function* () {
    for (let i = 0; i < 300; i++) {
      const detail = yield* read(missionId);
      if (check(detail)) return detail;
      yield* Effect.sleep("10 millis");
    }
    return yield* Effect.die(new Error(`mission did not settle: ${JSON.stringify(yield* read(missionId))}`));
  });

const isAsking = (detail: MissionDetail) => detail.questions.some((question) => question.outcome === null);
const isReplied = (detail: MissionDetail) =>
  detail.thread.state === "Idle" && detail.messages.at(-1)?.sender === "agent";
const lastReply = (detail: MissionDetail) => detail.messages.at(-1)?.text ?? "";
const openQuestion = (detail: MissionDetail) =>
  detail.questions.find((question) => question.outcome === null) as Question;

const push = {
  action: "Push today's commits to GitHub so the release can start",
  command: "git push origin main",
};
const ask = (request: object) => `ask ${JSON.stringify(request)}`;

let requestCount = 0;
const start = (text: string, workspacePath: string | null = null) =>
  call({
    _tag: "StartMission",
    effort: "default",
    model: "default",
    requestId: `start-${++requestCount}`,
    text,
    workspacePath,
  });
const send = (threadId: ResultOf<"StartMission">["threadId"], text: string) =>
  call({ _tag: "SendMessage", delivery: null, requestId: `send-${++requestCount}`, text, threadId });

const answer = (question: Question, given: "Allow" | "AlwaysAllow" | "Deny", message: string | null = null) =>
  call({ _tag: "AnswerQuestion", answer: given, message, questionId: question.id });

describe("asking before an action the thread judges consequential", () => {
  it.live("puts the thread in Attention with one open question, listed for the dashboard", () =>
    Effect.gen(function* () {
      const started = yield* start(ask(push));
      const detail = yield* settle(started.missionId, isAsking);

      expect(detail.thread.state).toBe("Attention");
      expect(detail.mission.state).toBe("Attention");
      expect(detail.questions).toHaveLength(1);
      expect(openQuestion(detail)).toMatchObject({
        details: "git push origin main",
        pattern: "git push origin main",
        permission: "Run this exact command",
        source: "Thread",
        summary: push.action,
      });
      const open = yield* call({ _tag: "ListOpenQuestions" });
      expect(open.map((question) => [question.missionTitle, question.threadId])).toEqual([
        [detail.mission.title, started.threadId],
      ]);
    }).pipe(Effect.provide(live())),
  );

  it.live("names no kind from the command's words, and the escape capability only when asked for", () =>
    Effect.gen(function* () {
      const labelled = yield* start(
        ask({ action: "Rotate the staging token", command: "./rotate-token.sh staging", permission: "Rotate tokens" }),
      );
      expect(openQuestion(yield* settle(labelled.missionId, isAsking)).permission).toBe("Run this exact command");

      const leaving = yield* start(ask({ ...push, outsideSandbox: true }));
      expect(openQuestion(yield* settle(leaving.missionId, isAsking))).toMatchObject({
        details: "git push origin main",
        permission: "Run outside the sandbox",
        summary: `${push.action}. Run this exact command outside the sandbox.`,
      });
    }).pipe(Effect.provide(live())),
  );

  it.live("asks one question per action, never bundled", () =>
    Effect.gen(function* () {
      const started = yield* start(`${ask(push)}\n${ask({ ...push, command: "git push origin release" })}`);
      const first = yield* settle(started.missionId, isAsking);
      expect(first.questions).toHaveLength(1);
      yield* answer(openQuestion(first), "Allow");
      const second = yield* settle(started.missionId, (detail) => detail.questions.length === 2 && isAsking(detail));
      expect(openQuestion(second).details).toBe("git push origin release");
    }).pipe(Effect.provide(live())),
  );

  it.live("tells the thread Allowed, records the answer, and returns the thread to work", () =>
    Effect.gen(function* () {
      const started = yield* start(ask(push));
      const asking = yield* settle(started.missionId, isAsking);
      const answered = yield* answer(openQuestion(asking), "Allow");
      expect(answered).toMatchObject({ device: "desktop", outcome: "Allowed" });

      const detail = yield* settle(started.missionId, isReplied);
      expect(lastReply(detail)).toContain("Allowed.");
      expect(yield* call({ _tag: "ListOpenQuestions" })).toEqual([]);
    }).pipe(Effect.provide(live())),
  );

  it.live("passes the owner's message on Deny with a message", () =>
    Effect.gen(function* () {
      const started = yield* start(ask(push));
      yield* answer(openQuestion(yield* settle(started.missionId, isAsking)), "Deny", "Open a pull request instead");
      const detail = yield* settle(started.missionId, isReplied);
      expect(lastReply(detail)).toContain("Denied by the owner: Open a pull request instead");
      expect(detail.questions[0]).toMatchObject({ message: "Open a pull request instead", outcome: "Denied" });
    }).pipe(Effect.provide(live())),
  );

  it.live("tells the thread the action was not approved on Deny without a message", () =>
    Effect.gen(function* () {
      const started = yield* start(ask(push));
      yield* answer(openQuestion(yield* settle(started.missionId, isAsking)), "Deny");
      const detail = yield* settle(started.missionId, isReplied);
      expect(lastReply(detail)).toContain("Not approved by the owner");
      expect(detail.questions.map((question) => question.outcome)).toEqual(["Denied"]);
    }).pipe(Effect.provide(live())),
  );

  it.live("refuses a second answer to the same question", () =>
    Effect.gen(function* () {
      const started = yield* start(ask(push));
      const question = openQuestion(yield* settle(started.missionId, isAsking));
      yield* answer(question, "Allow");
      const failure = yield* failureOf({
        _tag: "AnswerQuestion",
        answer: "Deny",
        message: null,
        questionId: question.id,
      });
      expect(failure.kind).toBe("InvalidInput");
    }).pipe(Effect.provide(live())),
  );
});

describe("no grant from prose", () => {
  it.live("asks even when the owner's message names the action and the thread quotes it", () =>
    Effect.gen(function* () {
      const started = yield* start(`Looks good, push it.\n${ask({ ...push, quote: "push it" })}`);
      const detail = yield* settle(started.missionId, (d) => isAsking(d) || isReplied(d));
      expect(detail.questions[0]).toMatchObject({ details: push.command, outcome: null });
      yield* answer(openQuestion(detail), "Allow");
      expect(lastReply(yield* settle(started.missionId, isReplied))).toContain("Allowed.");
    }).pipe(Effect.provide(live())),
  );

  it.live("never lets a quote spare the question for a sandbox escape either", () =>
    Effect.gen(function* () {
      const started = yield* start(
        `Run it outside the sandbox.\n${ask({ ...push, outsideSandbox: true, quote: "Run it outside the sandbox" })}`,
      );
      const detail = yield* settle(started.missionId, (d) => isAsking(d) || isReplied(d));
      expect(detail.questions[0]).toMatchObject({ outcome: null, permission: "Run outside the sandbox" });
    }).pipe(Effect.provide(live())),
  );
});

describe("harness prompts inside and outside the sandbox", () => {
  const prompt = (command: string, dangerouslyDisableSandbox = false) =>
    `prompt Bash ${JSON.stringify({ command, dangerouslyDisableSandbox })}`;

  it.live("runs a sandboxed command without any question, whatever it does, and leaves a line", () =>
    Effect.gen(function* () {
      const commands = ["git push origin main", "curl https://example.invalid/?data=1", "npm publish"];
      const started = yield* start(commands.map((command) => prompt(command)).join("\n"));
      const detail = yield* settle(started.missionId, isReplied);
      expect(lastReply(detail)).toBe("Echo: prompt allowed | prompt allowed | prompt allowed");
      expect(detail.questions.map((question) => [question.details, question.outcome])).toEqual(
        commands.map((command) => [command, "AllowedAutomatically"]),
      );
    }).pipe(Effect.provide(live())),
  );

  it.live("asks before a local-looking command leaves the sandbox, naming the exact command and capability", () =>
    Effect.gen(function* () {
      const input = { command: "node local.js", dangerouslyDisableSandbox: true, description: "Run the local script" };
      const started = yield* start(`prompt Bash ${JSON.stringify(input)}`);
      const detail = yield* settle(started.missionId, isAsking);
      expect(openQuestion(detail)).toMatchObject({
        details: "node local.js",
        pattern: "node local.js",
        permission: "Run outside the sandbox",
        source: "Harness",
        summary:
          "Run the local script. This runs outside the sandbox, with your full access to this computer's files and programs.",
      });
      yield* answer(openQuestion(detail), "Deny");
      expect(lastReply(yield* settle(started.missionId, isReplied))).toContain("prompt denied");
    }).pipe(Effect.provide(live())),
  );

  it.live("asks about every escape a harness flags, such as Codex's escalations", () =>
    Effect.gen(function* () {
      const started = yield* start(`escape Bash ${JSON.stringify({ command: "ls" })}`);
      expect(openQuestion(yield* settle(started.missionId, isAsking))).toMatchObject({
        details: "ls",
        permission: "Run outside the sandbox",
      });
    }).pipe(Effect.provide(live())),
  );

  it.live("asks for every prompt, with its exact command, when no sandbox protects the harness", () =>
    Effect.gen(function* () {
      const started = yield* start(prompt("ls"));
      expect(openQuestion(yield* settle(started.missionId, isAsking))).toMatchObject({
        details: "ls",
        pattern: "ls",
        permission: "Run without a sandbox",
        summary: "Run a command. No sandbox protects this computer here, so this runs with your full access.",
      });
    }).pipe(Effect.provide(unprotected())),
  );

  it.live("does not turn an action approval into an unasked sandbox escape", () =>
    Effect.gen(function* () {
      const started = yield* start(`${ask(push)}\n${prompt(push.command, true)}`);
      yield* answer(openQuestion(yield* settle(started.missionId, isAsking)), "Allow");
      const detail = yield* settle(started.missionId, (d) => d.questions.length === 2 || isReplied(d));
      expect(detail.questions[1]).toMatchObject({ outcome: null, permission: "Run outside the sandbox" });
    }).pipe(Effect.provide(live())),
  );

  it.live("runs the escape the owner just allowed once, and asks for a repeat or in a later turn", () =>
    Effect.gen(function* () {
      const askToLeave = ask({ ...push, outsideSandbox: true });
      const started = yield* start(`${askToLeave}\n${prompt(push.command, true)}\n${prompt(push.command, true)}`);
      yield* answer(openQuestion(yield* settle(started.missionId, isAsking)), "Allow");
      const repeat = yield* settle(started.missionId, (detail) => detail.questions.length === 2 && isAsking(detail));
      expect(openQuestion(repeat)).toMatchObject({ details: push.command, source: "Harness" });
      yield* answer(openQuestion(repeat), "Deny");
      const detail = yield* settle(started.missionId, isReplied);
      expect(lastReply(detail)).toContain("prompt allowed | prompt denied: ");

      yield* send(started.threadId, prompt(push.command, true));
      const later = yield* settle(started.missionId, (d) => d.questions.length === 3 && isAsking(d));
      expect(openQuestion(later)).toMatchObject({ details: push.command, source: "Harness" });
    }).pipe(Effect.provide(live())),
  );

  it.live("runs the escape just allowed once when Codex asks for it wrapped in a shell script", () =>
    Effect.gen(function* () {
      const codexPrompt = `escape Bash ${JSON.stringify({ command: "/bin/zsh -lc 'git push origin main'" })}`;
      const started = yield* start(`${ask({ ...push, outsideSandbox: true })}\n${codexPrompt}`);
      yield* answer(openQuestion(yield* settle(started.missionId, isAsking)), "Allow");
      const detail = yield* settle(started.missionId, isReplied);
      expect(lastReply(detail)).toContain("prompt allowed");
      expect(detail.questions).toHaveLength(1);
    }).pipe(Effect.provide(live())),
  );

  it.live("answers Claude Code's permission prompt tool in its own format, allowing or denying", () =>
    Effect.gen(function* () {
      const promptTool = (input: object) => `call answer_prompt ${JSON.stringify({ input, tool_name: "Bash" })}`;
      const started = yield* start(
        `${promptTool({ command: "ls" })}\n${promptTool({ command: "ls", dangerouslyDisableSandbox: true })}`,
      );
      yield* answer(openQuestion(yield* settle(started.missionId, isAsking)), "Deny");
      const detail = yield* settle(started.missionId, isReplied);
      expect(lastReply(detail)).toContain('{"behavior":"allow","updatedInput":{"command":"ls"}}');
      expect(lastReply(detail)).toContain('{"behavior":"deny","message":"Not approved by the owner.');
    }).pipe(Effect.provide(live())),
  );

  it.live("changes a file inside the thread's folder unasked and asks about one outside it", () =>
    Effect.gen(function* () {
      const inside = yield* start(`prompt Edit ${JSON.stringify({ file_path: "notes/plan.md" })}`);
      expect((yield* settle(inside.missionId, isReplied)).questions.map((q) => q.outcome)).toEqual([
        "AllowedAutomatically",
      ]);
      for (const file_path of ["../elsewhere/plan.md", "plan.md, /etc/hosts"]) {
        const outside = yield* start(`prompt Edit ${JSON.stringify({ file_path })}`);
        expect(openQuestion(yield* settle(outside.missionId, isAsking))).toMatchObject({
          permission: "Change a file outside the workspace",
        });
      }
    }).pipe(Effect.provide(live())),
  );

  it.live("asks for every prompt at the stricter level, inside the sandbox too", () =>
    Effect.gen(function* () {
      const settings = yield* call({ _tag: "ReadSettings" });
      yield* call({ _tag: "UpdateSettings", settings: { ...settings, approvalLevel: "CommandsAndEdits" } });
      const commit = yield* start(prompt(`git add hello.txt && git commit -m "Add hello"`));
      expect(openQuestion(yield* settle(commit.missionId, isAsking))).toMatchObject({
        permission: "Run a command",
        source: "Harness",
      });
      const inside = yield* start(`prompt Edit ${JSON.stringify({ file_path: "notes/plan.md" })}`);
      expect(openQuestion(yield* settle(inside.missionId, isAsking))).toMatchObject({
        permission: "Change a file",
        summary: "Change a file.",
      });
    }).pipe(Effect.provide(live())),
  );
});

describe("standing permissions", () => {
  it.live("saves only the exact target even when the agent proposes a wildcard", () =>
    Effect.gen(function* () {
      const first = yield* start(ask({ ...push, pattern: "git push *" }));
      yield* answer(openQuestion(yield* settle(first.missionId, isAsking)), "AlwaysAllow");
      yield* settle(first.missionId, isReplied);
      const view = yield* call({ _tag: "ReadPermissions", missionId: null });
      expect(view.permissions[0]).toMatchObject({
        pattern: "git push origin main",
        sentence: "Run this exact command",
      });
      yield* send(first.threadId, ask({ ...push, command: "git push evil other" }));
      const next = yield* settle(first.missionId, (d) => isAsking(d) || (d.questions.length === 2 && isReplied(d)));
      expect(next.questions[1]?.outcome).toBeNull();
    }).pipe(Effect.provide(live())),
  );

  it.live(
    "Always allow spares later matching actions in the mission, asks elsewhere, and asks again once removed",
    () =>
      Effect.gen(function* () {
        const first = yield* start(ask(push));
        yield* answer(openQuestion(yield* settle(first.missionId, isAsking)), "AlwaysAllow");
        yield* settle(first.missionId, isReplied);

        const view = yield* call({ _tag: "ReadPermissions", missionId: null });
        expect(view.permissions).toHaveLength(1);
        expect(view.permissions[0]).toMatchObject({ missionId: first.missionId, pattern: "git push origin main" });

        yield* send(first.threadId, ask(push));
        const spared = yield* settle(first.missionId, (detail) => detail.questions.length === 2 && isReplied(detail));
        expect(spared.questions[1]).toMatchObject({
          message: "Run this exact command",
          outcome: "AllowedByPermission",
        });

        const other = yield* start(ask(push));
        const asking = yield* settle(other.missionId, isAsking);
        yield* answer(openQuestion(asking), "Deny");
        yield* settle(other.missionId, isReplied);

        const permissionId = view.permissions[0]?.id ?? ("" as never);
        yield* call({ _tag: "WidenPermission", permissionId });
        yield* send(other.threadId, ask(push));
        const widened = yield* settle(other.missionId, (detail) => detail.questions.length === 2 && isReplied(detail));
        expect(widened.questions[1]?.outcome).toBe("AllowedByPermission");

        yield* call({ _tag: "RemovePermission", permissionId });
        yield* send(first.threadId, ask(push));
        const again = yield* settle(first.missionId, isAsking);
        expect(openQuestion(again).outcome).toBeNull();
      }).pipe(Effect.provide(live())),
  );

  it.live("never lets a permission for an ordinary action cover an escape with the same command", () =>
    Effect.gen(function* () {
      const build = { action: "Build the app", command: "node build.js" };
      const started = yield* start(ask(build));
      yield* answer(openQuestion(yield* settle(started.missionId, isAsking)), "AlwaysAllow");
      yield* settle(started.missionId, isReplied);

      yield* send(started.threadId, `prompt Bash ${JSON.stringify({ ...build, dangerouslyDisableSandbox: true })}`);
      const asking = yield* settle(started.missionId, isAsking);
      expect(openQuestion(asking)).toMatchObject({ details: "node build.js", permission: "Run outside the sandbox" });
    }).pipe(Effect.provide(live())),
  );

  it.live("lets the owner allow one exact escape always, which spares only that escape", () =>
    Effect.gen(function* () {
      const leave = (command: string) => `prompt Bash ${JSON.stringify({ command, dangerouslyDisableSandbox: true })}`;
      const started = yield* start(leave("./setup-hooks.sh"));
      yield* answer(openQuestion(yield* settle(started.missionId, isAsking)), "AlwaysAllow");
      yield* settle(started.missionId, isReplied);
      yield* send(started.threadId, `${leave("./setup-hooks.sh")}\n${leave("./setup-hooks.sh --force")}`);
      const next = yield* settle(started.missionId, (d) => d.questions.length === 3 && isAsking(d));
      expect(next.questions[1]?.outcome).toBe("AllowedByPermission");
      expect(openQuestion(next).details).toBe("./setup-hooks.sh --force");
    }).pipe(Effect.provide(live())),
  );

  it.live("keeps every answer in the Permissions history, filterable by mission", () =>
    Effect.gen(function* () {
      const first = yield* start(ask(push));
      yield* answer(openQuestion(yield* settle(first.missionId, isAsking)), "Allow");
      const second = yield* start(ask(push));
      yield* answer(openQuestion(yield* settle(second.missionId, isAsking)), "Deny");
      yield* settle(second.missionId, isReplied);

      const all = yield* call({ _tag: "ReadPermissions", missionId: null });
      expect(all.history.map((question) => question.outcome).sort()).toEqual(["Allowed", "Denied"]);
      const one = yield* call({ _tag: "ReadPermissions", missionId: second.missionId });
      expect(one.history.map((question) => question.outcome)).toEqual(["Denied"]);
      expect(all.level).toBe("RiskyOnly");
    }).pipe(Effect.provide(live())),
  );
});

describe("a thread folder that is a link", () => {
  /** The fake harness's folder question, as Claude Code and Codex ask it before starting in a linked folder. */
  const folder = (file_path: string, startsIn: string | null = null) =>
    `folder Claude ${JSON.stringify({ description: `The folder ${file_path} points elsewhere`, file_path, startsIn })}`;

  it.live("asks a one-time question that offers no standing permission and refuses Always allow", () =>
    Effect.gen(function* () {
      const started = yield* start(folder("/somewhere/linked"));
      const asked = openQuestion(yield* settle(started.missionId, isAsking));
      expect(asked).toMatchObject({ pattern: null, permission: null, source: "Harness" });
      expect(asked.summary).toContain("/somewhere/linked");
      const refused = yield* failureOf({
        _tag: "AnswerQuestion",
        answer: "AlwaysAllow",
        message: null,
        questionId: asked.id,
      });
      expect(refused.message).toContain("one-time");
      expect((yield* call({ _tag: "ReadPermissions", missionId: null })).permissions).toEqual([]);
      yield* answer(asked, "Allow");
      expect(lastReply(yield* settle(started.missionId, isReplied))).toBe("Echo: prompt allowed");
      expect((yield* call({ _tag: "ReadPermissions", missionId: null })).permissions).toEqual([]);
    }).pipe(Effect.provide(live())),
  );

  it.live("never lets an earlier standing permission answer it", () =>
    Effect.gen(function* () {
      // A row as the earlier OpenCode folder question saved it: "Run without a sandbox" for the folder.
      const linked = "/somewhere/linked";
      const first = yield* start(`prompt OpenCode ${JSON.stringify({ file_path: linked })}`);
      yield* answer(openQuestion(yield* settle(first.missionId, isAsking)), "AlwaysAllow");
      yield* settle(first.missionId, isReplied);
      expect((yield* call({ _tag: "ReadPermissions", missionId: null })).permissions).toHaveLength(1);
      yield* send(first.threadId, folder(linked));
      const asking = yield* settle(first.missionId, (d) => d.questions.length === 2 && isAsking(d));
      expect(openQuestion(asking)).toMatchObject({ outcome: null, pattern: null, permission: null });
    }).pipe(Effect.provide(unprotected())),
  );

  /** A service whose browsable root holds a workspace folder and a folder outside it, both real paths. */
  const withWorkspace = () => {
    const filename = databaseFile();
    const base = realpathSync(join(filename, ".."));
    const workspace = join(base, "workspace");
    const elsewhere = join(base, "elsewhere");
    mkdirSync(workspace);
    mkdirSync(elsewhere);
    return { elsewhere, layer: serviceOn(filename), workspace };
  };
  const edit = (file_path: string) => `prompt Edit ${JSON.stringify({ file_path })}`;

  it.live("counts a file in the link's target as outside the thread's folder", () => {
    const { elsewhere, layer, workspace } = withWorkspace();
    return Effect.gen(function* () {
      const started = yield* start("hello", workspace);
      yield* settle(started.missionId, isReplied);
      rmSync(workspace, { recursive: true });
      symlinkSync(elsewhere, workspace);
      for (const file of [join(elsewhere, "plan.md"), join(workspace, "plan.md")]) {
        yield* send(started.threadId, edit(file));
        const asking = yield* settle(started.missionId, isAsking);
        expect(openQuestion(asking)).toMatchObject({ permission: "Change a file outside the workspace" });
        yield* answer(openQuestion(asking), "Deny");
        yield* settle(started.missionId, isReplied);
      }
    }).pipe(Effect.provide(layer));
  });

  it.live("counts a file in the link's target as inside once the owner allowed the start there", () => {
    const { elsewhere, layer, workspace } = withWorkspace();
    return Effect.gen(function* () {
      const started = yield* start("hello", workspace);
      yield* settle(started.missionId, isReplied);
      rmSync(workspace, { recursive: true });
      symlinkSync(elsewhere, workspace);
      yield* send(started.threadId, `${folder(workspace, elsewhere)}\n${edit(join(elsewhere, "plan.md"))}`);
      yield* answer(openQuestion(yield* settle(started.missionId, isAsking)), "Allow");
      const detail = yield* settle(started.missionId, isReplied);
      expect(lastReply(detail)).toBe("Echo: prompt allowed | prompt allowed");
      expect(detail.questions.at(-1)?.outcome).toBe("AllowedAutomatically");
      // Pointed elsewhere again, the earlier answer no longer counts.
      const other = join(elsewhere, "..", "other");
      mkdirSync(other);
      rmSync(workspace);
      symlinkSync(other, workspace);
      yield* send(started.threadId, edit(join(other, "plan.md")));
      expect(openQuestion(yield* settle(started.missionId, isAsking))).toMatchObject({
        permission: "Change a file outside the workspace",
      });
    }).pipe(Effect.provide(layer));
  });
});

describe("using a workspace's git worktrees", () => {
  /** A workspace that is a repository with one linked worktree beside it, an unrelated folder beside both, and a worktree of another repository. */
  const makeRepositoryFixture = () => {
    const filename = databaseFile();
    const base = realpathSync(join(filename, ".."));
    const workspace = createRepository(base, "workspace");
    const worktree = join(base, "workspace-side");
    runGit(workspace, "worktree", "add", "-q", "-b", "side", worktree);
    const unrelated = join(base, "workspace-unrelated");
    mkdirSync(unrelated);
    const other = createRepository(base, "other");
    const otherWorktree = join(base, "other-side");
    runGit(other, "worktree", "add", "-q", "-b", "other-side", otherWorktree);
    return { layer: serviceOn(filename), otherWorktree, unrelated, workspace, worktree };
  };
  const edit = (file_path: string) => `prompt Edit ${JSON.stringify({ file_path })}`;

  it.live("changes a file in a worktree of the workspace unasked", () => {
    const { layer, workspace, worktree } = makeRepositoryFixture();
    return Effect.gen(function* () {
      const started = yield* start(edit(join(worktree, "plan.md")), workspace);
      const detail = yield* settle(started.missionId, isReplied);
      expect(detail.questions.map((question) => question.outcome)).toEqual(["AllowedAutomatically"]);
    }).pipe(Effect.provide(layer));
  });

  it.live("asks about a file in an unrelated sibling folder or in a worktree of another repository", () => {
    const { layer, otherWorktree, unrelated, workspace } = makeRepositoryFixture();
    return Effect.gen(function* () {
      for (const folder of [unrelated, otherWorktree]) {
        const started = yield* start(edit(join(folder, "plan.md")), workspace);
        expect(openQuestion(yield* settle(started.missionId, isAsking))).toMatchObject({
          permission: "Change a file outside the workspace",
        });
      }
    }).pipe(Effect.provide(layer));
  });

  it.live("asks again about a worktree once its folder is replaced by a link", () => {
    const { layer, unrelated, workspace, worktree } = makeRepositoryFixture();
    return Effect.gen(function* () {
      const started = yield* start("hello", workspace);
      yield* settle(started.missionId, isReplied);
      rmSync(worktree, { recursive: true });
      symlinkSync(unrelated, worktree);
      yield* send(started.threadId, edit(join(worktree, "plan.md")));
      expect(openQuestion(yield* settle(started.missionId, isAsking))).toMatchObject({
        permission: "Change a file outside the workspace",
      });
    }).pipe(Effect.provide(layer));
  });
});

describe("withdrawing questions", () => {
  const escapeInput = { command: "git push origin feature", dangerouslyDisableSandbox: true };

  it.live("Stop withdraws the open question and marks the thread Stopped", () =>
    Effect.gen(function* () {
      const started = yield* start(ask(push));
      yield* settle(started.missionId, isAsking);
      yield* call({ _tag: "StopThread", threadId: started.threadId });
      const detail = yield* read(started.missionId);
      expect(detail.thread.state).toBe("Stopped");
      expect(detail.questions[0]?.outcome).toBe("Withdrawn");
      expect(yield* call({ _tag: "ListOpenQuestions" })).toEqual([]);
    }).pipe(Effect.provide(live())),
  );

  it.live("allows nothing for a prompt that arrives after Stop, while the harness is still exiting", () =>
    Effect.gen(function* () {
      const started = yield* start(ask(push));
      yield* settle(started.missionId, isAsking);
      yield* call({ _tag: "StopThread", threadId: started.threadId });
      const approvals = yield* Approvals;
      for (const input of [escapeInput, { command: "ls" }]) {
        const late = yield* approvals
          .answerPrompt(started.threadId, "Bash", input)
          .pipe(Effect.timeoutOption("1 second"));
        expect(Option.getOrThrow(late).isAllowed).toBe(false);
      }
      expect(yield* call({ _tag: "ListOpenQuestions" })).toEqual([]);
      expect((yield* read(started.missionId)).thread.state).toBe("Stopped");
    }).pipe(Effect.provide(live())),
  );

  it.live("withdraws a question whose caller gave up waiting", () =>
    Effect.gen(function* () {
      const started = yield* start(ask(push));
      yield* settle(started.missionId, isAsking);
      const approvals = yield* Approvals;
      const call = yield* approvals.answerPrompt(started.threadId, "Bash", escapeInput).pipe(Effect.forkChild);
      yield* settle(started.missionId, (detail) => detail.questions.length === 2);
      yield* Fiber.interrupt(call);
      const detail = yield* read(started.missionId);
      expect(detail.questions.map((question) => question.outcome)).toEqual([null, "Withdrawn"]);
      expect(detail.thread.state).toBe("Attention");
    }).pipe(Effect.provide(live())),
  );

  it.live("withdraws questions left open by a restart and leaves their thread Idle", () =>
    Effect.gen(function* () {
      const filename = databaseFile();
      const started = yield* Effect.scoped(
        Effect.gen(function* () {
          const context = yield* Layer.build(serviceOn(filename));
          return yield* Effect.gen(function* () {
            const started = yield* start(ask(push));
            yield* settle(started.missionId, isAsking);
            return started;
          }).pipe(Effect.provideContext(context));
        }),
      );
      const detail = yield* read(started.missionId).pipe(Effect.provide(serviceOn(filename)));
      expect(detail.thread.state).toBe("Idle");
      expect(detail.questions[0]?.outcome).toBe("Withdrawn");
    }),
  );
});

describe("command patterns", () => {
  it("covers only the exact command it was saved for", () => {
    expect(matchesPattern("git push origin main", "git push origin main")).toBe(true);
    expect(matchesPattern("git push origin main", "git push origin dev")).toBe(false);
    expect(matchesPattern("git push origin main", "git push origin main && rm -rf ~")).toBe(false);
  });

  it("reads a literal star as an ordinary character", () => {
    expect(matchesPattern("rm -rf ./build/*", "rm -rf ./build/*")).toBe(true);
    expect(matchesPattern("rm -rf ./build/*", "rm -rf ./build/../../dummy-outside/x")).toBe(false);
  });

  it("refuses an empty or one-character pattern", () => {
    expect(matchesPattern("*", "git push origin main")).toBe(false);
    expect(matchesPattern("", "")).toBe(false);
  });

  it("names a harness target by its command, file, or address", () => {
    expect(targetOf("Bash", { command: "ls" })).toBe("ls");
    expect(targetOf("Write", { content: "x", file_path: "/etc/hosts" })).toBe("Write /etc/hosts");
    expect(targetOf("WebFetch", { url: "https://example.com" })).toBe("WebFetch https://example.com");
  });

  it("names a command Codex wraps in a shell script by the script, and keeps anything around it", () => {
    expect(targetOf("Bash", { command: "/bin/zsh -lc 'git push origin main'" })).toBe("git push origin main");
    expect(targetOf("Bash", { command: 'bash -c "npm publish"' })).toBe("npm publish");
    expect(targetOf("Bash", { command: "zsh -lc 'a' ; rm -rf ~ ; echo 'b'" })).toBe(
      "zsh -lc 'a' ; rm -rf ~ ; echo 'b'",
    );
  });
});
