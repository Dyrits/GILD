import type { Request } from "@openmission/contracts";
import { Context, type Duration, Effect, Layer } from "effect";
import { SqlClient, type SqlError } from "effect/sql";
import { Changes, changesLayer } from "./changes.ts";
import { invalid, ServiceFailure } from "./errors.ts";
import { fakeHarnessLayer } from "./execution.ts";
import { insertUserMessage } from "./messaging.ts";
import { insertMission, listMissions, readMission } from "./missions.ts";
import { storeLayer } from "./store.ts";
import { Threads, threadsLayer } from "./threads.ts";

/** The entry point shared by app commands and, later, MCP calls. */
export class Service extends Context.Service<
  Service,
  { readonly handle: (request: Request) => Effect.Effect<unknown, ServiceFailure> }
>()("openmission/Service") {}

const storageFailure = (error: SqlError.SqlError) =>
  new ServiceFailure({ kind: "ExecutionFailure", message: `Storage failed: ${error.message}` });

const nonBlank = (text: string): Effect.Effect<string, ServiceFailure> =>
  text.trim().length === 0 ? Effect.fail(invalid("The message is empty.")) : Effect.succeed(text);

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
          if (stored.requestTag !== tag)
            return yield* Effect.fail(invalid("This request identifier was used for another command."));
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
    const run: Effect.Effect<unknown, ServiceFailure | SqlError.SqlError, SqlClient.SqlClient> = (() => {
      switch (request._tag) {
        case "StartMission":
          return nonBlank(request.text).pipe(
            Effect.andThen((text) => once(request.requestId, request._tag, insertMission(text))),
            Effect.tap((started) => threads.wake(started.threadId)),
          );
        case "SendMessage":
          return nonBlank(request.text).pipe(
            Effect.andThen((text) => once(request.requestId, request._tag, insertUserMessage(request.threadId, text))),
            Effect.tap(() => threads.wake(request.threadId)),
          );
        case "ListMissions":
          return listMissions;
        case "ReadMission":
          return readMission(request.missionId);
      }
    })();
    return run.pipe(
      Effect.provideService(SqlClient.SqlClient, sql),
      Effect.catchTag("SqlError", (error) => Effect.fail(storageFailure(error))),
    );
  };

  return { handle };
});

export interface ServiceOptions {
  readonly filename: string;
  readonly replyDelay: Duration.Input;
}

/** The whole local service over one SQLite file, with the fake harness. */
export const serviceLayer = (options: ServiceOptions) => {
  const foundation = Layer.mergeAll(changesLayer, fakeHarnessLayer(options.replyDelay)).pipe(
    Layer.provideMerge(storeLayer(options.filename)),
  );
  return Layer.effect(Service, make).pipe(Layer.provideMerge(threadsLayer), Layer.provideMerge(foundation));
};
