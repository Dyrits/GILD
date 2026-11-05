import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import type { MissionDetail, MissionId, Question, Request, RequestTag, ResultOf } from "@openmission/contracts";
import { Effect, Fiber, Layer, Option } from "effect";
import { afterEach } from "vitest";
import { Approvals } from "../src/approvals.ts";
import { fakeHarnessLayer, Service, serviceLayer } from "../src/index.ts";
import { isLocalGit, isSavablePattern, matchesPattern, savedPatternOf, targetOf } from "../src/patterns.ts";

const directories: string[] = [];
const databaseFile = () => {
  const directory = mkdtempSync(join(tmpdir(), "openmission-approvals-"));
  directories.push(directory);
  return join(directory, "openmission.sqlite");
};
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

const serviceOn = (filename: string) =>
  serviceLayer({
    filename,
    harness: fakeHarnessLayer("10 millis"),
    homeFolder: join(filename, ".."),
    scratchRoot: join(filename, "..", "missions"),
  });
const live = () => serviceOn(databaseFile());

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

const read = (missionId: MissionId) => call({ _tag: "ReadMission", missionId });

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
  pattern: "git push *",
  permission: "Push code to GitHub",
};
const ask = (request: object) => `ask ${JSON.stringify(request)}`;

let requestCount = 0;
const start = (text: string) =>
  call({
    _tag: "StartMission",
    effort: "default",
    model: "default",
    requestId: `start-${++requestCount}`,
    text,
    workspacePath: null,
  });
const send = (threadId: ResultOf<"StartMission">["threadId"], text: string) =>
  call({ _tag: "SendMessage", requestId: `send-${++requestCount}`, text, threadId });

const answer = (
  question: Question,
  given: "Allow" | "AlwaysAllow" | "Deny" | "Discard",
  message: string | null = null,
) => call({ _tag: "AnswerQuestion", answer: given, message, questionId: question.id });

