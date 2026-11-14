import { dirname, resolve as resolvePath } from "node:path";
import type { Answer, ApprovalLevel, Question, QuestionOutcome, QuestionSource } from "@iskios/contracts";
import { Clock, Context, Effect, Layer } from "effect";
import { SqlClient, type SqlError } from "effect/sql";
import { Changes, fieldOf, Harness, invalid, notFound, readSettings, type ServiceFailure } from "../core/index.ts";
import { folderEscapeOf, resolvedFolderOf, workspaceWorktreesOf } from "../harness/index.ts";
import {
  capabilities,
  consequences,
  findCoveringPermission,
  insertPermission,
  isUnaskedAt,
  needsOf,
  plainActionOf,
  readQuestion,
  reasonOf,
  targetOf,
} from "../policy/index.ts";
import { markPrompted } from "./activities.ts";
import { makeOwnerWaits } from "./attention.ts";
import { resumeInTurn } from "./lifecycle.ts";
import { readAuthorityHarness, readRunningTurnId } from "./turnAdmission.ts";
import { ScratchRoot, threadFolderOf } from "./workspaces.ts";

/** What a thread passes to `request_approval`: one action, said in plain language, with its exact target. */
export interface ApprovalRequest {
  /** One sentence: what the thread wants to do and why. */
  readonly action: string;
  /** The exact command, file, or target. */
  readonly command: string;
  /** Whether the owner is explicitly being asked to run this command without the sandbox. */
  readonly outsideSandbox?: boolean;
}

/** The question a harness asks before starting in a thread folder that is a link (harness/threadFolder.ts). */
export interface FolderQuestion {
  /** The folder found to be a link or to resolve outside its root. */
  readonly folder: string;
  readonly pointsTo: string;
  /** The real path the harness starts in when allowed, then counted as the thread's folder; null for none. */
  readonly startsIn: string | null;
  readonly summary: string;
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
    /**
     * Answers a harness's permission prompt: unasked inside an enforced sandbox, asked when it leaves the sandbox or
     * none protects the harness. `isOutsideSandbox` comes from the adapter, for a harness that asks only to leave it;
     * `isUnsandboxed`, for a thread its adapter runs without the sandbox it otherwise runs in.
     */
    readonly answerPrompt: (
      threadId: string,
      toolName: string,
      input: unknown,
      isOutsideSandbox?: boolean,
      isUnsandboxed?: boolean,
      /** The harness's id of the call, when it gives one: the call then shows once in the thread, as its action. */
      toolUseId?: string | null,
    ) => Effect.Effect<Decision>;
    readonly requestApproval: (threadId: string, request: ApprovalRequest) => Effect.Effect<Decision>;
    /**
     * Asks once, Allow or Deny, before a harness starts in a thread folder that is a link: never saves a standing
     * permission, and none answers it. Allowed with `startsIn`, the edit check counts that real path as the thread's
     * folder while the folder still points there.
     */
    readonly askAboutFolder: (threadId: string, question: FolderQuestion) => Effect.Effect<Decision>;
    /**
     * Asks once, Allow or Deny, about an exact structural action the service derived; never saves a command
     * allowance or standing permission.
     */
    readonly confirmAction: (threadId: string, summary: string, details: string) => Effect.Effect<Decision>;
    /** Records a structural action the service let run unasked, with its evidence, as a line in the thread. */
    readonly recordDecision: (
      threadId: string,
      summary: string,
      details: string,
      outcome: "AllowedByMessage" | "AllowedByPermission",
      evidence: string,
    ) => Effect.Effect<void>;
    /** Forgets the thread's one-time allowances: an approval lasts only the turn it was given in. */
    readonly endTurn: (threadId: string) => Effect.Effect<void>;
    readonly withdraw: (threadId: string) => Effect.Effect<void>;
  }
>()("iskios/Approvals") {}

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

// Shown to the thread after an approval. The approved command must run alone: anything chained to it no longer
// matches and asks again. An ordinary approval keeps the sandbox; only an escape the owner allowed leaves it.
const allowedText =
  "Allowed. Do exactly this action now, with nothing chained before or after it; run any other step separately. " +
  "Keep the command's sandbox protection; this answer does not grant an escape.";

