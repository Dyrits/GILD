import { describe, expect, it } from "@effect/vitest";
import type { MissionDetail, Question } from "@iskios/contracts";
import { Effect } from "effect";
import { call, send, settle, start, withService } from "../fixtures/service.ts";

// action-approval, Standing permissions: Always allow for one outside file never covers an edit that also changes
// another file; the owner is asked again (CHG-0274, audit SA-09).

const editLineOf = (input: object) => `prompt Edit ${JSON.stringify(input)}`;
const fileA = "/outside/iskios-a.txt";
const singleEdit = { file_path: fileA };
const pairEdit = { file_path: fileA, file_paths: [fileA, "/outside/iskios-b.txt"] };
const otherPairEdit = { file_path: fileA, file_paths: [fileA, "/outside/iskios-c.txt"] };

const findOpenQuestion = (detail: MissionDetail) => detail.questions.find((question) => question.outcome === null);
const isAsking = (detail: MissionDetail) => findOpenQuestion(detail) !== undefined;
const hasReplies = (count: number) => (detail: MissionDetail) =>
  detail.thread.state === "Idle" && detail.messages.filter((message) => message.sender === "agent").length === count;
const lastMessageTextOf = (detail: MissionDetail) => detail.messages.at(-1)?.text ?? "";

/** Answers the open question; dies when there is none. */
const answerOpen = (detail: MissionDetail, given: "AlwaysAllow" | "Deny") => {
  const question: Question | undefined = findOpenQuestion(detail);
  return question === undefined
    ? Effect.die(new Error(`no open question: ${JSON.stringify(detail.questions)}`))
    : call({ _tag: "AnswerQuestion", answer: given, message: null, questionId: question.id });
};

describe("asking again for a multi-file edit beyond a standing permission", () => {
  it.live("asks about an edit of two outside files when only the first was always allowed, and Deny refuses it", () =>
    withService(
      Effect.gen(function* () {
        const started = yield* start(editLineOf(singleEdit));
        yield* answerOpen(yield* settle(started.missionId, isAsking), "AlwaysAllow");
        yield* settle(started.missionId, hasReplies(1));
        yield* send(started.threadId, editLineOf(pairEdit));
        const asked = yield* settle(started.missionId, (detail) => isAsking(detail) || hasReplies(2)(detail));
        expect(findOpenQuestion(asked)).toMatchObject({ permission: "Change a file outside the workspace" });
        yield* answerOpen(asked, "Deny");
        expect(lastMessageTextOf(yield* settle(started.missionId, hasReplies(2)))).toContain("prompt denied");
      }),
    ),
  );

  it.live("asks about another file set sharing the first file, and spares the exact set allowed before", () =>
    withService(
      Effect.gen(function* () {
        const started = yield* start(editLineOf(pairEdit));
        yield* answerOpen(yield* settle(started.missionId, isAsking), "AlwaysAllow");
        yield* settle(started.missionId, hasReplies(1));
        yield* send(started.threadId, editLineOf(pairEdit));
        expect(lastMessageTextOf(yield* settle(started.missionId, hasReplies(2)))).toContain("prompt allowed");
        yield* send(started.threadId, editLineOf(otherPairEdit));
        const asked = yield* settle(started.missionId, (detail) => isAsking(detail) || hasReplies(3)(detail));
        expect(findOpenQuestion(asked)).toBeDefined();
        yield* answerOpen(asked, "Deny");
        yield* settle(started.missionId, hasReplies(3));
      }),
    ),
  );
});
