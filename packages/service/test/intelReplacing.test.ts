import type { ThreadId } from "@canopy/contracts";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { afterEach } from "vitest";
import { call, fixture, open, read, send, start, tool } from "./fixtures/service.ts";

// Batch 14 (scoped-intel: Duplicates, Saving's origin, Fading's "relied on"), on the test clock.

const fixtures: ReturnType<typeof fixture>[] = [];
const live = () => {
  const value = fixture();
  fixtures.push(value);
  return value;
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

const day = 24 * 60 * 60 * 1000;
const advance = (millis: number) =>
  Effect.gen(function* () {
    yield* TestClock.adjust(millis);
    for (let i = 0; i < 40; i++) yield* Effect.yieldNow;
  });
const settleTurns = Effect.gen(function* () {
  for (let i = 0; i < 5; i++) yield* advance(20);
});
const idle = (text = "Hello", workspacePath: string | null = null) =>
  Effect.gen(function* () {
    const started = yield* start(text, workspacePath);
    yield* settleTurns;
    return started;
  });
const save = (threadId: ThreadId, text: string, scope: string, kind: string, extra: object = {}) =>
  tool(threadId, "save_intel", { kind, scope, text, ...extra });
const idOf = (answer: string) => /intel (\S+?)[ .:]/.exec(answer)?.[1] ?? "";
const panel = () => call({ _tag: "ListIntel", scope: null, state: null, threadId: null });
const intelOf = (id: string) => panel().pipe(Effect.map((view) => view.intels.find((intel) => intel.id === id)));

describe("duplicates saved as replacements", () => {
  it.effect("replaces an intel saying an older version of the same thing, keeping its id and uses", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      const id = idOf(yield* save(threadId, "The owner prefers pnpm.", "mission", "preference"));
      yield* tool(threadId, "search_intel", { ids: [id] });
      yield* advance(10 * day);
      const answer = yield* save(threadId, "The owner prefers Bun.", "mission", "preference");
      expect(answer).toContain(`Replaced intel ${id}`);
      expect(answer).toContain("The owner prefers pnpm.");
      const intels = (yield* panel()).intels;
      expect(intels).toHaveLength(1);
      expect(intels[0]).toMatchObject({ id, strength: 1, text: "The owner prefers Bun.", uses: 1 });
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("saves an unclear match as a new intel and names the close one", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      const id = idOf(yield* save(threadId, "The staging server runs Linux.", "mission", "fact"));
      const answer = yield* save(threadId, "Deploys go to the staging server.", "mission", "fact");
      expect(answer).toMatch(/^Saved intel /);
      expect(answer).toContain(id);
      expect((yield* panel()).intels).toHaveLength(2);
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("never replaces an intel in another scope, and names a close one in a wider scope", () => {
    const { directory, layer } = live();
    return Effect.gen(function* () {
      const { threadId } = yield* idle("Hello", directory);
      const workspace = idOf(yield* save(threadId, "The workspace formats code with Prettier.", "workspace", "fact"));
      const child = (yield* open(threadId)).threadId;
      yield* settleTurns;
      // A narrower intel that differs overrides the wider one: both stay.
      const answer = yield* save(child, "The workspace formats code with Biome.", "thread", "fact");
      expect(answer).toMatch(/^Saved intel /);
      expect(answer).toContain(workspace);
      expect(yield* intelOf(workspace)).toMatchObject({ text: "The workspace formats code with Prettier." });
      const mission = idOf(yield* save(threadId, "Releases ship on Fridays only.", "mission", "decision"));
      expect(yield* save(threadId, "Releases ship on Thursdays only.", "workspace", "decision")).toMatch(
        /^Saved intel /,
      );
      expect(yield* intelOf(mission)).toMatchObject({ text: "Releases ship on Fridays only." });
      expect((yield* panel()).intels).toHaveLength(4);
    }).pipe(Effect.provide(layer));
  });

  it.effect("makes a global replacement await approval with the old and the new text", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      yield* save(threadId, "The owner writes in British English.", "global", "preference");
      for (const change of (yield* panel()).awaiting) {
        yield* call({ _tag: "ResolveIntelChange", changeId: change.id, isApproved: true });
      }
      const [original] = (yield* panel()).intels;
      expect(yield* save(threadId, "The owner writes in American English.", "global", "preference")).toContain(
        "Awaiting approval",
      );
      const [change] = (yield* panel()).awaiting;
      if (change === undefined) return expect.unreachable("no change awaits approval");
      expect(change).toMatchObject({
        intelId: original?.id,
        kind: "Replace",
        previousText: "The owner writes in British English.",
        text: "The owner writes in American English.",
      });
      expect((yield* intelOf(original?.id ?? ""))?.text).toBe("The owner writes in British English.");
      yield* call({ _tag: "ResolveIntelChange", changeId: change.id, isApproved: true });
      const intels = (yield* panel()).intels;
      expect(intels).toHaveLength(1);
      expect(intels[0]).toMatchObject({ id: original?.id, text: "The owner writes in American English." });
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("does not replace an archived intel", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      const old = idOf(yield* save(threadId, "The API is flaky this week.", "mission", "temporary"));
      yield* advance(20 * day);
      const answer = yield* save(threadId, "The API is flaky this week again.", "mission", "temporary");
      expect(answer).toMatch(/^Saved intel /);
      expect(idOf(answer)).not.toBe(old);
    }).pipe(Effect.provide(live().layer)),
  );
});

describe("where an intel comes from", () => {
  it.effect("records the message the thread was answering", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle("Always run the tests before a commit.");
      const id = idOf(yield* save(threadId, "Always run the tests before a commit.", "mission", "rule"));
      expect((yield* intelOf(id))?.origin).toEqual({
        entryNumber: null,
        excerpt: "Always run the tests before a commit.",
        from: null,
        kind: "Message",
      });
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("never records a message the thread has not received", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle("Use Bun for scripts.");
      yield* call({ _tag: "StopThread", threadId });
      // Kept for the Stopped thread, not delivered.
      yield* send(threadId, "Unrelated later message.");
      yield* settleTurns;
      const id = idOf(yield* save(threadId, "The owner uses Bun for scripts.", "mission", "preference"));
      expect((yield* intelOf(id))?.origin?.excerpt).toBe("Use Bun for scripts.");
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("records the journal entry it rests on, and refuses one that does not exist", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      yield* tool(threadId, "update_journal", { entry: "Chose Effect for the service." });
      expect(yield* save(threadId, "The service uses Effect.", "mission", "decision", { journalEntry: 9 })).toContain(
        "no journal entry 9",
      );
      const id = idOf(yield* save(threadId, "The service uses Effect.", "mission", "decision", { journalEntry: 1 }));
      expect((yield* intelOf(id))?.origin).toMatchObject({
        entryNumber: 1,
        excerpt: "Chose Effect for the service.",
        kind: "JournalEntry",
      });
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("keeps the origin of a global save through its approval", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle("I always want answers in British English.");
      yield* save(threadId, "The owner writes in British English.", "global", "preference");
      for (const change of (yield* panel()).awaiting) {
        yield* call({ _tag: "ResolveIntelChange", changeId: change.id, isApproved: true });
      }
      expect((yield* panel()).intels[0]?.origin).toMatchObject({
        excerpt: "I always want answers in British English.",
        kind: "Message",
      });
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("names the thread a message came from", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      const child = (yield* open(threadId, "Look into the build.")).threadId;
      yield* settleTurns;
      yield* tool(child, "send_thread_message", { text: "Keep the build under a minute.", to: threadId });
      yield* settleTurns;
      const id = idOf(yield* save(threadId, "The build must stay under a minute.", "mission", "rule"));
      const origin = (yield* intelOf(id))?.origin;
      expect(origin).toMatchObject({ excerpt: "Keep the build under a minute.", kind: "Message" });
      expect(origin?.from).not.toBeNull();
    }).pipe(Effect.provide(live().layer)),
  );
});

describe("relying on an intel", () => {
  it.effect("counts as a use and keeps it active", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      const id = idOf(yield* save(threadId, "The staging server is slow today.", "mission", "temporary"));
      yield* advance(7 * day);
      expect(yield* tool(threadId, "relied_on_intel", { ids: [id] })).toContain("1 use");
      expect(yield* intelOf(id)).toMatchObject({ state: "Active", strength: 1, uses: 1 });
      yield* advance(7 * day);
      expect((yield* intelOf(id))?.state).toBe("Active");
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("refuses intel outside the thread's scope and archived intel", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      const other = (yield* idle()).threadId;
      const foreign = idOf(yield* save(other, "Another mission's fact.", "mission", "fact"));
      const old = idOf(yield* save(threadId, "The API is flaky this week.", "mission", "temporary"));
      yield* advance(20 * day);
      const answer = yield* tool(threadId, "relied_on_intel", { ids: [foreign, old] });
      expect(answer).toContain("No use counted");
      expect(yield* intelOf(old)).toMatchObject({ state: "Archived", uses: 0 });
      expect(yield* intelOf(foreign)).toMatchObject({ uses: 0 });
      expect(yield* tool(threadId, "relied_on_intel", { ids: [] })).toContain("Invalid arguments");
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("is asked for in the context, with replacing and the journal entry", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      yield* send(threadId, "context");
      yield* settleTurns;
      const detail = yield* read(missionId, threadId);
      const context = detail.messages.findLast((m) => m.sender === "agent")?.text ?? "";
      expect(context).toContain("relied_on_intel");
      expect(context).toMatch(/replaces it/);
      expect(context).toContain("journalEntry");
    }).pipe(Effect.provide(live().layer)),
  );
});
