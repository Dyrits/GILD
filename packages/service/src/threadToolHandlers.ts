import { Effect, Match } from "effect";
import { SqlClient } from "effect/sql";
import type { Approvals } from "./approvals.ts";
import type { Changes } from "./changes.ts";
import { countChatter } from "./chatter.ts";
import { intelToolsOf } from "./intelTools.ts";
import { journalToolsOf } from "./journalTools.ts";
import { insertMessage } from "./messaging.ts";
import type { Suggestions } from "./suggestions.ts";
import type { Threads } from "./threads.ts";
import { type ToolAnswer, type ToolHandlers, threadTools as toolCatalogue } from "./threadTools.ts";
import { titleToolsOf } from "./titles.ts";
import { isBeneath, isWithinReach, openThreadByAgent, reportResult } from "./tree.ts";

/** Answers every thread tool with its decoded arguments, through the modules that own each one. */
export const makeToolHandlers = (dependencies: {
  readonly approvals: Approvals["Service"];
  readonly changes: Changes["Service"];
  readonly sql: SqlClient.SqlClient;
  readonly suggestions: Suggestions["Service"];
  readonly threads: Threads["Service"];
}): ToolHandlers => {
  const { approvals, changes, sql, suggestions, threads } = dependencies;
  const commit = <A, E>(work: Effect.Effect<A, E, SqlClient.SqlClient>) =>
    sql
      .withTransaction(work.pipe(Effect.tap(() => sql.afterCommit(changes.publish))))
      .pipe(Effect.provideService(SqlClient.SqlClient, sql), Effect.orDie);

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
    open_thread: (threadId, { effort, model, request, title }) =>
      commit(openThreadByAgent(threadId, request, title ?? null, model ?? null, effort ?? null)).pipe(
        Effect.flatMap((outcome) =>
          Match.valueTags(outcome, {
            Opened: (opened) =>
              threads
                .wake(opened.threadId)
                .pipe(Effect.as(answer(`Opened thread ${opened.threadId}. Its result will come to you as a message.`))),
            Refused: (refused) => Effect.succeed(answer(refused.reason, true)),
          }),
        ),
      ),
    report_result: (threadId, { journal, result }) =>
      journal.trim() === ""
        ? Effect.succeed(toolCatalogue.report_result.invalid)
        : commit(reportResult(threadId, result, journal)).pipe(
            Effect.flatMap((parentId) =>
              parentId === null
                ? Effect.succeed(answer("Reported. You are the mission's top thread: the owner reads your replies."))
                : threads
                    .wake(parentId)
                    .pipe(Effect.as(answer("Reported to your parent. You are Done once this turn ends."))),
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
      commit(
        Effect.gen(function* () {
          if (!(yield* isWithinReach(threadId, to))) return null;
          yield* insertMessage({ fromThreadId: threadId, isQueued: false, isResult: false, text, threadId: to });
          return yield* countChatter(threadId, to);
        }),
      ).pipe(
        Effect.flatMap((paused) =>
          paused !== null
            ? threads
                .cancel(paused)
                .pipe(Effect.andThen(threads.wake(to)))
                .pipe(Effect.as(answer("Sent.")))
            : Effect.succeed(
                answer("Not sent: you can only message your parent or a thread directly beneath you, by its id.", true),
              ),
        ),
      ),
    suggest_mission: (threadId, args) =>
      suggestions.suggest(threadId, args).pipe(
        Effect.tap(({ threadToWake }) => (threadToWake === null ? Effect.void : threads.wake(threadToWake))),
        Effect.map(({ answer }) => answer),
      ),
  };
  return handlers;
};
