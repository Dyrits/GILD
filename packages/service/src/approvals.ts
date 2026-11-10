import type { Answer, Question, QuestionOutcome, QuestionSource } from "@gild/contracts";
import { Clock, Context, Effect, Layer } from "effect";
import { SqlClient, type SqlError } from "effect/sql";
import { makeOwnerWaits } from "./attention.ts";
import { Changes } from "./changes.ts";
import { invalid, notFound, type ServiceFailure } from "./errors.ts";
import { isInsideFolder } from "./folders.ts";
import { resumeInTurn } from "./lifecycle.ts";
import { readOwnerTextsOfTurn } from "./messaging.ts";
import {
  changedFilesOf,
  isFileChange,
  plainActionOf,
  reasonOf,
  savedPatternOf,
  sensitivityOf,
  targetOf,
} from "./patterns.ts";
import { findCoveringPermission, insertPermission } from "./permissions.ts";
import { readQuestion } from "./questions.ts";
import { isNamingQuote } from "./quotes.ts";
import { readSettings } from "./settings.ts";
import { ScratchRoot, threadFolderOf } from "./workspaces.ts";

/** What a thread passes to `request_approval`: one action, said in plain language, with its exact target. */
export interface ApprovalRequest {
  /** One sentence: what the thread wants to do and why. */
  readonly action: string;
  /** The exact command, file, or target. */
  readonly command: string;
  /** The command pattern Always allow would save. */
  readonly pattern: string | null;
  /** The short sentence Always allow would save. */
  readonly permission: string | null;
  /** The owner's own words naming this action, when the thread believes the owner already approved it. */
  readonly quote: string | null;
}

/** The answer a thread or the harness receives. */
export interface Decision {
  readonly isAllowed: boolean;
  /** Told to the thread: the refusal, the owner's message, or how to proceed. */
  readonly text: string;
}

interface Resolution {
  readonly message: string | null;
  readonly outcome: QuestionOutcome;
}

/** Owns approval questions: asking, the owner's answers, one-time allowances, and withdrawal. */
export class Approvals extends Context.Service<
  Approvals,
  {
    readonly answer: (
      questionId: string,
      answer: Answer,
      message: string | null,
      device: string,
    ) => Effect.Effect<Question, ServiceFailure | SqlError.SqlError>;
    readonly answerPrompt: (threadId: string, toolName: string, input: unknown) => Effect.Effect<Decision>;
    readonly requestApproval: (threadId: string, request: ApprovalRequest) => Effect.Effect<Decision>;
    /** Forgets the thread's one-time allowances: an approval lasts only the turn it was given in. */
    readonly endTurn: (threadId: string) => Effect.Effect<void>;
    readonly withdraw: (threadId: string) => Effect.Effect<void>;
  }
>()("gild/Approvals") {}

const outcomeOfAnswer = {
  Allow: "Allowed",
  AlwaysAllow: "AlwaysAllowed",
  Deny: "Denied",
} as const satisfies Record<Answer, QuestionOutcome>;

const allowingOutcomes: ReadonlyArray<QuestionOutcome> = [
  "Allowed",
  "AlwaysAllowed",
  "AllowedByMessage",
  "AllowedByPermission",
  "AllowedAutomatically",
];

// Shown to the thread after an approval: an approved command must leave the
// sandbox to reach the network or outside files (work-in-progress, probe evidence).
// The approved command must run alone: anything chained to it no longer matches and asks again.
const allowedText =
  "Allowed. Do exactly this action now, with nothing chained before or after it; run any other step separately. " +
  "For a Bash command, run it with dangerouslyDisableSandbox set to true.";

const textOf = (resolution: Resolution) =>
  allowingOutcomes.includes(resolution.outcome)
    ? allowedText
    : resolution.outcome === "Withdrawn"
      ? "Withdrawn: the owner stopped this thread."
      : resolution.message !== null
        ? `Denied by the owner: ${resolution.message}`
        : "Not approved by the owner. Do not do this action; carry on without it.";

