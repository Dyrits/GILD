import { Context, Effect, Layer } from "effect";
import { SqlClient, type SqlError } from "effect/sql";
import { Changes } from "./changes.ts";
import { Threads } from "./threads.ts";

// A command is a domain operation and what must follow once its storage work commits. The operation
// only describes: it writes inside the transaction it is given and returns its follow-ups. The runner
// alone commits, announces, and applies them, so no caller can forget a wake or announce a rollback.

/** What a command leaves to do once its storage work has committed. */
export interface FollowUps {
  /** Whether state the owner sees changed, so open screens refetch. */
  readonly isChanged: boolean;
  /** Missions whose waiting threads may now run, a running slot having freed. */
  readonly missionsToWake: ReadonlyArray<string>;
  /** Threads with messages to deliver. */
  readonly threadsToWake: ReadonlyArray<string>;
  /** Threads whose turns the operation invalidated and that must now end. */
  readonly turnsToCancel: ReadonlyArray<string>;
}

/** A domain operation's value with its follow-ups. */
export interface WithFollowUps<A> {
  readonly followUps: FollowUps;
  readonly value: A;
}

/** The follow-ups of an operation that changed nothing the owner sees and leaves nothing to do. */
export const noFollowUps: FollowUps = { isChanged: false, missionsToWake: [], threadsToWake: [], turnsToCancel: [] };

type FurtherFollowUps = Partial<Omit<FollowUps, "isChanged">>;

/** A value whose operation changed what the owner sees, with any further follow-ups. */
export const changed = <A>(value: A, further: FurtherFollowUps = {}): WithFollowUps<A> => ({
  followUps: { ...noFollowUps, ...further, isChanged: true },
  value,
});

/** A value whose operation changed nothing the owner sees, with any further follow-ups. */
export const unchanged = <A>(value: A, further: FurtherFollowUps = {}): WithFollowUps<A> => ({
  followUps: { ...noFollowUps, ...further, isChanged: false },
  value,
});

/** Runs commands: one transaction, one announcement after commit, then cancels, then wakes. */
export interface CommandRunner {
  /**
   * Applies the follow-ups of an operation that commits on its own, as one that waits on the owner must,
   * in the same order as `run`.
   */
  readonly apply: (followUps: FollowUps) => Effect.Effect<void>;
  /**
   * Runs the operation in one transaction and returns its value. Only once it commits: announces the
   * change, cancels the turns, then wakes the threads and the missions. A failed transaction does none.
   */
  readonly run: <A, E, R>(
    operation: Effect.Effect<WithFollowUps<A>, E, R>,
  ) => Effect.Effect<A, E | SqlError.SqlError, Exclude<R, SqlClient.SqlClient>>;
}

/** A runner over the store, the change feed, and the threads' turns. */
export const makeCommands = (dependencies: {
  readonly sql: SqlClient.SqlClient;
  readonly publish: Effect.Effect<void>;
  readonly threads: Pick<Threads["Service"], "cancel" | "wake" | "wakeMission">;
}): CommandRunner => {
  const { publish, sql, threads } = dependencies;
  const apply = Effect.fn("applyFollowUps")(function* (followUps: FollowUps) {
    if (followUps.isChanged) yield* publish;
    // Cancelled before any wake, so a woken thread never races a turn that is still ending.
    if (followUps.turnsToCancel.length > 0) yield* threads.cancel(followUps.turnsToCancel);
    for (const id of followUps.threadsToWake) yield* threads.wake(id);
    for (const id of new Set(followUps.missionsToWake)) yield* threads.wakeMission(id);
  });
  const run = <A, E, R>(operation: Effect.Effect<WithFollowUps<A>, E, R>) =>
    sql.withTransaction(operation).pipe(
      Effect.provideService(SqlClient.SqlClient, sql),
      Effect.tap((done) => apply(done.followUps)),
      Effect.map((done) => done.value),
    );
  return { apply, run };
};

/** The runner every owner request and thread tool goes through. */
export class Commands extends Context.Service<Commands, CommandRunner>()("canopy/Commands") {}

/** The runner over the service's store, change feed, and threads. */
export const commandsLayer = Layer.effect(
  Commands,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const changes = yield* Changes;
    const threads = yield* Threads;
    return makeCommands({ publish: changes.publish, sql, threads });
  }),
);
