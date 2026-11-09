import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import type { MissionDetail } from "@gild/contracts";
import { Effect, Exit, Option } from "effect";
import { SqlClient } from "effect/sql";
import { afterEach } from "vitest";
import { setMissionBudget } from "../src/budgets.ts";
import { changed, makeCommands, noFollowUps, unchanged } from "../src/commands.ts";
import { stopThread } from "../src/lifecycle.ts";
import { storeLayer } from "../src/store.ts";
import { openThreadByAgent, reportResult } from "../src/tree.ts";
import { fixture, open, send, settle, start } from "./fixtures/service.ts";

const directories: Array<string> = [];
const fixtures: ReturnType<typeof fixture>[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
  for (const value of fixtures.splice(0)) value.remove();
});

/** A bare store in a temporary folder, with no threads behind it. */
const bareStore = () => {
  const directory = mkdtempSync(join(tmpdir(), "gild-commands-"));
  directories.push(directory);
  return storeLayer(join(directory, "store.sqlite"));
};

/** An isolated service, for operations that need missions and threads. */
const service = () => {
  const value = fixture();
  fixtures.push(value);
  return value.layer;
};

/** A runner whose announcements, cancels, and wakes are recorded with whether the write was then committed. */
const recordingRunner = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const calls: Array<string> = [];
  const note = (call: string) =>
    Effect.gen(function* () {
      const isInTransaction = Option.isSome(yield* Effect.serviceOption(sql.transactionService));
      const [row] = yield* sql<{ count: number }>`SELECT COUNT(*) AS count FROM browsable_roots`.pipe(Effect.orDie);
      calls.push(`${call}: ${isInTransaction ? "inside" : "after"} the transaction, ${row?.count ?? 0} row(s)`);
    });
  const commands = makeCommands({
    publish: note("publish"),
    sql,
    threads: {
      cancel: (ids) => note(`cancel ${ids.join(" ")}`),
      wake: (id) => note(`wake ${id}`),
      wakeMission: (id) => note(`wake mission ${id}`),
    },
  });
  return { calls, commands, sql };
});

const insertRoot = (sql: SqlClient.SqlClient) => sql`INSERT INTO browsable_roots (path, added_at) VALUES ('/a', 0)`;

const countRoots = (sql: SqlClient.SqlClient) =>
  sql<{ count: number }>`SELECT COUNT(*) AS count FROM browsable_roots`.pipe(Effect.map(([row]) => row?.count ?? 0));

describe("running a command", () => {
  it.effect("announces, cancels, then wakes threads and missions, all after the commit", () =>
    Effect.gen(function* () {
      const { calls, commands, sql } = yield* recordingRunner;
      const value = yield* commands.run(
        insertRoot(sql).pipe(
          Effect.as(
            changed("done", { missionsToWake: ["m1", "m1"], threadsToWake: ["t1", "t2"], turnsToCancel: ["a", "b"] }),
          ),
        ),
      );
      expect(value).toBe("done");
      expect(calls).toEqual([
        "publish: after the transaction, 1 row(s)",
        "cancel a b: after the transaction, 1 row(s)",
        "wake t1: after the transaction, 1 row(s)",
        "wake t2: after the transaction, 1 row(s)",
        "wake mission m1: after the transaction, 1 row(s)",
      ]);
    }).pipe(Effect.provide(bareStore())),
  );

  it.effect("announces nothing for an operation that changed nothing the owner sees", () =>
    Effect.gen(function* () {
      const { calls, commands } = yield* recordingRunner;
      yield* commands.run(Effect.succeed(unchanged(null, { threadsToWake: ["t1"] })));
      expect(calls).toEqual(["wake t1: after the transaction, 0 row(s)"]);
    }).pipe(Effect.provide(bareStore())),
  );

  it.effect("announces, cancels, and wakes nothing when the operation fails, and keeps none of its writes", () =>
    Effect.gen(function* () {
      const { calls, commands, sql } = yield* recordingRunner;
      const failed = yield* commands
        .run(
          insertRoot(sql).pipe(
            Effect.andThen(Effect.fail("refused")),
            Effect.as(changed(null, { missionsToWake: ["m1"], threadsToWake: ["t1"], turnsToCancel: ["a"] })),
          ),
        )
        .pipe(Effect.exit);
      expect(Exit.isFailure(failed)).toBe(true);
      expect(calls).toEqual([]);
      expect(yield* countRoots(sql)).toBe(0);
    }).pipe(Effect.provide(bareStore())),
  );

  it.effect("announces, cancels, and wakes nothing when the storage work itself fails", () =>
    Effect.gen(function* () {
      const { calls, commands, sql } = yield* recordingRunner;
      yield* insertRoot(sql);
      const failed = yield* commands
        .run(insertRoot(sql).pipe(Effect.as(changed(null, { threadsToWake: ["t1"] }))))
        .pipe(Effect.exit);
      expect(Exit.isFailure(failed)).toBe(true);
      expect(calls).toEqual([]);
      expect(yield* countRoots(sql)).toBe(1);
    }).pipe(Effect.provide(bareStore())),
  );

  it.effect("applies a self-committing operation's follow-ups in the same order", () =>
    Effect.gen(function* () {
      const { calls, commands } = yield* recordingRunner;
      yield* commands.apply({ ...noFollowUps, isChanged: true, threadsToWake: ["t1"], turnsToCancel: ["a"] });
      expect(calls).toEqual([
        "publish: after the transaction, 0 row(s)",
        "cancel a: after the transaction, 0 row(s)",
        "wake t1: after the transaction, 0 row(s)",
      ]);
    }).pipe(Effect.provide(bareStore())),
  );
});