const textOf = (resolution: Resolution, outsideSandbox = false) =>
  allowingOutcomes.includes(resolution.outcome)
    ? outsideSandbox
      ? "Allowed. Run exactly this command outside the sandbox once, with nothing added."
      : allowedText
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
    const harness = yield* Harness;
    const waits = makeOwnerWaits<Resolution>(sql, changes);
    const withdrawn: Resolution = { message: null, outcome: "Withdrawn" };
    // Targets approved through `request_approval` that the next matching harness prompt may run once.
    const allowances = new Map<
      string,
      Array<{ readonly target: string; readonly turnId: string; readonly outsideSandbox: boolean }>
    >();
    // The real path the owner last allowed a harness to start in, by thread, for a thread folder that is a link.
    const allowedFolders = new Map<string, string>();

    // Provisional until recovery is settled (work-in-progress, open questions): a
    // restart ends the harness process behind an open question, so it is withdrawn.
    const startedAt = yield* Clock.currentTimeMillis;
    yield* sql`UPDATE questions SET outcome = 'Withdrawn', resolved_at = ${startedAt} WHERE outcome IS NULL`;
    // The thread lifecycle returns the threads that waited on them to Idle (lifecycle.ts, recoverThreadStates).

    const missionOf = (threadId: string) =>
      sql<{ missionId: string }>`SELECT mission_id AS missionId FROM threads WHERE id = ${threadId}`.pipe(
        Effect.map(([row]) => row?.missionId ?? null),
      );

    const readTurnId = (threadId: string) =>
      readRunningTurnId(threadId).pipe(Effect.provideService(SqlClient.SqlClient, sql));

    const allowOnce = (threadId: string, target: string, turnId: string, outsideSandbox: boolean) =>
      Effect.sync(() =>
        allowances.set(threadId, [
          ...(allowances.get(threadId) ?? []),
          { outsideSandbox, target: target.trim(), turnId },
        ]),
      );

    const takeAllowance = (threadId: string, target: string, outsideSandbox: boolean) =>
      Effect.gen(function* () {
        const turnId = yield* readTurnId(threadId);
        const targets = allowances.get(threadId) ?? [];
        const index = targets.findIndex(
          (grant) =>
            grant.target === target.trim() && grant.turnId === turnId && grant.outsideSandbox === outsideSandbox,
        );
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

    const requestApproval = (threadId: string, request: ApprovalRequest) =>
      Effect.gen(function* () {
        const missionId = yield* missionOf(threadId);
        if (missionId === null) return { isAllowed: false, text: "Unknown thread." } satisfies Decision;
        const turnId = yield* readTurnId(threadId);
        if (turnId === null) return { isAllowed: false, text: "No running turn to approve." } satisfies Decision;
        const outsideSandbox = request.outsideSandbox ?? false;
        // The question names only what the service knows: the exact command, and whether it leaves the sandbox.
        const kind = outsideSandbox ? capabilities.outsideSandbox : null;
        const asked: Asked = {
          details: request.command,
          missionId,
          // Always allow saves this exact command, never a pattern the thread proposed.
          pattern: request.command.trim(),
          permission: kind ?? "Run this exact command",
          source: "Thread",
          summary: outsideSandbox ? `${request.action}. Run this exact command outside the sandbox.` : request.action,
          threadId,
        };
        const covering = yield* findCoveringPermission(threadId, request.command, kind);
        if (covering !== null) {
          const resolution: Resolution = { message: covering.sentence, outcome: "AllowedByPermission" };
          yield* record(asked, resolution);
          yield* allowOnce(threadId, request.command, turnId, outsideSandbox);
          return { isAllowed: true, text: textOf(resolution, outsideSandbox) } satisfies Decision;
        }
        const resolution = yield* ask(asked);
        const isAllowed = allowingOutcomes.includes(resolution.outcome) && (yield* readTurnId(threadId)) === turnId;
        if (isAllowed) yield* allowOnce(threadId, request.command, turnId, outsideSandbox);
        return { isAllowed, text: textOf(resolution, outsideSandbox) } satisfies Decision;
      }).pipe(Effect.orDie);

    /**
     * The folders a file change must lie in one of to count as inside the thread's: its own, unless it is a link or
     * resolves outside its root (harness/threadFolder.ts), together with the git worktrees git lists for the
     * workspace's repository (CHG-0273). A linked folder counts only as the real path the owner allowed a harness to
     * start in, while it still points there, with no worktrees; otherwise none, and every change asks.
     */
    const editFoldersOf = (threadId: string, folder: string) => {
      const isScratch = dirname(resolvePath(folder)) === resolvePath(scratchRoot);
      if (folderEscapeOf(folder, isScratch ? scratchRoot : folder, !isScratch) === null)
        return [folder, ...workspaceWorktreesOf(folder)];
      const allowed = allowedFolders.get(threadId);
      return allowed !== undefined && allowed === resolvedFolderOf(folder) ? [allowed] : [];
    };

    /**
     * What a harness action needs beyond its sandbox, or null when it is contained (CHG-0208): gathers the facts
     * Containment (policy/containment.ts) judges from, which the adapter reported and the store holds.
     */
    const capabilityOf = (
      threadId: string,
      level: ApprovalLevel,
      toolName: string,
      input: unknown,
      isEscape: boolean,
      isUnsandboxed: boolean,
    ) =>
      Effect.gen(function* () {
        const stored = yield* threadFolderOf(threadId).pipe(Effect.provideService(ScratchRoot, scratchRoot));
        const authority = yield* readAuthorityHarness(threadId).pipe(Effect.provideService(SqlClient.SqlClient, sql));
        return yield* needsOf({
          containment:
            authority === null ? "Unprotected" : (harness.containmentOf?.(authority, level) ?? "Unprotected"),
          editFolders: stored === null ? [] : editFoldersOf(threadId, stored),
          input,
          isEscape,
          isUnsandboxed,
          toolName,
        });
      });

    const answerPrompt = (
      threadId: string,
      toolName: string,
      input: unknown,
      isOutsideSandbox: boolean,
      isUnsandboxed: boolean,
    ) =>
      Effect.gen(function* () {
        // A prompt from a harness still exiting after Stop runs nothing and asks nobody.
        if ((yield* readTurnId(threadId)) === null)
          return { isAllowed: false, text: "This thread is not at work, so nothing runs." } satisfies Decision;
        const target = targetOf(toolName, input);
        const isEscape =
          isOutsideSandbox || (toolName === "Bash" && fieldOf(input, "dangerouslyDisableSandbox") === true);
        if (yield* takeAllowance(threadId, target, isEscape)) return { isAllowed: true, text: "" } satisfies Decision;
        const missionId = yield* missionOf(threadId);
        if (missionId === null) return { isAllowed: false, text: "Unknown thread." } satisfies Decision;
        const { approvalLevel } = yield* readSettings;
        const capability = yield* capabilityOf(threadId, approvalLevel, toolName, input, isEscape, isUnsandboxed);
        const reason = reasonOf(input);
        const plain = plainActionOf(toolName);
        // At the default level a contained action runs and leaves a line, whatever it does: the sandbox holds the
        // damage, and no command is judged by its words.
        if (isUnaskedAt(approvalLevel, capability)) {
          yield* record(
            {
              details: target,
              missionId,
              pattern: null,
              permission: null,
              source: "Harness",
              summary: `${reason ?? plain}.`,
              threadId,
            },
            { message: null, outcome: "AllowedAutomatically" },
          );
          return { isAllowed: true, text: "" } satisfies Decision;
        }
        const asked: Asked = {
          details: toolName === "Bash" ? target : `${target}\n${JSON.stringify(input, null, 2)}`,
          missionId,
          pattern: target,
          permission: capability ?? plain,
          source: "Harness",
          summary: capability === null ? `${reason ?? plain}.` : `${reason ?? plain}. ${consequences[capability]}`,
          threadId,
        };
        const covering = yield* findCoveringPermission(threadId, target, capability);
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
          if (question.pattern === null || question.permission === null)
            return yield* invalid("This action needs a one-time confirmation. Choose Allow or Deny.");
          yield* sql.withTransaction(insertPermission(question.threadId, question.permission, question.pattern.trim()));
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

    const askAboutFolder = (threadId: string, question: FolderQuestion) =>
      Effect.gen(function* () {
        const missionId = yield* missionOf(threadId);
        if (missionId === null) return { isAllowed: false, text: "Unknown thread." } satisfies Decision;
        // No pattern and no permission: Always allow is refused (`answer`), and no standing permission is looked up.
        const resolution = yield* ask({
          details: `${question.folder}\npoints to ${question.pointsTo}`,
          missionId,
          pattern: null,
          permission: null,
          source: "Harness",
          summary: `${question.summary}.`,
          threadId,
        });
        const isAllowed = resolution.outcome === "Allowed";
        if (isAllowed && question.startsIn !== null) allowedFolders.set(threadId, question.startsIn);
        else allowedFolders.delete(threadId);
        return { isAllowed, text: textOf(resolution) } satisfies Decision;
      }).pipe(Effect.provideService(SqlClient.SqlClient, sql), Effect.orDie);

    return {
      answer,
      answerPrompt: (threadId, toolName, input, isOutsideSandbox = false, isUnsandboxed = false, toolUseId = null) =>
        (toolUseId === null
          ? Effect.void
          : Clock.currentTimeMillis.pipe(
              Effect.flatMap((now) => markPrompted(threadId, toolUseId, now)),
              Effect.orDie,
            )
        ).pipe(
          Effect.andThen(answerPrompt(threadId, toolName, input, isOutsideSandbox, isUnsandboxed)),
          Effect.provideService(SqlClient.SqlClient, sql),
        ),
      askAboutFolder,
      confirmAction: (threadId, summary, details) =>
        Effect.gen(function* () {
          const missionId = yield* missionOf(threadId);
          if (missionId === null) return { isAllowed: false, text: "Unknown thread." };
          const resolution = yield* ask({
            details,
            missionId,
            pattern: null,
            permission: null,
            source: "Thread",
            summary,
            threadId,
          });
          return { isAllowed: resolution.outcome === "Allowed", text: textOf(resolution) };
        }).pipe(Effect.provideService(SqlClient.SqlClient, sql), Effect.orDie),
      endTurn: (threadId) => Effect.sync(() => allowances.delete(threadId)).pipe(Effect.asVoid),
      recordDecision: (threadId, summary, details, outcome, evidence) =>
        Effect.gen(function* () {
          const missionId = yield* missionOf(threadId);
          if (missionId === null) return;
          yield* record(
            { details, missionId, pattern: null, permission: null, source: "Thread", summary, threadId },
            { message: evidence, outcome },
          );
        }).pipe(Effect.orDie),
      requestApproval: (threadId, request) =>
        requestApproval(threadId, request).pipe(Effect.provideService(SqlClient.SqlClient, sql)),
      withdraw,
    };
  }),
);