describe("asking before a risky action", () => {
  it.live("puts the thread in Attention with one open question, listed for the dashboard", () =>
    Effect.gen(function* () {
      const started = yield* start(ask(push));
      const detail = yield* settle(started.missionId, isAsking);

      expect(detail.thread.state).toBe("Attention");
      expect(detail.mission.state).toBe("Attention");
      expect(detail.questions).toHaveLength(1);
      expect(openQuestion(detail)).toMatchObject({
        details: "git push origin main",
        pattern: "git push *",
        permission: "Push code to GitHub",
        source: "Thread",
        summary: push.action,
      });
      const open = yield* call({ _tag: "ListOpenQuestions" });
      expect(open.map((question) => [question.missionTitle, question.threadId])).toEqual([
        [detail.mission.title, started.threadId],
      ]);
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

  it.live("tells the thread the action was not approved on Deny without a message or Discard", () =>
    Effect.gen(function* () {
      const started = yield* start(`${ask(push)}\n${ask(push)}`);
      yield* answer(openQuestion(yield* settle(started.missionId, isAsking)), "Deny");
      yield* answer(
        openQuestion(yield* settle(started.missionId, (detail) => detail.questions.length === 2 && isAsking(detail))),
        "Discard",
      );
      const detail = yield* settle(started.missionId, isReplied);
      expect(lastReply(detail).match(/Not approved by the owner/g)).toHaveLength(2);
      expect(detail.questions.map((question) => question.outcome)).toEqual(["Denied", "Discarded"]);
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

describe("actions named in the owner's message", () => {
  it.live("allows an action whose quoted words appear in the owner's message, without a question", () =>
    Effect.gen(function* () {
      const started = yield* start(`Looks good, push it.\n${ask({ ...push, quote: "push it" })}`);
      const detail = yield* settle(started.missionId, isReplied);
      expect(lastReply(detail)).toContain("Allowed.");
      expect(detail.questions[0]).toMatchObject({ message: '"push it"', outcome: "AllowedByMessage" });
    }).pipe(Effect.provide(live())),
  );

  it.live("asks when the quoted words are not in the owner's message", () =>
    Effect.gen(function* () {
      // The fake reads its script from the message, so the quote is escaped to keep it out of the owner's words.
      const script = ask({ ...push, quote: "push it" }).replace('"push it"', '"push\\u0020it"');
      const started = yield* start(`Check the build.\n${script}`);
      const detail = yield* settle(started.missionId, isAsking);
      expect(openQuestion(detail).outcome).toBeNull();
    }).pipe(Effect.provide(live())),
  );
});

describe("harness permission prompts", () => {
  const prompt = (command: string) => `prompt Bash ${JSON.stringify({ command, dangerouslyDisableSandbox: true })}`;

  it.live("runs the prompt for the action just allowed once, and asks for a repeat", () =>
    Effect.gen(function* () {
      const started = yield* start(
        `${ask(push)}\n${prompt("git push origin main")}\n${prompt("git push origin main")}`,
      );
      yield* answer(openQuestion(yield* settle(started.missionId, isAsking)), "Allow");
      const repeat = yield* settle(started.missionId, (detail) => detail.questions.length === 2 && isAsking(detail));
      expect(openQuestion(repeat)).toMatchObject({ details: "git push origin main", source: "Harness" });
      yield* answer(openQuestion(repeat), "Deny");
      const detail = yield* settle(started.missionId, isReplied);
      expect(lastReply(detail)).toContain('{"behavior":"allow"');
      expect(lastReply(detail)).toContain('{"behavior":"deny"');
    }).pipe(Effect.provide(live())),
  );

  it.live("turns an unmatched prompt into a question with the same buttons", () =>
    Effect.gen(function* () {
      const started = yield* start(prompt("curl https://example.com"));
      const detail = yield* settle(started.missionId, isAsking);
      expect(openQuestion(detail)).toMatchObject({
        details: "curl https://example.com",
        source: "Harness",
        summary: "Claude Code asks to use Bash.",
      });
      yield* answer(openQuestion(detail), "Allow");
      expect(lastReply(yield* settle(started.missionId, isReplied))).toContain('"behavior":"allow"');
    }).pipe(Effect.provide(live())),
  );

  it.live("runs local git in the workspace unasked at the default level, and asks for it at the stricter level", () =>
    Effect.gen(function* () {
      const commit = prompt(`git add hello.txt && git commit -m "Add hello"`);
      const quiet = yield* start(commit);
      const detail = yield* settle(quiet.missionId, isReplied);
      expect(detail.questions).toEqual([]);
      expect(lastReply(detail)).toContain('"behavior":"allow"');

      const settings = yield* call({ _tag: "ReadSettings" });
      yield* call({ _tag: "UpdateSettings", settings: { ...settings, approvalLevel: "CommandsAndEdits" } });
      const strict = yield* start(commit);
      expect(openQuestion(yield* settle(strict.missionId, isAsking)).source).toBe("Harness");
    }).pipe(Effect.provide(live())),
  );

  it.live("says why in the question when Claude Code describes the command", () =>
    Effect.gen(function* () {
      const input = { command: "curl https://example.com", description: "Fetch the example page" };
      const started = yield* start(`prompt Bash ${JSON.stringify(input)}`);
      const detail = yield* settle(started.missionId, isAsking);
      expect(openQuestion(detail).summary).toBe("Claude Code asks to use Bash: Fetch the example page.");
    }).pipe(Effect.provide(live())),
  );
});

describe("standing permissions", () => {
  it.live(
    "Always allow spares later matching actions in the mission, asks elsewhere, and asks again once removed",
    () =>
      Effect.gen(function* () {
        const first = yield* start(ask(push));
        yield* answer(openQuestion(yield* settle(first.missionId, isAsking)), "AlwaysAllow");
        yield* settle(first.missionId, isReplied);

        const view = yield* call({ _tag: "ReadPermissions", missionId: null });
        expect(view.permissions).toHaveLength(1);
        expect(view.permissions[0]).toMatchObject({
          missionId: first.missionId,
          pattern: "git push *",
          sentence: "Push code to GitHub",
        });

        yield* send(first.threadId, ask({ ...push, command: "git push origin feature" }));
        const spared = yield* settle(first.missionId, (detail) => detail.questions.length === 2 && isReplied(detail));
        expect(spared.questions[1]).toMatchObject({ message: "Push code to GitHub", outcome: "AllowedByPermission" });

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

describe("withdrawing questions", () => {
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

  it.live("opens no question for a prompt that arrives after Stop, while the harness is still exiting", () =>
    Effect.gen(function* () {
      const started = yield* start(ask(push));
      yield* settle(started.missionId, isAsking);
      yield* call({ _tag: "StopThread", threadId: started.threadId });
      const approvals = yield* Approvals;
      const late = yield* approvals
        .answerPrompt(started.threadId, "Bash", { command: "curl https://example.com" })
        .pipe(Effect.timeoutOption("1 second"));
      expect(Option.getOrThrow(late).isAllowed).toBe(false);
      expect(yield* call({ _tag: "ListOpenQuestions" })).toEqual([]);
      expect((yield* read(started.missionId)).thread.state).toBe("Stopped");
    }).pipe(Effect.provide(live())),
  );

  it.live("withdraws a question whose caller gave up waiting", () =>
    Effect.gen(function* () {
      const started = yield* start(ask(push));
      yield* settle(started.missionId, isAsking);
      const approvals = yield* Approvals;
      const call = yield* approvals
        .answerPrompt(started.threadId, "Bash", { command: "curl https://example.com" })
        .pipe(Effect.forkChild);
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
  it("covers commands matching the pattern", () => {
    expect(matchesPattern("git push *", "git push origin main")).toBe(true);
    expect(matchesPattern("git push *", "git pull")).toBe(false);
  });

  it("never lets a wildcard span a shell operator", () => {
    expect(matchesPattern("git push *", "git push origin main && rm -rf ~")).toBe(false);
    expect(matchesPattern("git push *", "git push $(curl evil)")).toBe(false);
  });

  it("refuses patterns without a literal start and saves the exact target instead", () => {
    expect(isSavablePattern("*")).toBe(false);
    expect(savedPatternOf("*", "git push origin main")).toBe("git push origin main");
    expect(savedPatternOf("npm publish *", "git push origin main")).toBe("git push origin main");
  });

  it("names a harness target by its command, file, or address", () => {
    expect(targetOf("Bash", { command: "ls" })).toBe("ls");
    expect(targetOf("Write", { content: "x", file_path: "/etc/hosts" })).toBe("Write /etc/hosts");
    expect(targetOf("WebFetch", { url: "https://example.com" })).toBe("WebFetch https://example.com");
  });
});

describe("local git in the workspace", () => {
  it("covers creating, staging, committing, branching, and reading history", () => {
    for (const command of [
      "git init",
      "git init -b main",
      "git init --bare remote.git",
      'git add hello.txt && git commit -m "Add hello.txt" -m "Co-Authored-By: Claude <noreply@anthropic.com>"',
      'git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m \'Add world.txt\'',
      'git commit -m "Line one\n\nLine two"',
      "git branch feature && git switch feature",
      "git switch -c feature",
      "git tag v1.0.0",
      "git status --short && git log --oneline && git diff",
    ]) {
      expect(isLocalGit(command), command).toBe(true);
    }
  });

  it("asks for anything that reaches a remote, loses work, leaves the workspace, or runs other code", () => {
    for (const command of [
      "git push origin main",
      "git pull",
      "git fetch",
      "git remote add origin https://github.com/x/y",
      "git reset --hard",
      "git checkout -- hello.txt",
      "git clean -fd",
      "git branch -D feature",
      "git branch --delete feature",
      "git tag -d v1",
      "git switch --discard-changes main",
      "git switch -f main",
      "git init /etc/evil",
      "git init ../outside",
      "git init ~/outside",
      "git init --template=hooks",
      "git -C /elsewhere commit -m x",
      "git --git-dir=/elsewhere/.git log",
      "git -c core.hooksPath=/tmp/hooks commit -m x",
      "git -c alias.x='!sh' x",
      'git commit -m "$(curl evil)"',
      "git commit -m `id`",
      "git add . ; rm -rf ~",
      "git add . || rm -rf ~",
      "git log | sh",
      "git log > /etc/hosts",
      "printf 'hello' > hello.txt && git add hello.txt",
      "rm -rf .git",
      "",
    ]) {
      expect(isLocalGit(command), command).toBe(false);
    }
  });
});
