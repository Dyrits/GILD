import type { BillingKind, TokenUsage } from "@iskios/contracts";
import { Deferred, Duration, Effect } from "effect";
import {
  type HarnessAdapter,
  type HarnessFailure,
  interruptedOutcomeOf,
  interruptGraceMillis,
  type SteeredMessage,
  type TurnOutcome,
  type TurnRequest,
} from "../core/index.ts";

// Each thread's harness process, kept between turns (CHG-0027): started or reused by the restart key its
// harness declares, closed when idle, when an interrupt goes unconfirmed, when a steered message was not
// taken in, and with the scope that made the pool. The harness's protocol only speaks to the process.

/** A thread's running harness process, as its protocol opened it. */
export interface HarnessConnection {
  readonly close: () => void;
  readonly hasExited: () => boolean;
  /** The harness's own conversation, which the thread's next turn continues. */
  readonly sessionId: string;
}

/** The pool's side of a running turn, which the protocol reads and reports to. */
export interface PooledTurn {
  /** Reports that the harness took in a steered message; a message not steered into this turn is ignored. */
  readonly deliver: (messageId: string) => Effect.Effect<void>;
  /** Runs work beside the turn, such as answering one of the harness's own requests; its failure ends the turn. */
  readonly fork: (work: Effect.Effect<void, HarnessFailure>) => Effect.Effect<void>;
  /** Whether the turn is being interrupted: an end the harness reports now counts as interrupted. */
  readonly isInterrupting: () => boolean;
  /** Records the usage reported so far, kept when an interrupt the harness never confirms ends the turn. */
  readonly reportUsage: (usage: TokenUsage | null) => void;
}

/** How a turn ended, as the harness reported it. */
export interface TurnEnd {
  /** How the turn was billed, when the harness reports its sign-in; absent counts as Unknown. */
  readonly billing?: BillingKind;
  /** What the thread's context held after the turn's latest model call; absent or null when unreported. */
  readonly context?: number | null;
  /** The turn's own cost in dollars when the harness reported one; absent or null counts its tokens. */
  readonly cost?: number | null;
  readonly isInterrupted: boolean;
  readonly usage: TokenUsage | null;
}

/** What one harness's protocol does with a process the pool keeps. */
export interface HarnessProtocol<Connection extends HarnessConnection> {
  /** Asks the harness to end the running turn; false when the turn cannot be interrupted yet. */
  readonly interrupt: (connection: Connection) => Effect.Effect<boolean>;
  /**
   * Everything the process starts with that a turn may change: model, effort where the harness takes it at
   * start, working folder, account folder, and access. A changed key restarts the process, continuing its
   * conversation.
   */
  readonly restartKeyOf: (request: TurnRequest) => string;
  /** Runs one turn on the process, reporting its events, until the harness ends it. */
  readonly runTurn: (
    connection: Connection,
    request: TurnRequest,
    turn: PooledTurn,
  ) => Effect.Effect<TurnEnd, HarnessFailure>;
  /** Starts the thread's process and opens or continues its conversation; a failure leaves no process. */
  readonly start: (request: TurnRequest) => Effect.Effect<Connection, HarnessFailure>;
  /** Writes a message into the running turn; false when the harness did not take it or takes none mid-turn. */
  readonly steer: (connection: Connection, message: SteeredMessage) => Effect.Effect<boolean>;
}

/** How long the pool keeps processes. */
export interface PoolOptions {
  /** How long an idle thread keeps its process. */
  readonly idleTimeout: Duration.Input;
  /** How long a harness has to end an interrupted turn; `interruptGraceMillis` by default. */
  readonly interruptGrace?: Duration.Input;
}

interface RunningTurn {
  readonly failed: Deferred.Deferred<never, HarnessFailure>;
  readonly interrupted: Deferred.Deferred<void>;
  isInterrupting: boolean;
  readonly onEvent: TurnRequest["onEvent"];
  /** Messages steered into the turn that the harness has not taken in yet. */
  readonly untaken: Set<string>;
  usage: TokenUsage | null;
}

interface Entry<Connection> {
  readonly connection: Connection;
  idleTimer: ReturnType<typeof setTimeout> | null;
  readonly key: string;
  turn: RunningTurn | null;
}

