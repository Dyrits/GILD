import { describe, expect, it } from "@effect/vitest";
import { Deferred, Effect, Fiber } from "effect";
import { HarnessFailure, type TurnRequest } from "../../src/core/index.ts";
import {
  type HarnessConnection,
  type HarnessProtocol,
  makeHarnessProcesses,
  type PooledTurn,
  type TurnEnd,
} from "../../src/harness/harnessProcesses.ts";
import { turnRequestOf } from "../fixtures/turns.ts";

interface FakeConnection extends HarnessConnection {
  isClosed: boolean;
}

/** A fake protocol in-process: each turn runs `behavior`, and every started process is kept for checks. */
const fakeProtocolOf = (
  behavior: (turn: PooledTurn, request: TurnRequest) => Effect.Effect<TurnEnd, HarnessFailure> = () =>
    Effect.succeed({ isInterrupted: false, usage: null }),
) => {
  const connections: Array<FakeConnection> = [];
  const protocol: HarnessProtocol<FakeConnection> = {
    interrupt: () => Effect.succeed(true),
    restartKeyOf: (request) => request.model,
    runTurn: (_connection, request, turn) => behavior(turn, request),
    start: () =>
      Effect.sync(() => {
        const connection: FakeConnection = {
          close: () => {
            connection.isClosed = true;
          },
          hasExited: () => connection.isClosed,
          isClosed: false,
          sessionId: `session-${connections.length + 1}`,
        };
        connections.push(connection);
        return connection;
      }),
    steer: () => Effect.succeed(true),
  };
  return { connections, protocol };
};

const usage = { cacheCreation: 0, cacheRead: 0, input: 5, output: 1 };

describe("keeping a thread's harness process", () => {
  it.live("reuses the process while the restart key holds, and restarts it when the key changes", () =>
    Effect.gen(function* () {
      const { connections, protocol } = fakeProtocolOf();
      const pool = yield* makeHarnessProcesses(protocol, { idleTimeout: "10 minutes" });
      yield* pool.runTurn(turnRequestOf({ model: "haiku" }));
      yield* pool.runTurn(turnRequestOf({ model: "haiku" }));
      expect(connections).toHaveLength(1);
      yield* pool.runTurn(turnRequestOf({ model: "opus" }));
      expect(connections.map((connection) => connection.isClosed)).toEqual([true, false]);
    }).pipe(Effect.scoped),
  );

  it.live("closes an idle process, and starts another for the next turn", () =>
    Effect.gen(function* () {
      const { connections, protocol } = fakeProtocolOf();
      const pool = yield* makeHarnessProcesses(protocol, { idleTimeout: "20 millis" });
      yield* pool.runTurn(turnRequestOf());
      yield* Effect.sleep("100 millis");
      expect(connections[0]?.isClosed).toBe(true);
      yield* pool.runTurn(turnRequestOf());
      expect(connections).toHaveLength(2);
    }).pipe(Effect.scoped),
  );

  it.live("closes every process when its scope ends", () =>
    Effect.gen(function* () {
      const { connections, protocol } = fakeProtocolOf();
      yield* Effect.scoped(
        Effect.gen(function* () {
          const pool = yield* makeHarnessProcesses(protocol, { idleTimeout: "10 minutes" });
          yield* pool.runTurn(turnRequestOf());
        }),
      );
      expect(connections[0]?.isClosed).toBe(true);
    }),
  );
});

