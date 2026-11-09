import { dirname, join } from "node:path";
import type { Request } from "@gild/contracts";
import { Context, Effect, Layer, Match, Semaphore } from "effect";
import { SqlClient, type SqlError } from "effect/sql";
import { addAccount, listHarnesses, removeAccount, renameAccount, signInAccount } from "./accounts.ts";
import { Approvals, approvalsLayer } from "./approvals.ts";
import { budgetPeriodsLayer } from "./budgetPeriods.ts";
import { applyGlobalBudget, setMissionBudget, stopAtBudget } from "./budgets.ts";
import { readBudgetWindow } from "./budgetViews.ts";
import { changesLayer } from "./changes.ts";
import { resolveChatter } from "./chatter.ts";
import { Commands, changed, commandsLayer, type FollowUps, noFollowUps, type WithFollowUps } from "./commands.ts";
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
} from "./intelDecisions.ts";
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
import { listSkills } from "./skills.ts";
import { readStartingContext } from "./startingContext.ts";
import { storeLayer } from "./store.ts";
import { Suggestions, suggestionsLayer } from "./suggestions.ts";
import { readThreadPanel } from "./threadPanel.ts";
import { AccountsRoot, Threads, threadsLayer } from "./threads.ts";
import { renameMission } from "./titles.ts";
import { openThreadByOwner } from "./tree.ts";
import { ScratchRoot } from "./workspaces.ts";

/** The entry point shared by app commands and, later, MCP calls. */
export class Service extends Context.Service<
  Service,
  { readonly handle: (request: Request) => Effect.Effect<unknown, ServiceFailure> }