const isIdle = (detail: MissionDetail) => detail.thread.state === "Idle";

describe("returning a command's follow-ups", () => {
  it.live("a reported result wakes the parent, and a top thread's wakes nothing", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const started = yield* start();
      yield* settle(started.missionId, isIdle);
      const child = yield* open(started.threadId);
      yield* settle(started.missionId, isIdle, child.threadId);
      const fromChild = yield* sql.withTransaction(reportResult(child.threadId, "Found it", "Nothing to record"));
      expect(fromChild).toEqual(changed(started.threadId, { threadsToWake: [started.threadId] }));
      const fromTop = yield* sql.withTransaction(reportResult(started.threadId, "Done", "Nothing to record"));
      expect(fromTop).toEqual(changed(null));
    }).pipe(Effect.provide(service())),
  );

  it.live("a thread opened by an agent is woken, and a refused one changes nothing", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const started = yield* start();
      yield* settle(started.missionId, isIdle);
      const choice = { effort: null, harness: null, model: null };
      const refused = yield* sql.withTransaction(openThreadByAgent(started.threadId, " ", null, choice));
      expect(refused).toEqual(unchanged({ _tag: "Refused", reason: "The request is empty." }));
      const opened = yield* sql.withTransaction(openThreadByAgent(started.threadId, "Look it up", null, choice));
      expect(opened.value._tag).toBe("Opened");
      const threadId = opened.value._tag === "Opened" ? opened.value.threadId : null;
      expect(opened.followUps).toEqual({ ...noFollowUps, isChanged: true, threadsToWake: [threadId] });
    }).pipe(Effect.provide(service())),
  );

  it.live("stopping a thread cancels its turn and wakes its mission, and an unknown thread is left alone", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const started = yield* start();
      yield* settle(started.missionId, isIdle);
      const stopped = yield* sql.withTransaction(stopThread(started.threadId));
      expect(stopped).toEqual(
        changed(null, { missionsToWake: [started.missionId], turnsToCancel: [started.threadId] }),
      );
      expect(yield* sql.withTransaction(stopThread("no-such-thread"))).toEqual(unchanged(null));
    }).pipe(Effect.provide(service())),
  );

  it.live("a mission budget reached holds its threads, and the budget removed returns them to wake", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const started = yield* start();
      yield* settle(started.missionId, isIdle);
      yield* send(started.threadId, "spend 1000");
      yield* settle(started.missionId, (detail) => isIdle(detail) && detail.mission.budget.spent.tokens >= 1000);
      const reached = yield* sql.withTransaction(setMissionBudget(started.missionId, { cost: null, tokens: 1 }));
      expect(reached).toEqual(changed(null));
      const removed = yield* sql.withTransaction(setMissionBudget(started.missionId, { cost: null, tokens: null }));
      expect(removed).toEqual(changed(null, { threadsToWake: [started.threadId] }));
    }).pipe(Effect.provide(service())),
  );
});
