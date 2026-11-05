import type { Answer, Question, QuestionOutcome, QuestionSource } from "@openmission/contracts";
import { Clock, Context, Deferred, Effect, Layer } from "effect";
import { SqlClient, type SqlError } from "effect/sql";
import { Changes } from "./changes.ts";
import { invalid, notFound, type ServiceFailure } from "./errors.ts";
import { isLocalGit, savedPatternOf, summaryOf, targetOf } from "./patterns.ts";
import { findCoveringPermission, insertPermission } from "./permissions.ts";
import { readQuestion } from "./questions.ts";
import { sandboxProblem } from "./sandbox.ts";
import { readSettings } from "./settings.ts";

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
    readonly withdraw: (threadId: string) => Effect.Effect<void>;
  }
>()("openmission/Approvals") {}

const outcomeOfAnswer = {
  Allow: "Allowed",
  AlwaysAllow: "AlwaysAllowed",
  Deny: "Denied",
  Discard: "Discarded",
} as const satisfies Record<Answer, QuestionOutcome>;

const allowingOutcomes: ReadonlyArray<QuestionOutcome> = [
  "Allowed",
  "AlwaysAllowed",
  "AllowedByMessage",
  "AllowedByPermission",
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

export const approvalsLayer = Layer.effect(
  Approvals,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const changes = yield* Changes;
    const waiting = new Map<string, Deferred.Deferred<Resolution>>();
    // Targets approved through `request_approval` that the next matching harness prompt may run once.
    const allowances = new Map<string, Array<string>>();
    const isSandboxed = (yield* sandboxProblem) === null;

    // Provisional until recovery is settled (work-in-progress, open questions): a
    // restart ends the harness process behind an open question, so it is withdrawn.
    const startedAt = yield* Clock.currentTimeMillis;
    yield* sql`UPDATE questions SET outcome = 'Withdrawn', resolved_at = ${startedAt} WHERE outcome IS NULL`;
    yield* sql`UPDATE threads SET state = 'Idle' WHERE state = 'Attention'`;

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
      Effect.gen(function* () {
        const id = crypto.randomUUID();
        const deferred = yield* Deferred.make<Resolution>();
        const isAtWork = yield* sql.withTransaction(
          Effect.gen(function* () {
            const [thread] = yield* sql<{ state: string }>`SELECT state FROM threads WHERE id = ${asked.threadId}`;
            if (thread?.state !== "Running" && thread?.state !== "Attention") return false;
            waiting.set(id, deferred);
            const now = yield* Clock.currentTimeMillis;
            yield* sql`INSERT INTO questions (id, mission_id, thread_id, source, summary, details, pattern, permission,
                asked_at)
              VALUES (${id}, ${asked.missionId}, ${asked.threadId}, ${asked.source}, ${asked.summary},
                ${asked.details}, ${asked.pattern}, ${asked.permission}, ${now})`;
            yield* sql`UPDATE threads SET state = 'Attention' WHERE id = ${asked.threadId} AND state = 'Running'`;
            yield* sql`UPDATE missions SET last_activity_at = ${now} WHERE id = ${asked.missionId}`;
            yield* sql.afterCommit(changes.publish);
            return true;
          }),
        );
        const withdrawn: Resolution = { message: null, outcome: "Withdrawn" };
        if (!isAtWork) return withdrawn;
        return yield* Deferred.await(deferred).pipe(
          // A caller that gave up, such as Claude Code abandoning the call, leaves nobody to answer.
          Effect.onInterrupt(() => resolve(id, asked.threadId, withdrawn, null).pipe(Effect.ignore)),
          Effect.ensuring(Effect.sync(() => waiting.delete(id))),
        );
      });

    /** Ends an open question and returns its thread to Running once no other question is open. */
    const resolve = (questionId: string, threadId: string, resolution: Resolution, device: string | null) =>
      sql.withTransaction(
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis;
          yield* sql`UPDATE questions SET outcome = ${resolution.outcome}, message = ${resolution.message},
              device = ${device}, resolved_at = ${now}
            WHERE id = ${questionId} AND outcome IS NULL`;
          yield* sql`UPDATE threads SET state = 'Running'
            WHERE id = ${threadId} AND state = 'Attention'
              AND NOT EXISTS (SELECT 1 FROM questions WHERE thread_id = ${threadId} AND outcome IS NULL)`;
          yield* sql.afterCommit(changes.publish);
        }),
      );

    /** Whether the owner's words appear verbatim in the owner's messages that started the thread's current turn. */
    const isQuotedByOwner = (threadId: string, quote: string) =>
      Effect.gen(function* () {
        const words = quote.trim();
        if (words.length < 2) return false;
        const messages = yield* sql<{ text: string }>`
          SELECT m.text FROM messages m
          WHERE m.thread_id = ${threadId} AND m.sender_kind = 'user' AND m.delivered_turn_id = (
            SELECT t.id FROM turns t WHERE t.thread_id = ${threadId} ORDER BY t.started_at DESC, t.rowid DESC LIMIT 1)`;
        return messages.some((message) => message.text.includes(words));
      });

    const requestApproval = (threadId: string, request: ApprovalRequest) =>
      Effect.gen(function* () {
        const missionId = yield* missionOf(threadId);
        if (missionId === null) return { isAllowed: false, text: "Unknown thread." } satisfies Decision;
        const asked: Asked = {
          details: request.command,
          missionId,
          pattern: request.pattern,
          permission: request.permission,
          source: "Thread",
          summary: request.action,
          threadId,
        };
        if (request.quote !== null && (yield* isQuotedByOwner(threadId, request.quote))) {
          const resolution: Resolution = { message: `"${request.quote.trim()}"`, outcome: "AllowedByMessage" };
          yield* record(asked, resolution);
          yield* allowOnce(threadId, request.command);
          return { isAllowed: true, text: textOf(resolution) } satisfies Decision;
        }
        const covering = yield* findCoveringPermission(threadId, request.command);
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

    const answerPrompt = (threadId: string, toolName: string, input: unknown) =>
      Effect.gen(function* () {
        const target = targetOf(toolName, input);
        if (yield* takeAllowance(threadId, target)) return { isAllowed: true, text: "" } satisfies Decision;
        // The sandbox protects `.git`, so local git leaves it; at the default level it
        // counts as an edit inside the workspace and runs unasked (CHG-0032).
        if (toolName === "Bash" && isSandboxed && isLocalGit(target)) {
          const { approvalLevel } = yield* readSettings;
          if (approvalLevel === "RiskyOnly") return { isAllowed: true, text: "" } satisfies Decision;
        }
        const missionId = yield* missionOf(threadId);
        if (missionId === null) return { isAllowed: false, text: "Unknown thread." } satisfies Decision;
        const asked: Asked = {
          details: target,
          missionId,
          pattern: null,
          permission: null,
          source: "Harness",
          summary: summaryOf(toolName, input),
          threadId,
        };
        const covering = yield* findCoveringPermission(threadId, target);
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
        const deferred = waiting.get(questionId);
        // An open row without a waiter belongs to a turn that already ended.
        if (deferred === undefined) return yield* invalid("This question is no longer waiting.");
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
        yield* Deferred.succeed(deferred, resolution);
        const answered = yield* readQuestion(questionId);
        return answered ?? question;
      }).pipe(Effect.provideService(SqlClient.SqlClient, sql));

    const withdraw = (threadId: string) =>
      Effect.gen(function* () {
        const open = yield* sql<{
          id: string;
        }>`SELECT id FROM questions WHERE thread_id = ${threadId} AND outcome IS NULL`;
        const resolution: Resolution = { message: null, outcome: "Withdrawn" };
        for (const { id } of open) {
          yield* resolve(id, threadId, resolution, null);
          const deferred = waiting.get(id);
          if (deferred !== undefined) yield* Deferred.succeed(deferred, resolution);
        }
        allowances.delete(threadId);
      }).pipe(Effect.orDie);

    return {
      answer,
      answerPrompt: (threadId, toolName, input) =>
        answerPrompt(threadId, toolName, input).pipe(Effect.provideService(SqlClient.SqlClient, sql)),
      requestApproval: (threadId, request) =>
        requestApproval(threadId, request).pipe(Effect.provideService(SqlClient.SqlClient, sql)),
      withdraw,
    };
  }),
);