>()("gild/Service") {}

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
  const commands = yield* Commands;
  const approvals = yield* Approvals;
  const suggestions = yield* Suggestions;
  const problem = yield* sandboxProblem;
  const harnessTools = yield* HarnessTools;
  const accountsRoot = yield* AccountsRoot;
  /** Runs storage work as a command whose only follow-up is announcing the change. */
  const change = <A, E, R>(work: Effect.Effect<A, E, R>) => commands.run(Effect.map(work, (value) => changed(value)));
  /** Runs an account change, then lists the harnesses as they stand after it. */
  const thenListHarnesses = <A, R>(work: Effect.Effect<A, ServiceFailure | SqlError.SqlError, R>) =>
    change(work).pipe(
      Effect.andThen(listHarnesses),
      Effect.provideService(HarnessTools, harnessTools),
      Effect.provideService(AccountsRoot, accountsRoot),
    );
  const chatterDecisions = yield* Semaphore.make(1);

  /**
   * Runs an operation once per request identifier, in the command's transaction; a repeat returns the
   * stored outcome, announces nothing, and applies only `replayed`'s follow-ups.
   */
  const once = <A>(
    requestId: string,
    tag: string,
    work: Effect.Effect<WithFollowUps<A>, ServiceFailure | SqlError.SqlError, SqlClient.SqlClient>,
    replayed: (stored: A) => FollowUps = () => noFollowUps,
  ) =>
    Effect.gen(function* () {
      const [stored] = yield* sql<{ requestTag: string; outcome: string }>`
        SELECT request_tag AS requestTag, outcome FROM command_outcomes WHERE request_id = ${requestId}`;
      if (stored !== undefined) {
        if (stored.requestTag !== tag) return yield* invalid("This request identifier was used for another command.");
        const value = JSON.parse(stored.outcome) as A;
        return { followUps: replayed(value), value } satisfies WithFollowUps<A>;
      }
      const done = yield* work;
      yield* sql`INSERT INTO command_outcomes (request_id, request_tag, outcome)
        VALUES (${requestId}, ${tag}, ${JSON.stringify(done.value)})`;
      return { ...done, followUps: { ...done.followUps, isChanged: true } } satisfies WithFollowUps<A>;
    });

  /** A request's follow-ups that only wake one thread, as a repeated request still does. */
  const wakingOnly = (threadId: string): FollowUps => ({ ...noFollowUps, threadsToWake: [threadId] });

  const handle = (request: Request): Effect.Effect<unknown, ServiceFailure> => {
    // One handler per request tag; Match.valueTags fails to compile when a tag has none.
    const run: Effect.Effect<unknown, ServiceFailure | SqlError.SqlError, SqlClient.SqlClient> = Match.valueTags(
      request,
      {
        AddAccount: (add) => thenListHarnesses(addAccount(add.harness, add.label)),
        AddBrowsableRoot: (add) => change(addBrowsableRoot(add.path)),
        AddJournalEntry: (add) =>
          nonBlank(add.text).pipe(
            Effect.andThen((text) =>
              commands.run(
                once(
                  add.requestId,
                  add._tag,
                  updateJournal(add.missionId, { kind: "user" }, text, null).pipe(
                    Effect.flatMap((outcome) => ownerOutcomeOf(add.missionId, outcome)),
                    Effect.map((view) => changed(view)),
                  ),
                ),
              ),
            ),
          ),
        AnswerQuestion: (given) => approvals.answer(given.questionId, given.answer, given.message, "desktop"),
        AnswerSuggestion: (given) =>
          suggestions.answer(given.suggestionId, given.answer).pipe(
            Effect.tap(({ followUps }) => commands.apply(followUps)),
            Effect.map(({ value }) => value),
          ),
        BrowseFolders: (browse) => browseFolders(browse.path, browse.shouldIncludeHidden),
        CreateFolder: (create) => createFolder(create.parent, create.name),
        DeleteIntel: (given) => change(deleteIntelByOwner(given.intelId)),
        DeleteThread: (given) =>
          deleteThread(given.threadId, given.confirmation).pipe(
            Effect.provideService(ScratchRoot, scratchRoot),
            Effect.provideService(Commands, commands),
          ),
        DismissMissionPrompt: (given) => commands.run(dismissPrompt(given.missionId, given.prompt)),
        EditIntel: (given) => change(editIntelByOwner(given.intelId, given.text)),
        EndMission: (given) => commands.run(endMission(given.missionId, given.ending, given.snapshot)),
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
        ListSkills: (given) => listSkills(given.workspacePath),
        OpenThread: (open) =>
          nonBlank(open.text).pipe(
            Effect.andThen((text) =>
              commands.run(
                once(
                  open.requestId,
                  open._tag,
                  openThreadByOwner(
                    open.parentThreadId,
                    text,
                    { accountId: open.accountId, effort: open.effort, harness: open.harness, model: open.model },
                    open.shouldStartAnyway,
                  ).pipe(Effect.provideService(ScratchRoot, scratchRoot)),
                  (opened) => wakingOnly(opened.threadId),
                ),
              ),
            ),
          ),
        PinIntel: (given) => change(pinIntelByOwner(given.intelId, given.isPinned)),
        PreviewDeletion: (given) => previewDeletion(given.threadId),
        PreviewEnding: (given) => previewEnding(given.missionId, given.ending),
        PreviewStartingContext: (given) =>
          readStartingContext(
            given.parentThreadId,
            { harness: given.harness ?? null, model: given.model },
            given.text,
          ).pipe(Effect.provideService(ScratchRoot, scratchRoot)),
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
        ReadThreadPanel: (read) => readThreadPanel(read.threadId).pipe(Effect.provideService(ScratchRoot, scratchRoot)),
        RemoveAccount: (remove) => thenListHarnesses(removeAccount(remove.accountId)),
        RemovePermission: (remove) => change(removePermission(remove.permissionId)),
        RenameAccount: (rename) => thenListHarnesses(renameAccount(rename.accountId, rename.label)),
        RenameMission: (rename) => change(renameMission(rename.missionId, rename.title)),
        ReopenMission: (reopen) => commands.run(reopenMission(reopen.missionId)),
        ResolveChatter: (given) =>
          resolveChatter(given.id, given.choice).pipe(
            chatterDecisions.withPermit,
            Effect.provideService(Commands, commands),
          ),
        ResolveIntelChange: (given) => change(resolveIntelChange(given.changeId, given.isApproved)),
        ResolveIntelProposal: (given) => change(resolveIntelProposal(given.proposalId, given.isApproved)),
        RestoreIntel: (given) => change(restoreIntelByOwner(given.intelId)),
        ResumeThread: (resume) => threads.resume(resume.threadId).pipe(Effect.as(null)),
        RetryThread: (retry) => threads.retry(retry.threadId).pipe(Effect.as(null)),
        RewriteBriefing: (rewrite) => {
          const entry = rewrite.entry === null || rewrite.entry.trim() === "" ? "Rewrote the briefing" : rewrite.entry;
          return commands.run(
            once(
              rewrite.requestId,
              rewrite._tag,
              updateJournal(rewrite.missionId, { kind: "user" }, entry, {
                basedOn: rewrite.basedOn,
                briefing: rewrite.briefing,
              }).pipe(
                Effect.flatMap((outcome) => ownerOutcomeOf(rewrite.missionId, outcome)),
                Effect.map((view) => changed(view)),
              ),
            ),
          );
        },
        SendMessage: (send) =>
          Effect.gen(function* () {
            const text = yield* nonBlank(send.text);
            const delivery = send.delivery ?? (yield* readSettings).defaultDelivery;
            return yield* commands.run(
              once(
                send.requestId,
                send._tag,
                insertUserMessage(send.threadId, text, delivery === "Queue").pipe(
                  Effect.map((sent) => changed(sent, { threadsToWake: [send.threadId] })),
                ),
                () => wakingOnly(send.threadId),
              ),
            );
          }),
        SetMissionBudget: (given) => commands.run(setMissionBudget(given.missionId, given.limits)),
        SignInAccount: (given) =>
          signInAccount(given.harness, given.accountId).pipe(
            Effect.provideService(HarnessTools, harnessTools),
            Effect.provideService(AccountsRoot, accountsRoot),
            Effect.as(null),
          ),
        StartMission: (start) =>
          nonBlank(start.text).pipe(
            Effect.andThen((text) =>
              commands.run(
                once(
                  start.requestId,
                  start._tag,
                  insertMission(
                    text,
                    { accountId: start.accountId, effort: start.effort, harness: start.harness, model: start.model },
                    start.workspacePath,
                  ).pipe(Effect.map((started) => changed(started, { threadsToWake: [started.threadId] }))),
                  (started) => wakingOnly(started.threadId),
                ),
              ),
            ),
          ),
        StopAtBudget: (given) => commands.run(stopAtBudget(given.stopId)),
        StopThread: (stop) => threads.stop(stop.threadId).pipe(Effect.as(null)),
        UndoIntelChange: (given) => change(undoIntelChange(given.entryId)),
        UpdateSettings: (update) =>
          change(writeSettings(update.settings)).pipe(
            // A changed global budget stops work at its limit or releases the threads it held.
            Effect.tap(() => commands.run(applyGlobalBudget)),
          ),
        WidenPermission: (widen) => change(widenPermission(widen.permissionId)),
      },
    );
    return run.pipe(
      Effect.provideService(SqlClient.SqlClient, sql),
      Effect.catchTag("SqlError", (error) => storageFailure(error)),
    );
  };

  return { handle };
});

/** Where the service keeps its data and how it reaches the harnesses. */
export interface ServiceOptions {
  /** Where provider accounts added in Gild keep their folders; beside the database when left out. */
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
 * withdraws them; the command runner comes after Threads, which it wakes, and the tool server after the
 * runner, which it calls; Threads and the tool server meet at the endpoints.
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
    Layer.provideMerge(commandsLayer),
    Layer.provideMerge(running),
  );
};
