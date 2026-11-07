import { dirname, join } from "node:path";
import type { Request } from "@openmission/contracts";
import { Context, Effect, Layer, Match, Semaphore } from "effect";
import { SqlClient, type SqlError } from "effect/sql";
import { addAccount, listHarnesses, removeAccount, renameAccount, signInAccount } from "./accounts.ts";
import { Approvals, approvalsLayer } from "./approvals.ts";
import { budgetPeriodsLayer } from "./budgetPeriods.ts";
import { applyGlobalBudget, setMissionBudget, stopAtBudget } from "./budgets.ts";
import { readBudgetWindow } from "./budgetViews.ts";
import { Changes, changesLayer } from "./changes.ts";
import { resolveChatter } from "./chatter.ts";
import { listMissions } from "./dashboard.ts";
import { deleteThread, previewDeletion } from "./deleting.ts";
import { autoArchiveLayer, dismissPrompt, endMission, previewEnding, reopenMission } from "./ending.ts";
import { endpointsLayer } from "./endpoints.ts";
import { invalid, ServiceFailure } from "./errors.ts";
import type { Harness } from "./execution.ts";
import { addBrowsableRoot, browseFolders, createFolder, seedBrowsableRoots } from "./folders.ts";
import { fakeHarnessToolsLayer, HarnessTools } from "./harnessTools.ts";
import {
  deleteIntelByOwner,
  editIntelByOwner,
  pinIntelByOwner,
  resolveIntelChange,
  restoreIntelByOwner,
} from "./intelChanges.ts";
import { readIntelHistory } from "./intelHistoryViews.ts";
import { resolveIntelProposal } from "./intelProposals.ts";
import { undoIntelChange } from "./intelUndo.ts";
import { readIntelView } from "./intelViews.ts";
import { type JournalOutcome, readJournalView, updateJournal } from "./journal.ts";
import { toolServerLayer } from "./mcp.ts";
import { insertUserMessage } from "./messaging.ts";
import { readMission } from "./missionDetail.ts";
import { insertMission } from "./missions.ts";
import { listPermissions, removePermission, widenPermission } from "./permissions.ts";
import { listOpenQuestions, listQuestionHistory } from "./questions.ts";
import { sandboxProblem } from "./sandbox.ts";
import { readSettings, readStartChoices, writeSettings } from "./settings.ts";
import { readStartingContext } from "./startingContext.ts";
import { storeLayer } from "./store.ts";
import { Suggestions, suggestionsLayer } from "./suggestions.ts";
import { AccountsRoot, ScratchRoot, Threads, threadsLayer } from "./threads.ts";
import { renameMission } from "./titles.ts";
import { openThreadByOwner } from "./tree.ts";

/** The entry point shared by app commands and, later, MCP calls. */
export class Service extends Context.Service<
  Service,
  { readonly handle: (request: Request) => Effect.Effect<unknown, ServiceFailure> }
>()("openmission/Service") {}

const storageFailure = (error: SqlError.SqlError) =>
  new ServiceFailure({ kind: "ExecutionFailure", message: `Storage failed: ${error.message}` });

const nonBlank = (text: string): Effect.Effect<string, ServiceFailure> =>
  text.trim().length === 0 ? invalid("The message is empty.") : Effect.succeed(text);

