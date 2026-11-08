import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { MissionDetail, MissionId, Question, Request, RequestTag, ResultOf } from "@canopy/contracts";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Fiber, Layer, Option } from "effect";
import { afterEach } from "vitest";
import { Approvals } from "../src/approvals.ts";
import { fakeHarnessLayer, Service, serviceLayer } from "../src/index.ts";
import { isSavablePattern, matchesPattern, savedPatternOf, sensitivityOf, targetOf } from "../src/patterns.ts";
import { isNamingQuote } from "../src/quotes.ts";

const directories: string[] = [];
const databaseFile = () => {
  const directory = mkdtempSync(join(tmpdir(), "canopy-approvals-"));
  directories.push(directory);
  return join(directory, "canopy.sqlite");
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
  call({ _tag: "SendMessage", delivery: null, requestId: `send-${++requestCount}`, text, threadId });

const answer = (question: Question, given: "Allow" | "AlwaysAllow" | "Deny", message: string | null = null) =>
  call({ _tag: "AnswerQuestion", answer: given, message, questionId: question.id });

describe("asking before a sensitive action", () => {
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
        permission: "Push code",
        source: "Thread",
        summary: push.action,
      });
      const open = yield* call({ _tag: "ListOpenQuestions" });
      expect(open.map((question) => [question.missionTitle, question.threadId])).toEqual([
        [detail.mission.title, started.threadId],
      ]);
    }).pipe(Effect.provide(live())),
  );

  it.live("names what Always allow saves after the sensitive list, and after the thread for actions it misses", () =>
    Effect.gen(function* () {
      const recognized = yield* start(ask(push));
      expect(openQuestion(yield* settle(recognized.missionId, isAsking)).permission).toBe("Push code");

      const missed = yield* start(
        ask({ action: "Rotate the staging token", command: "./rotate-token.sh staging", permission: "Rotate tokens" }),
      );
      expect(openQuestion(yield* settle(missed.missionId, isAsking)).permission).toBe("Rotate tokens");
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

  it.live("asks when the owner's quoted words refuse the action", () =>
    Effect.gen(function* () {
      const script = ask({ ...push, quote: "push it" }).replace('"push it"', '"push\\u0020it"');
      const started = yield* start(`Don't push it yet.\n${script}`);
      const detail = yield* settle(started.missionId, isAsking);
      expect(openQuestion(detail).outcome).toBeNull();
    }).pipe(Effect.provide(live())),
  );

  it.live("asks when the quoted words do not name the action", () =>
    Effect.gen(function* () {
      const started = yield* start(`Fix it.\n${ask({ ...push, quote: "it" })}`);
      const detail = yield* settle(started.missionId, isAsking);
      expect(openQuestion(detail).outcome).toBeNull();
    }).pipe(Effect.provide(live())),
  );
});

describe("checking the owner's quoted words", () => {
  const command = "git push origin main";

  it("accepts words that appear in the owner's message and name the action", () => {
    expect(isNamingQuote("Looks good, push it.", "push it", command)).toBe(true);
    expect(isNamingQuote("Push it, but don't deploy.", "Push it", command)).toBe(true);
    expect(isNamingQuote("Ship it!", "ship it", "bunx wrangler deploy")).toBe(true);
    expect(isNamingQuote("Then send this to Alice.", "send this to Alice", "mail -s hi alice@example.com")).toBe(true);
  });

  it("refuses words missing from the message or found only inside a longer word", () => {
    expect(isNamingQuote("Check the build.", "push it", command)).toBe(false);
    expect(isNamingQuote("That was a pushover.", "push", command)).toBe(false);
    expect(isNamingQuote("push it", "  ", command)).toBe(false);
  });

  it("refuses words the owner negated in the same sentence", () => {
    for (const message of ["Don't push it.", "Please do not push it yet", "Never push it", "Ne push it pas"]) {
      expect(isNamingQuote(message, "push it", command), message).toBe(false);
    }
    expect(isNamingQuote("No need to wait. Push it.", "push it", command)).toBe(true);
  });

  it("refuses words that name another kind of action, or no action at all", () => {
    expect(isNamingQuote("Fix it.", "it", command)).toBe(false);
    expect(isNamingQuote("Run the tests on main.", "Run the tests on main", command)).toBe(false);
    expect(isNamingQuote("Push it.", "push it", "npm publish")).toBe(false);
  });

  it("accepts, for an action the sensitive list misses, words the command shares", () => {
    expect(isNamingQuote("Rotate the staging token.", "Rotate the staging token", "./rotate-token.sh staging")).toBe(
      true,
    );
    expect(isNamingQuote("Do it.", "Do it", "./rotate-token.sh staging")).toBe(false);
  });
});

describe("harness permission prompts", () => {
  const prompt = (command: string) => `prompt Bash ${JSON.stringify({ command, dangerouslyDisableSandbox: true })}`;

  it.live("asks again when the action allowed in an earlier turn is prompted in a later one", () =>
    Effect.gen(function* () {
      const started = yield* start(ask(push));
      yield* answer(openQuestion(yield* settle(started.missionId, isAsking)), "Allow");
      yield* settle(started.missionId, isReplied);
      yield* send(started.threadId, prompt("git push origin main"));
      const later = yield* settle(started.missionId, (detail) => detail.questions.length === 2 && isAsking(detail));
      expect(openQuestion(later)).toMatchObject({ details: "git push origin main", source: "Harness" });
    }).pipe(Effect.provide(live())),
  );

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
      expect(lastReply(detail)).toContain("prompt allowed | prompt denied: ");
    }).pipe(Effect.provide(live())),
  );

  it.live("runs the action just allowed once when Codex prompts for it wrapped in a shell script", () =>
    Effect.gen(function* () {
      const started = yield* start(`${ask(push)}\n${prompt("/bin/zsh -lc 'git push origin main'")}`);
      yield* answer(openQuestion(yield* settle(started.missionId, isAsking)), "Allow");
      const detail = yield* settle(started.missionId, isReplied);
      expect(lastReply(detail)).toContain("prompt allowed");
      expect(detail.questions).toHaveLength(1);
    }).pipe(Effect.provide(live())),
  );

  it.live("runs a prompt the sensitive list does not recognize without a question, and leaves a line", () =>
    Effect.gen(function* () {
      const listing = 'for f in src/*.js; do echo "=== $f"; cat -n $f; done';
      const started = yield* start(prompt(listing));
      const detail = yield* settle(started.missionId, isReplied);
      expect(lastReply(detail)).toContain("prompt allowed");
      expect(detail.questions).toMatchObject([
        { details: listing, outcome: "AllowedAutomatically", source: "Harness" },
      ]);
    }).pipe(Effect.provide(live())),
  );

  it.live("turns a sensitive prompt into a question saying, in plain words, what it affects", () =>
    Effect.gen(function* () {
      const input = { command: "git push origin main", description: "Push the branch to GitHub" };
      const started = yield* start(`prompt Bash ${JSON.stringify(input)}`);
      const detail = yield* settle(started.missionId, isAsking);
      expect(openQuestion(detail)).toMatchObject({
        details: "git push origin main",
        permission: "Push code",
        source: "Harness",
        summary:
          "Push the branch to GitHub. This sends your commits off this computer, where everyone with access to the repository can see them.",
      });
      yield* answer(openQuestion(detail), "Allow");
      expect(lastReply(yield* settle(started.missionId, isReplied))).toContain("prompt allowed");
    }).pipe(Effect.provide(live())),
  );

  it.live("answers Claude Code's permission prompt tool in its own format, allowing or denying", () =>
    Effect.gen(function* () {
      const promptTool = (command: string) =>
        `call answer_prompt ${JSON.stringify({ input: { command }, tool_name: "Bash" })}`;
      const started = yield* start(`${promptTool("ls")}\n${promptTool("git push origin main")}`);
      yield* answer(openQuestion(yield* settle(started.missionId, isAsking)), "Deny");
      const detail = yield* settle(started.missionId, isReplied);
      expect(lastReply(detail)).toContain('{"behavior":"allow","updatedInput":{"command":"ls"}}');
      expect(lastReply(detail)).toContain('{"behavior":"deny","message":"Not approved by the owner.');
    }).pipe(Effect.provide(live())),
  );

  it.live("names the kind of action when Claude Code gives no reason", () =>
    Effect.gen(function* () {
      const started = yield* start(prompt("rm -rf ~/Documents/old"));
      const detail = yield* settle(started.missionId, isAsking);
      expect(openQuestion(detail).summary).toBe(
        "Delete files outside the workspace. They do not go to the Trash and cannot be recovered.",
      );
    }).pipe(Effect.provide(live())),
  );

  it.live("runs local git unasked at the default level, and asks for every prompt at the stricter level", () =>
    Effect.gen(function* () {
      const commit = prompt(`git add hello.txt && git commit -m "Add hello"`);
      const quiet = yield* start(commit);
      const detail = yield* settle(quiet.missionId, isReplied);
      expect(detail.questions.map((question) => question.outcome)).toEqual(["AllowedAutomatically"]);
      expect(lastReply(detail)).toContain("prompt allowed");

      const settings = yield* call({ _tag: "ReadSettings" });
      yield* call({ _tag: "UpdateSettings", settings: { ...settings, approvalLevel: "CommandsAndEdits" } });
      const strict = yield* start(commit);
      expect(openQuestion(yield* settle(strict.missionId, isAsking)).source).toBe("Harness");
    }).pipe(Effect.provide(live())),
  );

  it.live("asks about a change inside the thread's folder at the stricter level as an ordinary change", () =>
    Effect.gen(function* () {
      const settings = yield* call({ _tag: "ReadSettings" });
      yield* call({ _tag: "UpdateSettings", settings: { ...settings, approvalLevel: "CommandsAndEdits" } });
      const inside = yield* start(`prompt Edit ${JSON.stringify({ file_path: "notes/plan.md" })}`);
      expect(openQuestion(yield* settle(inside.missionId, isAsking))).toMatchObject({
        permission: null,
        summary: "Change a file.",
      });
      const outside = yield* start(`prompt Edit ${JSON.stringify({ file_path: "../elsewhere/plan.md" })}`);
      expect(openQuestion(yield* settle(outside.missionId, isAsking))).toMatchObject({
        permission: "Change a file outside the workspace",
      });
      const several = yield* start(`prompt Edit ${JSON.stringify({ file_path: "plan.md, /etc/hosts" })}`);
      expect(openQuestion(yield* settle(several.missionId, isAsking))).toMatchObject({
        permission: "Change a file outside the workspace",
      });
      const secret = yield* start(`prompt Edit ${JSON.stringify({ file_path: ".ssh/id_rsa" })}`);
      expect(openQuestion(yield* settle(secret.missionId, isAsking))).toMatchObject({
        permission: "Read passwords or keys",
      });
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
          sentence: "Push code",
        });

        yield* send(first.threadId, ask({ ...push, command: "git push origin feature" }));
        const spared = yield* settle(first.missionId, (detail) => detail.questions.length === 2 && isReplied(detail));
        expect(spared.questions[1]).toMatchObject({ message: "Push code", outcome: "AllowedByPermission" });

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

  it.live("shows in the question the pattern Always allow will save, not one that does not cover the action", () =>
    Effect.gen(function* () {
      const started = yield* start(ask({ ...push, pattern: "npm publish *" }));
      expect(openQuestion(yield* settle(started.missionId, isAsking)).pattern).toBe("git push origin main");
    }).pipe(Effect.provide(live())),
  );

  it.live("never lets a broad pattern saved for one kind of action cover another kind", () =>
    Effect.gen(function* () {
      const started = yield* start(ask({ ...push, pattern: "gi*" }));
      yield* answer(openQuestion(yield* settle(started.missionId, isAsking)), "AlwaysAllow");
      yield* settle(started.missionId, isReplied);

      yield* send(started.threadId, ask({ ...push, command: "git push origin feature" }));
      const pushed = yield* settle(started.missionId, (detail) => detail.questions.length === 2 && isReplied(detail));
      expect(pushed.questions[1]?.outcome).toBe("AllowedByPermission");

      const reset = { action: "Drop the last commit", command: "git reset --hard HEAD~1" };
      yield* send(started.threadId, ask(reset));
      const asking = yield* settle(started.missionId, isAsking);
      expect(openQuestion(asking)).toMatchObject({ details: reset.command, permission: "Discard work" });
    }).pipe(Effect.provide(live())),
  );

  it.live("never lets a pattern saved for an action the sensitive list misses cover a sensitive one", () =>
    Effect.gen(function* () {
      const script = {
        action: "Run the staging script",
        command: "./staging.sh",
        pattern: "./*",
        permission: "Run staging scripts",
      };
      const started = yield* start(ask(script));
      yield* answer(openQuestion(yield* settle(started.missionId, isAsking)), "AlwaysAllow");
      yield* settle(started.missionId, isReplied);

      yield* send(started.threadId, `prompt Bash ${JSON.stringify({ command: "./git push origin main" })}`);
      const asking = yield* settle(started.missionId, isAsking);
      expect(openQuestion(asking)).toMatchObject({ details: "./git push origin main", permission: "Push code" });
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
        .answerPrompt(started.threadId, "Bash", { command: "git push origin feature" })
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
        .answerPrompt(started.threadId, "Bash", { command: "git push origin feature" })
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

  it("names a command Codex wraps in a shell script by the script, and keeps anything around it", () => {
    expect(targetOf("Bash", { command: "/bin/zsh -lc 'git push origin main'" })).toBe("git push origin main");
    expect(targetOf("Bash", { command: 'bash -c "npm publish"' })).toBe("npm publish");
    expect(targetOf("Bash", { command: "zsh -lc 'a' ; rm -rf ~ ; echo 'b'" })).toBe(
      "zsh -lc 'a' ; rm -rf ~ ; echo 'b'",
    );
  });
});

describe("recognizing sensitive actions", () => {
  const kindOf = (command: string) => sensitivityOf("Bash", { command })?.permission ?? null;

  it("recognizes actions that leave the computer or cannot be undone", () => {
    const cases: ReadonlyArray<readonly [string, string]> = [
      ["git push origin main", "Push code"],
      ["git -c user.name=x push --force", "Push code"],
      ["cd app && git push", "Push code"],
      ["npm publish", "Publish"],
      ["bun publish --access public", "Publish"],
      ["cargo publish", "Publish"],
      ["docker push me/app", "Publish"],
      ["gh release create v1.0.0", "Publish"],
      ["wrangler deploy", "Deploy"],
      ["bunx wrangler deploy", "Deploy"],
      ["vercel --prod", "Deploy"],
      ["terraform apply", "Deploy"],
      ["kubectl delete pod web", "Deploy"],
      ["gh pr create --fill", "Post on GitHub"],
      ["gh issue comment 3 --body hi", "Post on GitHub"],
      ["gh api -X POST repos/x/y/issues", "Post on GitHub"],
      ["mail -s hi alice@example.com < note.txt", "Send a message"],
      ["osascript -e 'tell app \"Messages\" to send'", "Send a message"],
      ["curl -X POST https://api.example.com/orders", "Send data to a website"],
      ["curl -d 'a=1' https://example.com/form", "Send data to a website"],
      ["curl --upload-file report.pdf https://example.com", "Send data to a website"],
      ["ssh server.example.com uptime", "Connect to another computer"],
      ["scp build.zip me@host:/srv", "Connect to another computer"],
      ["rm -rf ~/Documents/old", "Delete files outside the workspace"],
      ["rm /etc/hosts", "Delete files outside the workspace"],
      ["rm -r ../sibling", "Delete files outside the workspace"],
      ["rm -rf .git", "Discard work"],
      ["git reset --hard", "Discard work"],
      ["git clean -fd", "Discard work"],
      ["git checkout -- hello.txt", "Discard work"],
      ["git restore hello.txt", "Discard work"],
      ["git stash drop", "Discard work"],
      ["git branch -D feature", "Discard work"],
      ["git switch --discard-changes main", "Discard work"],
      ["sudo rm /tmp/x", "Change this computer's system"],
      ["defaults write com.apple.dock autohide -bool true", "Change this computer's system"],
      ["brew install ffmpeg", "Change this computer's system"],
      ["npm install -g typescript", "Change this computer's system"],
      ["crontab -e", "Change this computer's system"],
      ["cat ~/.ssh/id_ed25519", "Read passwords or keys"],
      ["cat ~/.aws/credentials", "Read passwords or keys"],
      ["security find-generic-password -s github", "Read passwords or keys"],
      ["gh auth token", "Read passwords or keys"],
    ];
    for (const [command, kind] of cases) expect(kindOf(command), command).toBe(kind);
  });

  it("recognizes a sensitive command wrapped in a shell, an environment, or a launcher", () => {
    const cases: ReadonlyArray<readonly [string, string]> = [
      ["bash -lc 'git push origin main'", "Push code"],
      ['/bin/zsh -lc "git push"', "Push code"],
      ["sh -c 'cd app && npm publish'", "Publish"],
      ["env GIT_SSH_COMMAND=ssh git push", "Push code"],
      ["NODE_ENV=production bunx wrangler deploy", "Deploy"],
      ["command git push", "Push code"],
      ["time git push --force", "Push code"],
      ["nohup terraform apply", "Deploy"],
      ["exec /usr/bin/git push", "Push code"],
      ["nice -n 10 rm -rf ~/old", "Delete files outside the workspace"],
      ["eval 'git reset --hard'", "Discard work"],
    ];
    for (const [command, kind] of cases) expect(kindOf(command), command).toBe(kind);
  });

  it("lets ordinary work run: reading, building, testing, installing, and local git", () => {
    for (const command of [
      'for f in controllers/*.js; do echo "=== $f"; cat -n $f; done; ls images node_modules 2>&1 | head -5',
      "bun install",
      "bun run test",
      "npm install",
      "bun add effect",
      "git init",
      'git add . && git commit -m "Add hello"',
      "git switch -c feature",
      "git fetch origin",
      "git pull",
      "git log --oneline | head",
      "curl https://example.com",
      "rm -rf node_modules dist",
      "rm build/output.txt",
      "ls ~/Downloads",
      "echo pushed",
      "bash -lc 'bun run test'",
      "env CI=1 bun test",
      "time bun run build",
      "",
    ]) {
      expect(kindOf(command), command).toBeNull();
    }
  });

  it("treats a file change outside the workspace as a system change and a key file as a secret", () => {
    expect(sensitivityOf("Write", { file_path: "/Users/me/.zshrc" })?.permission).toBe(
      "Change a file outside the workspace",
    );
    expect(sensitivityOf("Edit", { file_path: "/Users/me/.ssh/config" })?.permission).toBe("Read passwords or keys");
    expect(sensitivityOf("Read", { file_path: "/Users/me/.aws/credentials" })?.permission).toBe(
      "Read passwords or keys",
    );
    expect(sensitivityOf("Read", { file_path: "/Users/me/Downloads/notes.txt" })).toBeNull();
    expect(sensitivityOf("WebFetch", { url: "https://example.com" })).toBeNull();
  });
});
