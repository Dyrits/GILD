import type { SuggestionOutcome } from "@canopy/contracts";
import { Effect, Match } from "effect";
import { SqlClient } from "effect/sql";
import type { Approvals } from "./approvals.ts";
import { countChatter } from "./chatter.ts";
import { type CommandRunner, changed, unchanged, type WithFollowUps } from "./commands.ts";
import { HarnessFailure, type HarnessPrompt, type PromptAnswer } from "./execution.ts";
import { intelToolsOf } from "./intelTools.ts";
import { journalToolsOf } from "./journalTools.ts";
import { insertMessage } from "./messaging.ts";
import type { Resolution, Suggested, Suggestions } from "./suggestions.ts";
import type { Threads } from "./threads.ts";
import { type ToolAnswer, type ToolHandlers, threadTools as toolCatalogue } from "./threadTools.ts";
import { titleToolsOf } from "./titles.ts";
import { isBeneath, isWithinReach, openThreadByAgent, refusedOf, reportResult } from "./tree.ts";

/** Why a thread may not call a thread tool now, or null: an unknown or deleting thread, or one the chatter guard paused. */
export const callerRefusalOf = (threadId: string, name: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [caller] = yield* sql<{
      blocker: string | null;
    }>`SELECT blocker FROM threads WHERE id = ${threadId} AND is_deleting = 0`;
    if (caller === undefined) return "Unknown thread.";
    if (caller.blocker === "Chatter" && name !== "send_thread_message" && name !== "report_result")
      return "Paused by the chatter guard. Wait for the owner.";
    return null;
  });

/**
 * A thread's ask-the-owner capability for its turn request: the answer `answer_prompt` gives Claude Code,
 * without MCP. A store that cannot answer fails the turn rather than leave the harness waiting.
 */
export const askOwnerFor =
  (approvals: Approvals["Service"], sql: SqlClient.SqlClient, threadId: string) => (prompt: HarnessPrompt) =>
    Effect.gen(function* () {
      const refusal = yield* callerRefusalOf(threadId, "answer_prompt");
      if (refusal !== null) return { isAllowed: false, text: refusal } satisfies PromptAnswer;
      const decision = yield* approvals.answerPrompt(threadId, prompt.toolName, prompt.input);
      return { isAllowed: decision.isAllowed, text: decision.text } satisfies PromptAnswer;
    }).pipe(
      Effect.provideService(SqlClient.SqlClient, sql),
      Effect.orDie,
      Effect.catchDefect((defect) =>
        Effect.fail(
          new HarnessFailure({
            reason: `Canopy could not ask about ${prompt.toolName}: ${defect instanceof Error ? defect.message : String(defect)}`,
          }),
        ),
      ),
    );

const carryOn = "Carry on as if that message had not been sent to you; do not answer it.";

/** What `suggest_mission` tells the thread for each way the owner resolved its suggestion. */
const resolutionTextOf = (resolution: Resolution) =>
  ({
    Continued: `The owner continued it in mission "${resolution.targetTitle}" (id ${resolution.targetMissionId}). ${carryOn}`,
    KeptAsAside: `The owner kept it as an aside beneath you: thread "${resolution.targetTitle}" (id ${resolution.targetThreadId}). It will message you what is relevant to the mission. ${carryOn}`,
    MovedToMission: `The owner opened it as a new mission "${resolution.targetTitle}" (id ${resolution.targetMissionId}). ${carryOn}`,
    Withdrawn: "Withdrawn: the turn that asked ended before the owner answered.",
  }) satisfies Record<SuggestionOutcome, string>;

/** What `suggest_mission` answers the thread. */
const suggestedAnswerOf = (suggested: Suggested): ToolAnswer =>
  Match.valueTags(suggested, {
    NotAsked: () => ({
      isError: true,
      text: "Not asked: this thread is not at work in a turn, so the owner was not asked.",
    }),
    OpenedWithoutAsking: ({ resolution }) => ({
      isError: false,
      text: `No mission fits, so Canopy opened it as a new mission "${resolution.targetTitle}" (id ${resolution.targetMissionId}), as the owner's settings ask. ${carryOn}`,
    }),
    Resolved: ({ resolution }) => ({
      isError: resolution.outcome === "Withdrawn",
      text: resolutionTextOf(resolution)[resolution.outcome],
    }),
    UnknownThread: () => ({ isError: true, text: "Unknown thread." }),
  });

