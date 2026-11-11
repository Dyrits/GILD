import { join } from "node:path";
import { Clock, Context, Effect, FiberMap, FiberSet, Layer, Match, PubSub } from "effect";
import { SqlClient } from "effect/sql";
import {
  Changes,
  Endpoints,
  Harness,
  type HarnessEvent,
  type ImageAttachment,
  invalid,
  PriceTable,
  readSettings,
  type ServiceFailure,
} from "../core/index.ts";
import { removedAccountReasonOf, toolServerName } from "../harness/index.ts";
import { listThreadPermissions } from "../policy/index.ts";
import { Approvals } from "./approvals.ts";
import { AttachmentsRoot, type StoredAttachment } from "./attachments.ts";
import { fallBackToBackup, resetBackupStep } from "./backups.ts";
import { requireChatterDecision } from "./chatter.ts";
import { changed, makeCommands } from "./commands.ts";
import { readConversationSoFar } from "./handover.ts";
import { makeLifecycle, recoverThreadStates, releaseThread, resumeStopped, stopThread } from "./lifecycle.ts";
import { listPending, listThreadsWithPending } from "./messaging.ts";
import { fallBackAfterFailure } from "./rituals.ts";
import { prepareStartingContext } from "./startingContext.ts";
import { Suggestions } from "./suggestions.ts";
import { askOwnerFor } from "./threadToolHandlers.ts";
import { unaskedToolNamesOf } from "./threadTools.ts";
import {
  type Admitted,
  admitTurn,
  completeTurn,
  deliverSteered,
  isCurrentTurn,
  recordTurnFailure,
  saveTurnReply,
} from "./turns.ts";
import { ScratchRoot } from "./workspaces.ts";

/** Owns thread state and admits at most one turn per thread. */
export class Threads extends Context.Service<
  Threads,
  {
    /** Cancels turns already invalidated in a committed lifecycle change. */
    readonly cancel: (ids: ReadonlyArray<string>) => Effect.Effect<void>;
    /** Takes a thread waiting on its missing workspace folder out of Attention and starts its turn again. */
    readonly retry: (threadId: string) => Effect.Effect<void, ServiceFailure>;
    /** Continues a Stopped thread with the messages kept for it (thread-tree, Stopping). */
    readonly resume: (threadId: string) => Effect.Effect<void, ServiceFailure>;
    /**
     * Ends the thread's running turn and withdraws its open questions; the thread stays usable and its
     * undelivered messages start its next turn. False when no turn runs (thread-messaging, Interruptions).
     */
    readonly interrupt: (threadId: string) => Effect.Effect<boolean>;
    /** Ends the thread's current turn, withdraws its open questions, and marks it Stopped; threads beneath keep running. */
    readonly stop: (threadId: string) => Effect.Effect<void>;
    /**
     * Delivers the thread's undelivered messages: a running turn takes in those not queued (steering);
     * otherwise they start a turn.
     */
    readonly wake: (threadId: string) => Effect.Effect<void>;
    /** Once threads stopped outside a turn's end, wakes the mission's threads whose messages wait. */
    readonly wakeMission: (missionId: string) => Effect.Effect<void>;
  }
>()("gild/Threads") {}

/** Where each provider account added in Gild keeps its own folder (provider-accounts). */
export class AccountsRoot extends Context.Service<AccountsRoot, string>()("gild/AccountsRoot") {}

/** A turn the harness is running, with the steered messages already written to it. */
interface ActiveTurn {
  readonly turnId: string;
  readonly written: Set<string>;
}