/** The owner's journal change as the app sees it: the updated journal, or the refusal as a service failure. */
const ownerOutcomeOf = (missionId: string, outcome: JournalOutcome) =>
  Match.valueTags(outcome, {
    Recorded: () => readJournalView(missionId),
    Refused: (refused) =>
      Effect.fail(
        new ServiceFailure({
          kind: refused.reason === "Stale" ? "StaleVersion" : "InvalidInput",
          message:
            refused.reason === "Stale"
              ? "The briefing changed since you started editing. Review the current briefing and try again."
              : refused.text.replace("Not recorded: ", ""),
        }),
      ),
  });

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const threads = yield* Threads;
  const scratchRoot = yield* ScratchRoot;
  const changes = yield* Changes;
  const approvals = yield* Approvals;
  const suggestions = yield* Suggestions;
  const problem = yield* sandboxProblem;
  const harnessTools = yield* HarnessTools;
  const accountsRoot = yield* AccountsRoot;
  /** Runs an account change, then lists the harnesses as they stand after it. */
  const thenListHarnesses = <A, R>(work: Effect.Effect<A, ServiceFailure | SqlError.SqlError, R>) =>
    work.pipe(
      Effect.tap(() => changes.publish),
      Effect.andThen(listHarnesses),
      Effect.provideService(HarnessTools, harnessTools),
      Effect.provideService(AccountsRoot, accountsRoot),
    );
  const chatterDecisions = yield* Semaphore.make(1);

  /** Runs a command once per request identifier; a repeat returns the stored outcome. */
  const once = <A>(
    requestId: string,
    tag: string,
    work: Effect.Effect<A, ServiceFailure | SqlError.SqlError, SqlClient.SqlClient>,
  ) =>
    sql.withTransaction(
      Effect.gen(function* () {
        const [stored] = yield* sql<{ requestTag: string; outcome: string }>`
          SELECT request_tag AS requestTag, outcome FROM command_outcomes WHERE request_id = ${requestId}`;
        if (stored !== undefined) {
          if (stored.requestTag !== tag) return yield* invalid("This request identifier was used for another command.");
          return JSON.parse(stored.outcome) as A;
        }
        const outcome = yield* work;
        yield* sql`INSERT INTO command_outcomes (request_id, request_tag, outcome)
          VALUES (${requestId}, ${tag}, ${JSON.stringify(outcome)})`;
        yield* sql.afterCommit(changes.publish);
        return outcome;
      }),
    );

  /** After a budget change: halted turns end, and released threads carry on with their kept messages. */
  const applyBudgetOutcome = (outcome: {
    readonly halted: ReadonlyArray<string>;
    readonly released: ReadonlyArray<string>;
  }) =>
    threads
      .cancel(outcome.halted)
      .pipe(
        Effect.andThen(changes.publish),
        Effect.andThen(Effect.forEach(outcome.released, (id) => threads.wake(id), { discard: true })),
      );

  const handle = (request: Request): Effect.Effect<unknown, ServiceFailure> => {
    // One handler per request tag; Match.valueTags fails to compile when a tag has none.
    const run: Effect.Effect<unknown, ServiceFailure | SqlError.SqlError, SqlClient.SqlClient> = Match.valueTags(
      request,
      {
        AddAccount: (add) => thenListHarnesses(addAccount(add.harness, add.label)),
        AddBrowsableRoot: (add) => addBrowsableRoot(add.path).pipe(Effect.tap(() => changes.publish)),
        AddJournalEntry: (add) =>
          nonBlank(add.text).pipe(
            Effect.andThen((text) =>
              once(
                add.requestId,
                add._tag,
                updateJournal(add.missionId, { kind: "user" }, text, null).pipe(
                  Effect.flatMap((outcome) => ownerOutcomeOf(add.missionId, outcome)),
                ),
              ),
            ),
          ),
        AnswerQuestion: (given) => approvals.answer(given.questionId, given.answer, given.message, "desktop"),
        AnswerSuggestion: (given) =>
          suggestions
            .answer(given.suggestionId, given.answer)
            .pipe(
              Effect.tap((answered) =>
                answered.targetThreadId === null ? Effect.void : threads.wake(answered.targetThreadId),
              ),
            ),
        BrowseFolders: (browse) => browseFolders(browse.path, browse.shouldIncludeHidden),
        CreateFolder: (create) => createFolder(create.parent, create.name),
        DeleteIntel: (given) =>
          sql.withTransaction(deleteIntelByOwner(given.intelId)).pipe(Effect.tap(() => changes.publish)),
        DeleteThread: (given) =>
          deleteThread(given.threadId, given.confirmation).pipe(
            Effect.provideService(Threads, threads),
            Effect.provideService(ScratchRoot, scratchRoot),
            Effect.provideService(Changes, changes),
          ),
        DismissMissionPrompt: (given) =>
          dismissPrompt(given.missionId, given.prompt).pipe(Effect.tap(() => changes.publish)),
        EditIntel: (given) =>
          sql.withTransaction(editIntelByOwner(given.intelId, given.text)).pipe(Effect.tap(() => changes.publish)),
        EndMission: (given) =>
          endMission(given.missionId, given.ending, given.snapshot).pipe(
            Effect.provideService(Threads, threads),
            Effect.provideService(Changes, changes),
          ),
        InterruptThread: (given) =>
          threads
            .interrupt(given.threadId)
            .pipe(
              Effect.flatMap((isInterrupted) =>
                isInterrupted ? Effect.succeed(null) : invalid("This thread is not running."),
              ),
            ),
        ListHarnesses: () =>
          listHarnesses.pipe(
            Effect.provideService(HarnessTools, harnessTools),
            Effect.provideService(AccountsRoot, accountsRoot),
          ),
        ListIntel: (list) => readIntelView(list.scope, list.state, list.threadId),
        ListMissions: (filters) => listMissions(filters),
        ListOpenQuestions: () => listOpenQuestions,
        OpenThread: (open) =>
          nonBlank(open.text).pipe(
            Effect.andThen((text) =>
              once(
                open.requestId,
                open._tag,
                openThreadByOwner(
                  open.parentThreadId,
                  text,
                  { accountId: open.accountId, effort: open.effort, harness: open.harness, model: open.model },
                  open.shouldStartAnyway,
                ),
              ),
            ),
            Effect.tap((opened) => threads.wake(opened.threadId)),
          ),
        PinIntel: (given) =>
          sql.withTransaction(pinIntelByOwner(given.intelId, given.isPinned)).pipe(Effect.tap(() => changes.publish)),
        PreviewDeletion: (given) => previewDeletion(given.threadId),
        PreviewEnding: (given) => previewEnding(given.missionId, given.ending),
        PreviewStartingContext: (given) => readStartingContext(given.parentThreadId, given.model, given.text),
        ReadBudget: (read) => readBudgetWindow(read.missionId),
        ReadIntelHistory: (read) => readIntelHistory(read.intelId),
        ReadJournal: (read) => readJournalView(read.missionId),
        ReadMission: (read) => readMission(read.missionId, read.threadId),
        ReadPermissions: (read) =>
          Effect.gen(function* () {
            const settings = yield* readSettings;
            return {
              history: yield* listQuestionHistory(read.missionId),
              level: settings.approvalLevel,
              permissions: yield* listPermissions,
              sandboxProblem: problem,
            };
          }),
        ReadSettings: () => readSettings,
        ReadStartChoices: () => readStartChoices,
        RemoveAccount: (remove) => thenListHarnesses(removeAccount(remove.accountId)),
        RemovePermission: (remove) => removePermission(remove.permissionId).pipe(Effect.tap(() => changes.publish)),
        RenameAccount: (rename) => thenListHarnesses(renameAccount(rename.accountId, rename.label)),
        RenameMission: (rename) =>
          sql.withTransaction(renameMission(rename.missionId, rename.title)).pipe(Effect.tap(() => changes.publish)),
        ReopenMission: (reopen) =>
          sql.withTransaction(reopenMission(reopen.missionId)).pipe(Effect.tap(() => changes.publish)),
        ResolveChatter: (given) =>
          resolveChatter(given.id, given.choice, threads).pipe(
            chatterDecisions.withPermit,
            Effect.provideService(Threads, threads),
            Effect.provideService(Changes, changes),
          ),
        ResolveIntelChange: (given) =>
          sql
            .withTransaction(resolveIntelChange(given.changeId, given.isApproved))
            .pipe(Effect.tap(() => changes.publish)),
        ResolveIntelProposal: (given) =>
          sql
            .withTransaction(resolveIntelProposal(given.proposalId, given.isApproved))
            .pipe(Effect.tap(() => changes.publish)),
        RestoreIntel: (given) =>
          sql.withTransaction(restoreIntelByOwner(given.intelId)).pipe(Effect.tap(() => changes.publish)),
        ResumeThread: (resume) => threads.resume(resume.threadId).pipe(Effect.as(null)),
        RetryThread: (retry) => threads.retry(retry.threadId).pipe(Effect.as(null)),
        RewriteBriefing: (rewrite) => {
          const entry = rewrite.entry === null || rewrite.entry.trim() === "" ? "Rewrote the briefing" : rewrite.entry;
          return once(
            rewrite.requestId,
            rewrite._tag,
            updateJournal(rewrite.missionId, { kind: "user" }, entry, {
              basedOn: rewrite.basedOn,
              briefing: rewrite.briefing,
            }).pipe(Effect.flatMap((outcome) => ownerOutcomeOf(rewrite.missionId, outcome))),
          );
        },
        SendMessage: (send) =>
          Effect.gen(function* () {
            const text = yield* nonBlank(send.text);
            const delivery = send.delivery ?? (yield* readSettings).defaultDelivery;
            return yield* once(send.requestId, send._tag, insertUserMessage(send.threadId, text, delivery === "Queue"));
          }).pipe(Effect.tap(() => threads.wake(send.threadId))),
        SetMissionBudget: (given) =>
          sql
            .withTransaction(
              setMissionBudget(given.missionId, given.limits).pipe(Effect.tap(() => sql.afterCommit(changes.publish))),
            )
            .pipe(Effect.tap(applyBudgetOutcome), Effect.as(null)),
        SignInAccount: (given) =>
          signInAccount(given.harness, given.accountId).pipe(
            Effect.provideService(HarnessTools, harnessTools),
            Effect.provideService(AccountsRoot, accountsRoot),
            Effect.as(null),
          ),
        StartMission: (start) =>
          nonBlank(start.text).pipe(
            Effect.andThen((text) =>
              once(
                start.requestId,
                start._tag,
                insertMission(
                  text,
                  { accountId: start.accountId, effort: start.effort, harness: start.harness, model: start.model },
                  start.workspacePath,
                ),
              ),
            ),
            Effect.tap((started) => threads.wake(started.threadId)),
          ),
        StopAtBudget: (given) =>
          sql.withTransaction(stopAtBudget(given.stopId)).pipe(
            Effect.tap(() => changes.publish),
            Effect.tap((missions) => Effect.forEach(missions, threads.wakeMission, { discard: true })),
            Effect.as(null),
          ),
        StopThread: (stop) => threads.stop(stop.threadId).pipe(Effect.as(null)),
        UndoIntelChange: (given) =>
          sql.withTransaction(undoIntelChange(given.entryId)).pipe(Effect.tap(() => changes.publish)),
        UpdateSettings: (update) =>
          sql
            .withTransaction(writeSettings(update.settings).pipe(Effect.tap(() => sql.afterCommit(changes.publish))))
            .pipe(
              // A changed global budget stops work at its limit or releases the threads it held.
              Effect.tap(() => sql.withTransaction(applyGlobalBudget).pipe(Effect.tap(applyBudgetOutcome))),
            ),
        WidenPermission: (widen) => widenPermission(widen.permissionId).pipe(Effect.tap(() => changes.publish)),
      },
    );
    return run.pipe(
      Effect.provideService(SqlClient.SqlClient, sql),
      Effect.catchTag("SqlError", (error) => storageFailure(error)),
    );
  };

  return { handle };
});

