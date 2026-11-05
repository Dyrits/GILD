import type { Request } from "@openmission/contracts";
import { Context, Effect, Layer, Match } from "effect";
import { SqlClient, type SqlError } from "effect/sql";
import { Changes, changesLayer } from "./changes.ts";
import { invalid, ServiceFailure } from "./errors.ts";
import type { Harness } from "./execution.ts";
import { insertUserMessage } from "./messaging.ts";
import { insertMission, listMissions, readMission } from "./missions.ts";
import { readSettings, writeSettings } from "./settings.ts";
import { storeLayer } from "./store.ts";
import { ScratchRoot, Threads, threadsLayer } from "./threads.ts";

/** The entry point shared by app commands and, later, MCP calls. */
export class Service extends Context.Service<
  Service,
  { readonly handle: (request: Request) => Effect.Effect<unknown, ServiceFailure> }
>()("openmission/Service") {}

const storageFailure = (error: SqlError.SqlError) =>
  new ServiceFailure({ kind: "ExecutionFailure", message: `Storage failed: ${error.message}` });

const nonBlank = (text: string): Effect.Effect<string, ServiceFailure> =>
  text.trim().length === 0 ? invalid("The message is empty.") : Effect.succeed(text);

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const threads = yield* Threads;
  const changes = yield* Changes;

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
        ListMissions: () => listMissions,
        ReadMission: (read) => readMission(read.missionId),
        ReadSettings: () => readSettings,
        SendMessage: (send) =>
          nonBlank(send.text).pipe(
            Effect.andThen((text) => once(send.requestId, send._tag, insertUserMessage(send.threadId, text))),
            Effect.tap(() => threads.wake(send.threadId)),
          ),
        StartMission: (start) =>
          nonBlank(start.text).pipe(
            Effect.andThen((text) => once(start.requestId, start._tag, insertMission(text, start.model, start.effort))),
            Effect.tap((started) => threads.wake(started.threadId)),
          ),
        UpdateSettings: (update) => writeSettings(update.settings).pipe(Effect.tap(() => changes.publish)),
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
  /** The folder holding each mission's scratch folder. */
  readonly scratchRoot: string;
}

/** The whole local service over one SQLite file. */
export const serviceLayer = (options: ServiceOptions) => {
  const foundation = Layer.mergeAll(
    changesLayer,
    options.harness,
    Layer.succeed(ScratchRoot, options.scratchRoot),
  ).pipe(Layer.provideMerge(storeLayer(options.filename)));
  return Layer.effect(Service, make).pipe(Layer.provideMerge(threadsLayer), Layer.provideMerge(foundation));
};