/** Threads over the store and the harness adapters. */
export const threadsLayer = Layer.effect(
  Threads,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const harness = yield* Harness;
    const changes = yield* Changes;
    const scratchRoot = yield* ScratchRoot;
    const prices = yield* PriceTable;
    const accountsRoot = yield* AccountsRoot;
    const attachmentsRoot = yield* AttachmentsRoot;
    /** The stored files as a harness takes them: where each is kept. */
    const imagesOf = (files: ReadonlyArray<StoredAttachment>): ReadonlyArray<ImageAttachment> =>
      files.map((file) => ({ mediaType: file.mediaType, name: file.name, path: join(attachmentsRoot, file.file) }));
    const approvals = yield* Approvals;
    const suggestions = yield* Suggestions;
    /** Withdraws everything the thread waits on the owner for: questions and suggestions. */
    const withdrawAll = (threadId: string) =>
      approvals.withdraw(threadId).pipe(Effect.andThen(suggestions.withdraw(threadId)));
    const endpoints = yield* Endpoints;
    const services = Context.make(SqlClient.SqlClient, sql).pipe(
      Context.add(Changes, changes),
      Context.add(PriceTable, prices),
      Context.add(ScratchRoot, scratchRoot),
    );
    /** Runs a step over the store, the change feed, and the scratch root this layer was built with. */
    const local = <A, E>(step: Effect.Effect<A, E, SqlClient.SqlClient | Changes | PriceTable | ScratchRoot>) =>
      Effect.provideContext(step, services);
    const turns = yield* FiberMap.make<string>();
    // Wakes for other threads run here, outside any turn's fiber, which a later wake may replace.
    const background = yield* FiberSet.make();
    // Turns the harness is running, by thread, so messages can be steered into them.
    const active = new Map<string, ActiveTurn>();

    // Provisional recovery until the recovery decision is settled: a process that
    // ended mid-turn leaves no trustworthy Running state, and nothing is replayed.
    // With nothing running, no thread is left waiting on a thread beneath it.
    const startedAt = yield* Clock.currentTimeMillis;
    yield* sql`UPDATE turns SET status = 'interrupted', ended_at = ${startedAt} WHERE status = 'running'`;
    yield* recoverThreadStates;

    const isCurrent = (turnId: string) => local(isCurrentTurn(turnId));
    const draft = (threadId: string, text: string) => PubSub.publish(changes.drafts, { text, threadId });
    /** The failed turn's messages become undelivered again, so the next message retries them. */
    const fail = (threadId: string, turn: Admitted, reason: string) =>
      local(recordTurnFailure(threadId, turn, reason)).pipe(Effect.andThen(withdrawAll(threadId)));

    /**
     * Writes the thread's undelivered messages that are not queued into its running turn, each once.
     * Thread messages always steer; the owner's steer unless sent as Queue (CHG-0039).
     */
    const steerInto = (threadId: string, turn: ActiveTurn) =>
      Effect.gen(function* () {
        if (!(yield* isCurrent(turn.turnId))) return;
        const pending = yield* local(listPending(threadId, true));
        for (const message of pending) {
          if (!(yield* isCurrent(turn.turnId))) return;
          if (turn.written.has(message.id)) continue;
          turn.written.add(message.id);
          const text = message.text;
          // Not taken: the turn just ended, and the message starts the next one.
          if (!(yield* harness.steer(threadId, { id: message.id, images: imagesOf(message.attachments), text })))
            turn.written.delete(message.id);
        }
      }).pipe(Effect.orDie);

    /**
     * Once a turn ends or a thread stops, a running slot frees: wakes the mission's other threads whose
     * messages wait, in the background.
     */
    const wakeWaiting = (missionId: string, exceptThreadId: string) =>
      FiberSet.run(
        background,
        Effect.gen(function* () {
          const waiting = yield* local(listThreadsWithPending(missionId, exceptThreadId));
          for (const threadId of waiting) yield* wake(threadId);
        }).pipe(Effect.orDie),
      ).pipe(Effect.asVoid);

    const run = (threadId: string, turn: Admitted): Effect.Effect<void, unknown> =>
      Effect.gen(function* () {
        if (!(yield* isCurrent(turn.turnId))) return;
        const removed = yield* local(removedAccountReasonOf(turn));
        if (removed !== null) {
          yield* fail(threadId, turn, removed);
          return yield* wakeWaiting(turn.missionId, threadId);
        }
        const { approvalLevel, shouldStreamReplies } = yield* local(readSettings);
        const permissions = yield* local(listThreadPermissions(threadId));
        const { context, cwd, isInWorkspace, note } = yield* local(prepareStartingContext(threadId));
        // A session that starts with no memory of the thread, after a handover, is given its conversation.
        const history =
          turn.sessionId === null ? yield* local(readConversationSoFar(threadId, turn.turnId, turn.model)) : null;
        const mcpUrl = yield* endpoints.urlFor(threadId);
        const onEvent = (event: HarnessEvent) =>
          Match.valueTags(event, {
            Delivered: (delivered) => local(deliverSteered(turn, delivered.messageId)).pipe(Effect.orDie),
            Draft: (written) => (shouldStreamReplies ? draft(threadId, written.text).pipe(Effect.asVoid) : Effect.void),
            Reply: (reply) =>
              local(saveTurnReply(threadId, turn, reply.text, reply.model ?? null, reply.usage ?? null)).pipe(
                Effect.andThen(draft(threadId, "")),
                Effect.orDie,
              ),
          });
        if (!(yield* isCurrent(turn.turnId))) return;
        active.set(threadId, { turnId: turn.turnId, written: new Set() });
        const outcome = yield* harness
          .runTurn({
            access: {
              approvalLevel,
              isInWorkspace,
              mcpUrl,
              permissions: permissions.map((permission) => permission.sentence),
              unaskedTools: unaskedToolNamesOf(toolServerName),
            },
            askOwner: askOwnerFor(approvals, sql, threadId),
            configDirectory: turn.accountId === null ? null : join(accountsRoot, turn.accountId),
            context,
            cwd,
            effort: turn.effort,
            harness: turn.harness,
            images: imagesOf(turn.attachments),
            model: turn.model,
            note: history === null ? note : `${history}\n\n${note}`,
            onEvent,
            sessionId: turn.sessionId,
            text: turn.messages.join("\n\n"),
            threadId,
          })
          .pipe(
            Effect.result,
            // However the turn ends, what was allowed once in it is spent (action-approval, CHG-0063).
            Effect.ensuring(
              Effect.sync(() => active.delete(threadId)).pipe(Effect.andThen(approvals.endTurn(threadId))),
            ),
          );
        yield* draft(threadId, "");
        if (outcome._tag === "Failure") {
          yield* fail(threadId, turn, outcome.failure.reason);
          // A Ritual's run carries on with its next Companion, or fails once they are used up (rituals).
          yield* commands.run(fallBackAfterFailure(threadId, outcome.failure.reason)).pipe(Effect.orDie);
          // Any thread carries on with its next backup Companion, if it has one (thread-panel, Backups).
          yield* commands.run(fallBackToBackup(threadId, outcome.failure.reason)).pipe(Effect.orDie);
          return yield* wakeWaiting(turn.missionId, threadId);
        }
        const halted = yield* local(completeTurn(threadId, turn, outcome.success));
        yield* local(resetBackupStep(threadId));
        yield* cancel(halted.filter((id) => id !== threadId));
        yield* wakeWaiting(turn.missionId, threadId);
        // Messages that arrived during the turn start the next one, in this same fiber,
        // so the thread's entry in the fiber map always holds its current turn.
        const next = yield* local(admitTurn(threadId));
        if (next !== null) yield* run(threadId, next);
      });

    const wake = (threadId: string): Effect.Effect<void> =>
      Effect.suspend(() => {
        const running = active.get(threadId);
        if (running !== undefined) return steerInto(threadId, running);
        return local(admitTurn(threadId)).pipe(
          Effect.flatMap((turn) =>
            turn === null
              ? Effect.void
              : FiberMap.run(turns, threadId, run(threadId, turn).pipe(Effect.orDie)).pipe(Effect.asVoid),
          ),
          Effect.orDie,
        );
      });

    const interrupt = (threadId: string) =>
      Effect.gen(function* () {
        if (!active.has(threadId) || !(yield* harness.interrupt(threadId))) return false;
        // The turn's end, in its own fiber, sets the thread's state and starts its next turn.
        yield* withdrawAll(threadId);
        return true;
      });

    const { cancel } = makeLifecycle({
      cancelTurn: (id) => FiberMap.remove(turns, id),
      clearDraft: (id) => draft(id, "").pipe(Effect.asVoid),
      withdraw: withdrawAll,
    });
    const wakeMission = (missionId: string) => wakeWaiting(missionId, "");
    // Commands on a single thread; the service's own runner (commands.ts) is built over this layer.
    const commands = makeCommands({ publish: changes.publish, sql, threads: { cancel, wake, wakeMission } });

    const stop = (threadId: string) => commands.run(stopThread(threadId)).pipe(Effect.orDie);

    const resume = (threadId: string) =>
      commands
        .run(
          Effect.gen(function* () {
            const [thread] = yield* sql<{
              state: string;
            }>`SELECT state FROM threads WHERE id = ${threadId} AND is_deleting = 0`;
            if (thread?.state !== "Stopped") return yield* invalid("This thread is not stopped.");
            yield* local(requireChatterDecision(threadId));
            yield* local(resumeStopped(threadId));
            return changed(null, { threadsToWake: [threadId] });
          }),
        )
        .pipe(Effect.catchTag("SqlError", Effect.die));

    const retry = (threadId: string) =>
      commands
        .run(
          Effect.gen(function* () {
            const [thread] = yield* sql<{ blocker: string | null }>`SELECT blocker FROM threads WHERE id = ${threadId}`;
            if (thread?.blocker !== "MissingWorkspace")
              return yield* invalid("This thread is not waiting on its workspace folder.");
            yield* local(releaseThread(threadId));
            // Still missing: admit sends it back to Attention.
            return changed(null, { threadsToWake: [threadId] });
          }),
        )
        .pipe(Effect.catchTag("SqlError", Effect.die));

    return {
      cancel,
      interrupt,
      resume,
      retry,
      stop,
      wake,
      wakeMission,
    };
  }),
);