export interface ServiceOptions {
  /** Where provider accounts added in OpenMission keep their folders; beside the database when left out. */
  readonly accountsRoot?: string;
  readonly filename: string;
  readonly harness: Layer.Layer<Harness>;
  /** The harnesses' own tools for sign-ins and models; every harness signed in, for checks, when left out. */
  readonly harnessTools?: Layer.Layer<HarnessTools>;
  /** The owner's home folder, the first browsable root (workspace-attachment). */
  readonly homeFolder: string;
  /** The folder holding each mission's scratch folder. */
  readonly scratchRoot: string;
}

/**
 * The whole local service over one SQLite file. Approvals and suggestions come before Threads, which
 * withdraws them; the tool server comes after Threads, which it calls, and both meet at the endpoints.
 */
export const serviceLayer = (options: ServiceOptions) => {
  const foundation = Layer.mergeAll(
    changesLayer,
    endpointsLayer,
    options.harness,
    options.harnessTools ?? fakeHarnessToolsLayer(),
    Layer.succeed(ScratchRoot, options.scratchRoot),
    Layer.succeed(AccountsRoot, options.accountsRoot ?? join(dirname(options.filename), "accounts")),
  ).pipe(
    Layer.provideMerge(Layer.effectDiscard(seedBrowsableRoots(options.homeFolder))),
    Layer.provideMerge(storeLayer(options.filename)),
  );
  const running = threadsLayer.pipe(
    Layer.provideMerge(Layer.mergeAll(approvalsLayer, suggestionsLayer)),
    Layer.provideMerge(foundation),
  );
  return Layer.effect(Service, make).pipe(
    Layer.provideMerge(Layer.mergeAll(autoArchiveLayer, budgetPeriodsLayer, toolServerLayer)),
    Layer.provideMerge(running),
  );
};
