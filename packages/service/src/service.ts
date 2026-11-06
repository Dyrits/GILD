import type { Request } from "@openmission/contracts";
import { Context, Effect, Layer, Match, Semaphore } from "effect";
import { SqlClient, type SqlError } from "effect/sql";
import { Approvals, approvalsLayer } from "./approvals.ts";
import { Changes, changesLayer } from "./changes.ts";
import { resolveChatter } from "./chatter.ts";
import { deleteThread, previewDeletion } from "./deleting.ts";
import { invalid, ServiceFailure } from "./errors.ts";
import type { Harness } from "./execution.ts";
import { addBrowsableRoot, browseFolders, createFolder, seedBrowsableRoots } from "./folders.ts";
import { type JournalOutcome, readJournalView, updateJournal } from "./journal.ts";
import { toolServerLayer } from "./mcp.ts";
import { insertUserMessage } from "./messaging.ts";
import { insertMission, listMissions, readMission } from "./missions.ts";
import { listPermissions, removePermission, widenPermission } from "./permissions.ts";
import { listOpenQuestions, listQuestionHistory } from "./questions.ts";
import { sandboxProblem } from "./sandbox.ts";
import { readSettings, writeSettings } from "./settings.ts";
import { storeLayer } from "./store.ts";
import { ScratchRoot, Threads, threadsLayer } from "./threads.ts";
import { openThreadByOwner } from "./tree.ts";
import { wakerLayer } from "./waker.ts";

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
  outcome._tag === "Recorded"
    ? readJournalView(missionId)
    : Effect.fail(
        new ServiceFailure({
          kind: outcome.reason === "Stale" ? "StaleVersion" : "InvalidInput",
          message:
            outcome.reason === "Stale"
              ? "The briefing changed since you started editing. Review the current briefing and try again."
              : outcome.text.replace("Not recorded: ", ""),
        }),
      );

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const threads = yield* Threads;
  const scratchRoot = yield* ScratchRoot;
  const changes = yield* Changes;
  const approvals = yield* Approvals;
  const problem = yield* sandboxProblem;
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

  const handle = (request: Request): Effect.Effect<unknown, ServiceFailure> => {
    // One handler per request tag; Match.valueTags fails to compile when a tag has none.
    const run: Effect.Effect<unknown, ServiceFailure | SqlError.SqlError, SqlClient.SqlClient> = Match.valueTags(
      request,
      {
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
        BrowseFolders: (browse) => browseFolders(browse.path, browse.shouldIncludeHidden),
        CreateFolder: (create) => createFolder(create.parent, create.name),
        DeleteThread: (given) =>
          deleteThread(given.threadId, given.confirmation).pipe(
            Effect.provideService(Threads, threads),
            Effect.provideService(ScratchRoot, scratchRoot),
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
        ListMissions: () => listMissions,
        ListOpenQuestions: () => listOpenQuestions,
        OpenThread: (open) =>
          nonBlank(open.text).pipe(
            Effect.andThen((text) =>
              once(open.requestId, open._tag, openThreadByOwner(open.parentThreadId, text, open.model, open.effort)),
            ),
            Effect.tap((opened) => threads.wake(opened.threadId)),
          ),
        PreviewDeletion: (given) => previewDeletion(given.threadId),
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
        RemovePermission: (remove) => removePermission(remove.permissionId).pipe(Effect.tap(() => changes.publish)),
        ResolveChatter: (given) =>
          resolveChatter(given.id, given.choice).pipe(
            chatterDecisions.withPermit,
            Effect.provideService(Threads, threads),
            Effect.provideService(Changes, changes),
          ),
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
        StartMission: (start) =>
          nonBlank(start.text).pipe(
            Effect.andThen((text) =>
              once(start.requestId, start._tag, insertMission(text, start.model, start.effort, start.workspacePath)),
            ),
            Effect.tap((started) => threads.wake(started.threadId)),
          ),
        StopThread: (stop) => threads.stop(stop.threadId).pipe(Effect.as(null)),
        UpdateSettings: (update) => writeSettings(update.settings).pipe(Effect.tap(() => changes.publish)),
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
  readonly filename: string;
  readonly harness: Layer.Layer<Harness>;
  /** The owner's home folder, the first browsable root (workspace-attachment). */
  readonly homeFolder: string;
  /** The folder holding each mission's scratch folder. */
  readonly scratchRoot: string;
}

/** The whole local service over one SQLite file. */
export const serviceLayer = (options: ServiceOptions) => {
  const foundation = Layer.mergeAll(
    changesLayer,
    wakerLayer,
    options.harness,
    Layer.succeed(ScratchRoot, options.scratchRoot),
  ).pipe(
    Layer.provideMerge(Layer.effectDiscard(seedBrowsableRoots(options.homeFolder))),
    Layer.provideMerge(storeLayer(options.filename)),
  );
  const tools = toolServerLayer.pipe(Layer.provideMerge(approvalsLayer), Layer.provideMerge(foundation));
  return Layer.effect(Service, make).pipe(Layer.provideMerge(threadsLayer), Layer.provideMerge(tools));
};