describe("interrupting and steering a pooled turn", () => {
  it.live("ends a turn whose interrupt the harness never confirms once the grace period passes", () =>
    Effect.gen(function* () {
      const running = yield* Deferred.make<void>();
      const { connections, protocol } = fakeProtocolOf((turn) =>
        Effect.gen(function* () {
          turn.reportUsage(usage);
          yield* Deferred.succeed(running, void 0);
          return yield* Effect.never;
        }),
      );
      const pool = yield* makeHarnessProcesses(protocol, { idleTimeout: "10 minutes", interruptGrace: "50 millis" });
      const turn = yield* Effect.forkChild(pool.runTurn(turnRequestOf()));
      yield* Deferred.await(running);
      expect(yield* pool.interrupt("thread-1")).toBe(true);
      const outcome = yield* Fiber.join(turn);
      expect(outcome).toEqual({ cost: null, isInterrupted: true, sessionId: "session-1", usage });
      expect(connections[0]?.isClosed).toBe(true);
      expect(yield* pool.interrupt("thread-1")).toBe(false);
    }).pipe(Effect.scoped),
  );

  it.live("counts an end the harness reports while interrupting as interrupted, keeping the process", () =>
    Effect.gen(function* () {
      const running = yield* Deferred.make<void>();
      const { connections, protocol } = fakeProtocolOf((turn) =>
        Effect.gen(function* () {
          yield* Deferred.succeed(running, void 0);
          while (!turn.isInterrupting()) yield* Effect.sleep("5 millis");
          return { isInterrupted: false, usage };
        }),
      );
      const pool = yield* makeHarnessProcesses(protocol, { idleTimeout: "10 minutes" });
      const turn = yield* Effect.forkChild(pool.runTurn(turnRequestOf()));
      yield* Deferred.await(running);
      yield* pool.interrupt("thread-1");
      expect((yield* Fiber.join(turn)).isInterrupted).toBe(true);
      expect(connections[0]?.isClosed).toBe(false);
    }).pipe(Effect.scoped),
  );

  it.live("closes the process when a steered message was not taken in by the turn's end", () =>
    Effect.gen(function* () {
      const running = yield* Deferred.make<void>();
      const release = yield* Deferred.make<void>();
      const { connections, protocol } = fakeProtocolOf((turn) =>
        Effect.gen(function* () {
          yield* Deferred.succeed(running, void 0);
          yield* Deferred.await(release);
          yield* turn.deliver("taken");
          return { isInterrupted: false, usage: null };
        }),
      );
      const delivered: Array<string> = [];
      const pool = yield* makeHarnessProcesses(protocol, { idleTimeout: "10 minutes" });
      const onEvent = (event: Parameters<TurnRequest["onEvent"]>[0]) =>
        Effect.sync(() => void (event._tag === "Delivered" && delivered.push(event.messageId)));

      const first = yield* Effect.forkChild(pool.runTurn(turnRequestOf({ onEvent })));
      yield* Deferred.await(running);
      expect(yield* pool.steer("thread-1", { id: "taken", images: [], text: "Also this" })).toBe(true);
      yield* Deferred.succeed(release, void 0);
      yield* Fiber.join(first);
      expect(delivered).toEqual(["taken"]);
      expect(connections[0]?.isClosed).toBe(false);

      const again = yield* Deferred.make<void>();
      const { connections: later, protocol: holding } = fakeProtocolOf(() =>
        Deferred.succeed(again, void 0).pipe(
          Effect.andThen(Effect.sleep("30 millis")),
          Effect.as({ isInterrupted: false, usage: null }),
        ),
      );
      const other = yield* makeHarnessProcesses(holding, { idleTimeout: "10 minutes" });
      const second = yield* Effect.forkChild(other.runTurn(turnRequestOf()));
      yield* Deferred.await(again);
      expect(yield* other.steer("thread-1", { id: "untaken", images: [], text: "Too late" })).toBe(true);
      yield* Fiber.join(second);
      expect(later[0]?.isClosed).toBe(true);
    }).pipe(Effect.scoped),
  );

  it.live("ends the turn with the failure of work run beside it, such as an unanswerable prompt", () =>
    Effect.gen(function* () {
      const { connections, protocol } = fakeProtocolOf((turn, request) =>
        Effect.gen(function* () {
          yield* turn.fork(request.askOwner({ input: { command: "git push" }, toolName: "Bash" }).pipe(Effect.asVoid));
          return yield* Effect.never;
        }),
      );
      const pool = yield* makeHarnessProcesses(protocol, { idleTimeout: "10 minutes" });
      const failure = yield* pool
        .runTurn(turnRequestOf({ askOwner: () => Effect.fail(new HarnessFailure({ reason: "No answer." })) }))
        .pipe(Effect.flip);
      expect(failure.reason).toBe("No answer.");
      expect(connections[0]?.isClosed).toBe(true);
    }).pipe(Effect.scoped),
  );
});