/** Answers every thread tool with its decoded arguments, through the modules that own each one and the command runner. */
export const makeToolHandlers = (dependencies: {
  readonly approvals: Approvals["Service"];
  readonly commands: CommandRunner;
  readonly suggestions: Suggestions["Service"];
  readonly threads: Threads["Service"];
}): ToolHandlers => {
  const { approvals, commands, suggestions, threads } = dependencies;
  /**
   * Runs a tool's command. Every thread tool call that reaches the store announces a change, refused or
   * not, as it always has; the operation's other follow-ups apply as it returned them.
   */
  const runTool = <A, E>(operation: Effect.Effect<WithFollowUps<A>, E, SqlClient.SqlClient>) =>
    commands
      .run(Effect.map(operation, (done) => ({ ...done, followUps: { ...done.followUps, isChanged: true } })))
      .pipe(Effect.orDie);
  /** Runs a tool's storage work, which returns no follow-ups of its own. */
  const commit = <A, E>(work: Effect.Effect<A, E, SqlClient.SqlClient>) =>
    runTool(Effect.map(work, (value) => changed(value)));

  const answer = (text: string, isError = false): ToolAnswer => ({ isError, text });

  const handlers: ToolHandlers = {
    ...intelToolsOf(commit),
    ...journalToolsOf(commit),
    ...titleToolsOf(commit),
    answer_prompt: (threadId, { input, tool_name }) =>
      approvals
        .answerPrompt(threadId, tool_name, input)
        .pipe(
          Effect.map((decision) =>
            answer(
              JSON.stringify(
                decision.isAllowed
                  ? { behavior: "allow", updatedInput: input }
                  : { behavior: "deny", message: decision.text },
              ),
            ),
          ),
        ),
    find_missions: suggestions.findMissions,
    interrupt_thread: (threadId, { thread: target }) =>
      commit(isBeneath(threadId, target)).pipe(
        Effect.flatMap((isChild) =>
          isChild
            ? threads.interrupt(target)
            : Effect.fail("Not interrupted: you can only interrupt a thread directly beneath you, by its id."),
        ),
        Effect.flatMap((isInterrupted) =>
          isInterrupted
            ? Effect.succeed(answer("Interrupted."))
            : Effect.fail("Not interrupted: that thread is not running."),
        ),
        Effect.catch((reason: string) => Effect.succeed(answer(reason, true))),
      ),
    open_thread: (threadId, { effort, harness, model, request, title }) =>
      runTool(
        openThreadByAgent(threadId, request, title ?? null, {
          effort: effort ?? null,
          harness: harness ?? null,
          model: model ?? null,
        }).pipe(
          // A refused account comes back to the thread as a refusal.
          Effect.catchTag("ServiceFailure", (failure) => Effect.succeed(refusedOf(failure.message))),
        ),
      ).pipe(
        Effect.map((outcome) =>
          Match.valueTags(outcome, {
            Opened: (opened) => answer(`Opened thread ${opened.threadId}. Its result will come to you as a message.`),
            Refused: (refused) => answer(refused.reason, true),
          }),
        ),
      ),
    report_result: (threadId, { journal, result }) =>
      journal.trim() === ""
        ? Effect.succeed(toolCatalogue.report_result.invalid)
        : runTool(reportResult(threadId, result, journal)).pipe(
            Effect.map((parentId) =>
              parentId === null
                ? answer("Reported. You are the mission's top thread: the owner reads your replies.")
                : answer("Reported to your parent. You are Done once this turn ends."),
            ),
          ),
    request_approval: (threadId, given) =>
      approvals
        .requestApproval(threadId, {
          action: given.action,
          command: given.command,
          pattern: given.pattern ?? null,
          permission: given.permission ?? null,
          quote: given.quote ?? null,
        })
        .pipe(Effect.map((decision) => answer(decision.text, !decision.isAllowed))),
    send_thread_message: (threadId, { text, to }) =>
      runTool(
        Effect.gen(function* () {
          if (!(yield* isWithinReach(threadId, to))) return unchanged(false);
          yield* insertMessage({ fromThreadId: threadId, isQueued: false, isResult: false, text, threadId: to });
          // A pause the message set off ends both turns before the receiver is woken.
          return changed(true, { threadsToWake: [to], turnsToCancel: yield* countChatter(threadId, to) });
        }),
      ).pipe(
        Effect.map((isSent) =>
          isSent
            ? answer("Sent.")
            : answer("Not sent: you can only message your parent or a thread directly beneath you, by its id.", true),
        ),
      ),
    suggest_mission: (threadId, args) =>
      args.text.trim() === ""
        ? Effect.succeed(toolCatalogue.suggest_mission.invalid)
        : suggestions.suggest(threadId, args).pipe(
            Effect.tap(({ followUps }) => commands.apply(followUps)),
            Effect.map(({ value }) => suggestedAnswerOf(value)),
          ),
  };
  return handlers;
};