/** An adapter that runs each thread's turns on one kept process of the harness; its processes close with its scope. */
export const makeHarnessProcesses = <Connection extends HarnessConnection>(
  protocol: HarnessProtocol<Connection>,
  options: PoolOptions,
) =>
  Effect.gen(function* () {
    const entries = new Map<string, Entry<Connection>>();
    /** Threads whose turn has begun but whose process is not yet running it, with whether an interrupt came meanwhile. */
    const starting = new Map<string, { isInterrupted: boolean }>();
    const idleMillis = Duration.toMillis(Duration.fromInputUnsafe(options.idleTimeout));
    const grace = options.interruptGrace ?? interruptGraceMillis;

    const close = (threadId: string) => {
      const entry = entries.get(threadId);
      if (entry === undefined) return;
      entries.delete(threadId);
      if (entry.idleTimer !== null) clearTimeout(entry.idleTimer);
      entry.connection.close();
    };
    yield* Effect.addFinalizer(() => Effect.sync(() => [...entries.keys()].forEach(close)));

    const acquire = (request: TurnRequest) =>
      Effect.gen(function* () {
        const key = protocol.restartKeyOf(request);
        const existing = entries.get(request.threadId);
        if (existing !== undefined && (existing.key !== key || existing.connection.hasExited()))
          close(request.threadId);
        const kept = entries.get(request.threadId);
        if (kept !== undefined) {
          if (kept.idleTimer !== null) clearTimeout(kept.idleTimer);
          kept.idleTimer = null;
          return kept;
        }
        const entry: Entry<Connection> = {
          connection: yield* protocol.start(request),
          idleTimer: null,
          key,
          turn: null,
        };
        entries.set(request.threadId, entry);
        return entry;
      });

    const controlOf = (turn: RunningTurn): PooledTurn => ({
      deliver: (messageId) =>
        Effect.suspend(() =>
          turn.untaken.delete(messageId) ? turn.onEvent({ _tag: "Delivered", messageId }) : Effect.void,
        ),
      fork: (work) =>
        Effect.forkChild(work.pipe(Effect.catch((failure) => Deferred.fail(turn.failed, failure)))).pipe(Effect.asVoid),
      isInterrupting: () => turn.isInterrupting,
      reportUsage: (usage) => {
        turn.usage = usage;
      },
    });

    const runTurn = (request: TurnRequest) =>
      Effect.gen(function* () {
        const beginning = { isInterrupted: false };
        starting.set(request.threadId, beginning);
        const entry = yield* acquire(request).pipe(
          Effect.ensuring(Effect.sync(() => starting.delete(request.threadId))),
        );
        const { sessionId } = entry.connection;
        // An interrupt that came while the process started cancels the turn before its prompt is sent, which the
        // harness could not cancel yet; the process stays for the next turn.
        if (beginning.isInterrupted) {
          entry.idleTimer = setTimeout(() => close(request.threadId), idleMillis);
          return interruptedOutcomeOf(sessionId);
        }
        const turn: RunningTurn = {
          failed: yield* Deferred.make<never, HarnessFailure>(),
          interrupted: yield* Deferred.make<void>(),
          isInterrupting: false,
          onEvent: request.onEvent,
          untaken: new Set(),
          usage: null,
        };
        entry.turn = turn;
        // An interrupt the harness has not confirmed within the grace period ends the turn regardless.
        const unconfirmed = Deferred.await(turn.interrupted).pipe(
          Effect.andThen(Effect.sleep(grace)),
          Effect.as({ _tag: "Unconfirmed" } as const),
        );
        const ended = yield* Effect.raceFirst(
          protocol
            .runTurn(entry.connection, request, controlOf(turn))
            .pipe(Effect.map((end) => ({ _tag: "Ended", end }) as const)),
          Effect.raceFirst(unconfirmed, Deferred.await(turn.failed)),
        ).pipe(Effect.result, Effect.ensuring(Effect.sync(() => (entry.turn = null))));
        if (ended._tag === "Failure") {
          close(request.threadId);
          // A process that dies while interrupted still spent what its earlier prompts reported.
          if (turn.isInterrupting) return interruptedOutcomeOf(sessionId, turn.usage);
          return yield* ended.failure;
        }
        if (ended.success._tag === "Unconfirmed") {
          close(request.threadId);
          return interruptedOutcomeOf(sessionId, turn.usage);
        }
        // A steered message not yet taken in would start a turn of its own in this process, which nothing
        // reads: the process closes instead, and the message, still undelivered, starts the next turn
        // (CHG-0039, provisional).
        if (turn.untaken.size > 0) close(request.threadId);
        else entry.idleTimer = setTimeout(() => close(request.threadId), idleMillis);
        const { billing, context, cost, isInterrupted, usage } = ended.success.end;
        return {
          billing: billing ?? "Unknown",
          context: context ?? null,
          cost: cost ?? null,
          isInterrupted: isInterrupted || turn.isInterrupting,
          sessionId,
          usage,
        } satisfies TurnOutcome;
      }).pipe(Effect.onInterrupt(() => Effect.sync(() => close(request.threadId))));

    /** The thread's entry while a turn runs on a live process, or null. */
    const runningOf = (threadId: string) => {
      const entry = entries.get(threadId);
      return entry === undefined || entry.connection.hasExited() || entry.turn === null
        ? null
        : { connection: entry.connection, turn: entry.turn };
    };

    const steer = (threadId: string, message: SteeredMessage) =>
      Effect.gen(function* () {
        const running = runningOf(threadId);
        if (running === null || running.turn.isInterrupting) return false;
        running.turn.untaken.add(message.id);
        const isTaken = yield* protocol.steer(running.connection, message);
        if (!isTaken) running.turn.untaken.delete(message.id);
        return isTaken;
      });

    const interrupt = (threadId: string) =>
      Effect.gen(function* () {
        const running = runningOf(threadId);
        if (running === null) {
          const beginning = starting.get(threadId);
          if (beginning === undefined) return false;
          beginning.isInterrupted = true;
          return true;
        }
        if (running.turn.isInterrupting) return true;
        // Set first: the harness may confirm before the request's own effect returns.
        running.turn.isInterrupting = true;
        if (!(yield* protocol.interrupt(running.connection))) {
          running.turn.isInterrupting = false;
          return false;
        }
        yield* Deferred.succeed(running.turn.interrupted, void 0);
        return true;
      });

    // A harness reports no plan limits unless its adapter says how to ask (codex.ts).
    return { interrupt, readPlanLimits: () => Effect.succeed(null), runTurn, steer } satisfies HarnessAdapter;
  });