/** Approvals over the store, holding the open questions and one-time allowances in memory. */
export const approvalsLayer = Layer.effect(
  Approvals,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const changes = yield* Changes;
    const scratchRoot = yield* ScratchRoot;
    const waits = makeOwnerWaits<Resolution>(sql, changes);
    const withdrawn: Resolution = { message: null, outcome: "Withdrawn" };
    // Targets approved through `request_approval` that the next matching harness prompt may run once.
    const allowances = new Map<string, Array<string>>();

    // Provisional until recovery is settled (work-in-progress, open questions): a
    // restart ends the harness process behind an open question, so it is withdrawn.
    const startedAt = yield* Clock.currentTimeMillis;
    yield* sql`UPDATE questions SET outcome = 'Withdrawn', resolved_at = ${startedAt} WHERE outcome IS NULL`;
    // The thread lifecycle returns the threads that waited on them to Idle (lifecycle.ts, recoverThreadStates).

    const missionOf = (threadId: string) =>
      sql<{ missionId: string }>`SELECT mission_id AS missionId FROM threads WHERE id = ${threadId}`.pipe(
        Effect.map(([row]) => row?.missionId ?? null),
      );

    const allowOnce = (threadId: string, target: string) =>
      Effect.sync(() => allowances.set(threadId, [...(allowances.get(threadId) ?? []), target.trim()]));

    const takeAllowance = (threadId: string, target: string) =>
      Effect.sync(() => {
        const targets = allowances.get(threadId) ?? [];
        const index = targets.indexOf(target.trim());
        if (index === -1) return false;
        allowances.set(threadId, targets.toSpliced(index, 1));
        return true;
      });

    interface Asked {
      readonly details: string;
      readonly missionId: string;
      readonly pattern: string | null;
      readonly permission: string | null;
      readonly source: QuestionSource;
      readonly summary: string;
      readonly threadId: string;
    }

    /** Records a question already decided without asking, as a line in its thread. */
    const record = (asked: Asked, resolution: Resolution) =>
      sql.withTransaction(
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis;
          yield* sql`INSERT INTO questions (id, mission_id, thread_id, source, summary, details, pattern, permission,
              asked_at, outcome, message, resolved_at)
            VALUES (${crypto.randomUUID()}, ${asked.missionId}, ${asked.threadId}, ${asked.source}, ${asked.summary},
              ${asked.details}, ${asked.pattern}, ${asked.permission}, ${now}, ${resolution.outcome},
              ${resolution.message}, ${now})`;
          yield* sql.afterCommit(changes.publish);
        }),
      );

    /**
     * Opens a question, puts its thread in Attention, and waits with no time limit for its resolution.
     * A thread no longer at work, such as one just stopped whose harness is still exiting, is not asked.
     */
    const ask = (asked: Asked) =>
      waits
        .ask({
          // A caller that gave up, such as Claude Code abandoning the call, leaves nobody to answer.
          abandon: (id) => resolve(id, asked.threadId, withdrawn, null),
          missionId: asked.missionId,
          record: (id, now) =>
            sql`INSERT INTO questions (id, mission_id, thread_id, source, summary, details, pattern, permission,
                asked_at)
              VALUES (${id}, ${asked.missionId}, ${asked.threadId}, ${asked.source}, ${asked.summary},
                ${asked.details}, ${asked.pattern}, ${asked.permission}, ${now})`.pipe(Effect.asVoid),
          threadId: asked.threadId,
        })
        .pipe(Effect.map((resolution) => resolution ?? withdrawn));

    /** Ends an open question and returns its thread to Running once no other question is open. */
    const resolve = (questionId: string, threadId: string, resolution: Resolution, device: string | null) =>
      sql.withTransaction(
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis;
          yield* sql`UPDATE questions SET outcome = ${resolution.outcome}, message = ${resolution.message},
              device = ${device}, resolved_at = ${now}
            WHERE id = ${questionId} AND outcome IS NULL`;
          yield* resumeInTurn(threadId).pipe(Effect.provideService(SqlClient.SqlClient, sql));
          yield* sql.afterCommit(changes.publish);
        }),
      );

    /** Whether the owner's messages that started the thread's current turn approve the command in the quoted words. */
    const isQuotedByOwner = (threadId: string, quote: string, command: string) =>
      Effect.gen(function* () {
        const texts = yield* readOwnerTextsOfTurn(threadId);
        return texts.some((text) => isNamingQuote(text, quote, command));
      });

    const requestApproval = (threadId: string, request: ApprovalRequest) =>
      Effect.gen(function* () {
        const missionId = yield* missionOf(threadId);
        if (missionId === null) return { isAllowed: false, text: "Unknown thread." } satisfies Decision;
        const kind = sensitivityOf("Bash", { command: request.command })?.permission ?? null;
        const asked: Asked = {
          details: request.command,
          missionId,
          // The question shows the pattern Always allow will save, which falls back to the exact command.
          pattern: savedPatternOf(request.pattern, request.command),
          // The sensitive list names the kinds it knows, so a push saves "Push code" whatever the thread called it.
          permission: kind ?? request.permission,
          source: "Thread",
          summary: request.action,
          threadId,
        };
        if (request.quote !== null && (yield* isQuotedByOwner(threadId, request.quote, request.command))) {
          const resolution: Resolution = { message: `"${request.quote.trim()}"`, outcome: "AllowedByMessage" };
          yield* record(asked, resolution);
          yield* allowOnce(threadId, request.command);
          return { isAllowed: true, text: textOf(resolution) } satisfies Decision;
        }
        const covering = yield* findCoveringPermission(threadId, request.command, kind);
        if (covering !== null) {
          const resolution: Resolution = { message: covering.sentence, outcome: "AllowedByPermission" };
          yield* record(asked, resolution);
          yield* allowOnce(threadId, request.command);
          return { isAllowed: true, text: textOf(resolution) } satisfies Decision;
        }
        const resolution = yield* ask(asked);
        const isAllowed = allowingOutcomes.includes(resolution.outcome);
        if (isAllowed) yield* allowOnce(threadId, request.command);
        return { isAllowed, text: textOf(resolution) } satisfies Decision;
      }).pipe(Effect.orDie);

    /**
     * A prompt's sensitivity, where a file change inside the thread's folder is ordinary work: harnesses ask about
     * such changes only at "Also commands and edits", whose question then names no outside change.
     */
    const sensitivityInFolderOf = (threadId: string, toolName: string, input: unknown) =>
      Effect.gen(function* () {
        const sensitivity = sensitivityOf(toolName, input);
        const files = changedFilesOf(input);
        if (!isFileChange(sensitivity) || files.length === 0) return sensitivity;
        const folder = yield* threadFolderOf(threadId).pipe(Effect.provideService(ScratchRoot, scratchRoot));
        if (folder === null) return sensitivity;
        for (const file of files) if (!(yield* isInsideFolder(folder, file))) return sensitivity;
        return null;
      });

    const answerPrompt = (threadId: string, toolName: string, input: unknown) =>
      Effect.gen(function* () {
        const target = targetOf(toolName, input);
        if (yield* takeAllowance(threadId, target)) return { isAllowed: true, text: "" } satisfies Decision;
        const missionId = yield* missionOf(threadId);
        if (missionId === null) return { isAllowed: false, text: "Unknown thread." } satisfies Decision;
        const { approvalLevel } = yield* readSettings;
        const sensitivity = yield* sensitivityInFolderOf(threadId, toolName, input);
        const reason = reasonOf(input);
        const plain = `${reason ?? plainActionOf(toolName)}.`;
        // At the default level only a sensitive action asks; anything else runs and leaves
        // a line, with or without a sandbox (CHG-0035).
        if (approvalLevel === "RiskyOnly" && sensitivity === null) {
          yield* record(
            {
              details: target,
              missionId,
              pattern: null,
              permission: null,
              source: "Harness",
              summary: plain,
              threadId,
            },
            { message: null, outcome: "AllowedAutomatically" },
          );
          return { isAllowed: true, text: "" } satisfies Decision;
        }
        const asked: Asked = {
          details: target,
          missionId,
          pattern: null,
          permission: sensitivity?.permission ?? null,
          source: "Harness",
          summary: sensitivity === null ? plain : `${reason ?? sensitivity.permission}. ${sensitivity.consequence}`,
          threadId,
        };
        const covering = yield* findCoveringPermission(threadId, target, sensitivity?.permission ?? null);
        if (covering !== null) {
          yield* record(asked, { message: covering.sentence, outcome: "AllowedByPermission" });
          return { isAllowed: true, text: "" } satisfies Decision;
        }
        const resolution = yield* ask(asked);
        return {
          isAllowed: allowingOutcomes.includes(resolution.outcome),
          text: textOf(resolution),
        } satisfies Decision;
      }).pipe(Effect.orDie);

    const answer = (questionId: string, given: Answer, message: string | null, device: string) =>
      Effect.gen(function* () {
        const question = yield* readQuestion(questionId);
        if (question === null) return yield* notFound("No such question.");
        if (question.outcome !== null) return yield* invalid("This question was already answered.");
        if (!waits.isWaiting(questionId)) return yield* invalid("This question is no longer waiting.");
        const note = given === "Deny" && message !== null && message.trim() !== "" ? message.trim() : null;
        const resolution: Resolution = { message: note, outcome: outcomeOfAnswer[given] };
        if (given === "AlwaysAllow") {
          yield* sql.withTransaction(
            insertPermission(
              question.threadId,
              question.permission ?? question.summary,
              savedPatternOf(question.pattern, question.details),
            ),
          );
        }
        yield* resolve(questionId, question.threadId, resolution, device);
        yield* waits.settle(questionId, resolution);
        const answered = yield* readQuestion(questionId);
        return answered ?? question;
      }).pipe(Effect.provideService(SqlClient.SqlClient, sql));

    const withdraw = (threadId: string) =>
      Effect.gen(function* () {
        const open = yield* sql<{
          id: string;
        }>`SELECT id FROM questions WHERE thread_id = ${threadId} AND outcome IS NULL`;
        for (const { id } of open) {
          yield* resolve(id, threadId, withdrawn, null);
          yield* waits.settle(id, withdrawn);
        }
        allowances.delete(threadId);
      }).pipe(Effect.orDie);

    return {
      answer,
      answerPrompt: (threadId, toolName, input) =>
        answerPrompt(threadId, toolName, input).pipe(Effect.provideService(SqlClient.SqlClient, sql)),
      endTurn: (threadId) => Effect.sync(() => allowances.delete(threadId)).pipe(Effect.asVoid),
      requestApproval: (threadId, request) =>
        requestApproval(threadId, request).pipe(Effect.provideService(SqlClient.SqlClient, sql)),
      withdraw,
    };
  }),
);
