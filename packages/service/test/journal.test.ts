import { describe, expect, it } from "@effect/vitest";
import type { MissionId, ThreadId } from "@openmission/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { afterEach } from "vitest";
import { call, fixture, open, read, send, settle, start, tool } from "./fixtures/batch7.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
const live = () => {
  const value = fixture();
  fixtures.push(value);
  return value.layer;
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

const journal = (missionId: MissionId) => call({ _tag: "ReadJournal", missionId });
const record = (threadId: ThreadId, args: object) => tool(threadId, "update_journal", args);
/** A mission whose top thread has finished its first turn. */
const idle = (text = "Hello") =>
  Effect.gen(function* () {
    const started = yield* start(text);
    yield* settle(started.missionId, (d) => d.thread.state === "Idle");
    return started;
  });
/** The starting context a new thread beneath `parentId` receives, as the fake harness echoes it. */
const contextOfChild = (missionId: MissionId, parentId: ThreadId) =>
  Effect.gen(function* () {
    const child = yield* open(parentId, "context");
    const detail = yield* settle(missionId, (d) => d.messages.some((m) => m.sender === "agent"), child.threadId);
    return detail.messages.find((m) => m.sender === "agent")?.text ?? "";
  });

describe("keeping a mission's journal", () => {
  it.live("creates an empty journal with each mission", () =>
    Effect.gen(function* () {
      const { missionId } = yield* idle();
      const view = yield* journal(missionId);
      expect(view).toMatchObject({ briefing: "", briefingTokens: 0, entries: [], limit: 2000, version: 0 });
    }).pipe(Effect.provide(live())),
  );

  it.live("adds a thread's entry with its author and time", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle("Plan the release");
      const answer = yield* record(threadId, { entry: "Chose SQLite for storage." });
      expect(answer).toContain("Recorded entry 1");
      const [entry] = (yield* journal(missionId)).entries;
      expect(entry).toMatchObject({
        authorKind: "thread",
        authorTitle: "Plan the release",
        number: 1,
        text: "Chose SQLite for storage.",
      });
      expect(entry?.writtenAt).toBeGreaterThan(0);
    }).pipe(Effect.provide(live())),
  );

  it.live("rewrites the briefing with its entry and a new version", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      const answer = yield* record(threadId, {
        basedOn: 0,
        briefing: "Storage is SQLite.",
        entry: "Settled storage.",
      });
      expect(answer).toContain("version 1");
      const view = yield* journal(missionId);
      expect(view).toMatchObject({ briefing: "Storage is SQLite.", briefingTokens: 5, version: 1 });
      expect(view.entries.map((e) => e.text)).toEqual(["Settled storage."]);
    }).pipe(Effect.provide(live())),
  );

  it.live("refuses an update without an entry", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      const answer = yield* record(threadId, { basedOn: 0, briefing: "No entry with it.", entry: " " });
      expect(answer).toContain("entry");
      expect((yield* journal(missionId)).version).toBe(0);
    }).pipe(Effect.provide(live())),
  );

  it.live("refuses a briefing over the limit with its reason", () =>
    Effect.gen(function* () {
      const settings = yield* call({ _tag: "ReadSettings" });
      yield* call({ _tag: "UpdateSettings", settings: { ...settings, briefingLimit: 10 } });
      const { missionId, threadId } = yield* idle();
      const answer = yield* record(threadId, { basedOn: 0, briefing: "x".repeat(41), entry: "Too long." });
      expect(answer).toContain("11 tokens");
      expect(answer).toContain("limit of 10");
      const view = yield* journal(missionId);
      expect(view).toMatchObject({ briefing: "", entries: [], version: 0 });
      yield* record(threadId, { basedOn: 0, briefing: "x".repeat(40), entry: "Fits." });
      expect((yield* journal(missionId)).version).toBe(1);
    }).pipe(Effect.provide(live())),
  );

  it.live("refuses a stale rewrite with the current briefing, then accepts the merged one", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      const child = yield* open(threadId, "Hello");
      yield* settle(missionId, (d) => d.thread.state === "Idle", child.threadId);
      yield* record(threadId, { basedOn: 0, briefing: "Storage is SQLite.", entry: "Settled storage." });
      const refused = yield* record(child.threadId, { basedOn: 0, briefing: "The UI is React.", entry: "UI." });
      expect(refused).toContain("version 1");
      expect(refused).toContain("Storage is SQLite.");
      expect((yield* journal(missionId)).briefing).toBe("Storage is SQLite.");
      const missing = yield* record(child.threadId, { briefing: "No version.", entry: "UI." });
      expect(missing).toContain("basedOn");
      yield* record(child.threadId, {
        basedOn: 1,
        briefing: "Storage is SQLite. The UI is React.",
        entry: "Settled the UI.",
      });
      const view = yield* journal(missionId);
      expect(view).toMatchObject({ briefing: "Storage is SQLite. The UI is React.", version: 2 });
      expect(view.entries).toHaveLength(2);
    }).pipe(Effect.provide(live())),
  );

  it.live("reads the latest entries, and older ones from a starting point", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      for (let i = 1; i <= 25; i++) yield* record(threadId, { entry: `Entry ${i}` });
      const latest = yield* tool(threadId, "read_journal", {});
      expect(latest).toContain("Entry 25");
      expect(latest).toContain("Entry 6");
      expect(latest).not.toContain("Entry 5\n");
      expect(latest).toContain("version 0");
      const older = yield* tool(threadId, "read_journal", { before: 6, count: 3 });
      expect(older).toContain("Entry 3");
      expect(older).toContain("Entry 5");
      expect(older).not.toContain("Entry 2\n");
      expect(older).not.toContain("Entry 6");
    }).pipe(Effect.provide(live())),
  );

  it.live("refuses a result without a journal entry and records one given with it", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      const child = yield* open(threadId, "Hello");
      yield* settle(missionId, (d) => d.thread.state === "Idle", child.threadId);
      const refused = yield* tool(child.threadId, "report_result", { result: "Done." });
      expect(refused).toContain("journal");
      expect((yield* read(missionId)).messages.some((m) => m.isResult)).toBe(false);
      yield* tool(child.threadId, "report_result", { journal: "Counted 42 files.", result: "42 files." });
      const view = yield* journal(missionId);
      expect(view.entries.map((e) => [e.authorTitle, e.text])).toEqual([["Hello", "Counted 42 files."]]);
      const other = yield* open(threadId, "Hello");
      yield* settle(missionId, (d) => d.thread.state === "Idle", other.threadId);
      yield* tool(other.threadId, "report_result", { journal: "Nothing to record.", result: "Nothing found." });
      expect((yield* journal(missionId)).entries).toHaveLength(1);
    }).pipe(Effect.provide(live())),
  );

  it.live("starts a thread with the briefing and the 20 latest entries", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      yield* record(threadId, { basedOn: 0, briefing: "We ship on Friday.", entry: "Entry 1" });
      for (let i = 2; i <= 21; i++) yield* record(threadId, { entry: `Entry ${i}` });
      const context = yield* contextOfChild(missionId, threadId);
      expect(context).toContain("We ship on Friday.");
      expect(context).toContain("Entry 21");
      expect(context).toContain("Entry 2\n");
      expect(context).not.toContain("Entry 1\n");
      expect(context).toContain("read_journal");
    }).pipe(Effect.provide(live())),
  );

  it.live("starts a thread opened beneath another with its opener's messages since the latest entry", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle("Before the entry");
      yield* record(threadId, { entry: "Decided the plan." });
      yield* send(threadId, "After the entry");
      yield* settle(missionId, (d) => d.thread.state === "Idle" && d.messages.length === 4);
      // The opener's title is the mission's first message, so only the opener's section is read.
      const section = (yield* contextOfChild(missionId, threadId)).split("# Your opener's messages")[1] ?? "";
      expect(section).toContain("Owner:\nAfter the entry");
      expect(section).toContain("Opener:\nEcho: After the entry");
      expect(section).not.toContain("Before the entry");
    }).pipe(Effect.provide(live())),
  );

  it.live("starts a top thread with no opener's messages", () =>
    Effect.gen(function* () {
      const started = yield* start("context");
      const detail = yield* settle(started.missionId, (d) => d.messages.some((m) => m.sender === "agent"));
      const context = detail.messages.find((m) => m.sender === "agent")?.text ?? "";
      expect(context).toContain("# Mission journal");
      expect(context).not.toContain("opener's messages");
    }).pipe(Effect.provide(live())),
  );

  it.live("records the owner's rewrite and entry as written by the owner", () =>
    Effect.gen(function* () {
      const { missionId } = yield* idle();
      const rewritten = yield* call({
        _tag: "RewriteBriefing",
        basedOn: 0,
        briefing: "Owner's briefing.",
        entry: null,
        missionId,
        requestId: crypto.randomUUID(),
      });
      expect(rewritten).toMatchObject({ briefing: "Owner's briefing.", version: 1 });
      const added = yield* call({
        _tag: "AddJournalEntry",
        missionId,
        requestId: crypto.randomUUID(),
        text: "Budget doubled.",
      });
      expect(added.entries.map((e) => [e.authorKind, e.authorTitle, e.text])).toEqual([
        ["user", null, "Budget doubled."],
        ["user", null, "Rewrote the briefing"],
      ]);
    }).pipe(Effect.provide(live())),
  );

  it.live("refuses the owner's stale or oversized rewrite", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      yield* record(threadId, { basedOn: 0, briefing: "Thread's briefing.", entry: "Thread rewrote." });
      const rewrite = (briefing: string, basedOn: number) =>
        call({ _tag: "RewriteBriefing", basedOn, briefing, entry: null, missionId, requestId: crypto.randomUUID() });
      const stale = yield* Effect.flip(rewrite("Owner's briefing.", 0));
      expect(stale.kind).toBe("StaleVersion");
      const settings = yield* call({ _tag: "ReadSettings" });
      yield* call({ _tag: "UpdateSettings", settings: { ...settings, briefingLimit: 2 } });
      const oversized = yield* Effect.flip(rewrite("Far too long.", 1));
      expect(oversized.kind).toBe("InvalidInput");
      expect((yield* journal(missionId)).briefing).toBe("Thread's briefing.");
    }).pipe(Effect.provide(live())),
  );

  it.live("keeps entries from being edited or deleted", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      yield* record(threadId, { entry: "Permanent." });
      const sql = yield* SqlClient.SqlClient;
      expect((yield* Effect.exit(sql`UPDATE journal_entries SET text = 'Changed'`))._tag).toBe("Failure");
      expect((yield* Effect.exit(sql`DELETE FROM journal_entries`))._tag).toBe("Failure");
      expect((yield* journal(missionId)).entries.map((e) => e.text)).toEqual(["Permanent."]);
    }).pipe(Effect.provide(live())),
  );

  it.live("erases the journal with its mission", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      yield* record(threadId, { basedOn: 0, briefing: "Gone soon.", entry: "Will be erased." });
      const preview = yield* call({ _tag: "PreviewDeletion", threadId });
      yield* call({ _tag: "DeleteThread", confirmation: preview.confirmation, threadId });
      const sql = yield* SqlClient.SqlClient;
      const [entries] = yield* sql<{ count: number }>`SELECT COUNT(*) AS count FROM journal_entries`;
      const [journals] = yield* sql<{ count: number }>`SELECT COUNT(*) AS count FROM journals`;
      expect([entries?.count, journals?.count]).toEqual([0, 0]);
      expect((yield* Effect.flip(journal(missionId))).kind).toBe("NotFound");
    }).pipe(Effect.provide(live())),
  );

  it.live("keeps a deleted thread's entries with its saved title", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      const child = yield* open(threadId, "Child");
      yield* settle(missionId, (d) => d.thread.state === "Idle", child.threadId);
      yield* record(child.threadId, { entry: "Child's decision." });
      const preview = yield* call({ _tag: "PreviewDeletion", threadId: child.threadId });
      yield* call({ _tag: "DeleteThread", confirmation: preview.confirmation, threadId: child.threadId });
      const [entry] = (yield* journal(missionId)).entries;
      expect(entry).toMatchObject({ authorKind: "thread", authorTitle: "Child", text: "Child's decision." });
    }).pipe(Effect.provide(live())),
  );
});
