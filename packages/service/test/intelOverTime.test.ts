import { describe, expect, it } from "@effect/vitest";
import type { IntelId, IntelStateFilter, MissionId, Settings, ThreadId } from "@openmission/contracts";
import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { afterEach } from "vitest";
import { call, fixture, read, send, start, tool } from "./fixtures/batch7.ts";

// Intel over time (scoped-intel: Kinds, Recall, Fading, Search), on the test clock.

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
/** Moves the test clock and lets forked turns and sweeps observe it and commit. */
const advance = (millis: number) =>
  Effect.gen(function* () {
    yield* TestClock.adjust(millis);
    for (let i = 0; i < 40; i++) yield* Effect.yieldNow;
  });
/** Lets a fake turn (10 millis) and its tool calls finish. */
const settleTurns = Effect.gen(function* () {
  for (let i = 0; i < 5; i++) yield* advance(20);
});
const idle = (workspacePath: string | null = null) =>
  Effect.gen(function* () {
    const started = yield* start("Hello", workspacePath);
    yield* settleTurns;
    return started;
  });
/** The context a thread's next turn receives, as the fake harness echoes it. */
const contextOf = (missionId: MissionId, threadId: ThreadId) =>
  Effect.gen(function* () {
    yield* send(threadId, "context");
    yield* settleTurns;
    const detail = yield* read(missionId, threadId);
    return detail.messages.findLast((m) => m.sender === "agent")?.text ?? "";
  });
const save = (threadId: ThreadId, text: string, scope: string, kind: string) =>
  tool(threadId, "save_intel", { kind, scope, text });
const idOf = (answer: string) => /intel (\S+?)[ .]/.exec(answer)?.[1] ?? "";
const panel = (state: IntelStateFilter | null = null, threadId: ThreadId | null = null) =>
  call({ _tag: "ListIntel", scope: null, state, threadId });
const intelOf = (id: string) => panel().pipe(Effect.map((view) => view.intels.find((intel) => intel.id === id)));
const approveAll = Effect.gen(function* () {
  for (const change of (yield* panel()).awaiting) {
    yield* call({ _tag: "ResolveIntelChange", changeId: change.id, isApproved: true });
  }
});
const updateSettings = (change: Partial<Settings>) =>
  Effect.gen(function* () {
    const settings = yield* call({ _tag: "ReadSettings" });
    yield* call({ _tag: "UpdateSettings", settings: { ...settings, ...change } });
  });

describe("intel kinds", () => {
  it.effect("requires a kind and answers searches with it", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      expect(yield* tool(threadId, "save_intel", { scope: "thread", text: "No kind." })).toContain("kind");
      yield* save(threadId, "The owner prefers Bun.", "thread", "preference");
      const found = yield* tool(threadId, "search_intel", { query: "bun" });
      expect(found).toContain("(mission, preference) The owner prefers Bun.");
      expect((yield* panel()).intels).toMatchObject([
        { isPinned: false, kind: "Preference", state: "Active", strength: 1, text: "The owner prefers Bun." },
      ]);
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("keeps the kind of a global save through its approval", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      yield* save(threadId, "Always run the tests before a commit.", "global", "rule");
      yield* approveAll;
      expect((yield* panel()).intels).toMatchObject([{ kind: "Rule", scope: "Global" }]);
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("tells threads to save a rule the owner gives in a chat as a rule", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      const context = yield* contextOf(missionId, threadId);
      expect(context).toMatch(/always run the tests before a commit.*kind rule/);
    }).pipe(Effect.provide(live().layer)),
  );
});

describe("recalling intel over time", () => {
  it.effect("carries scoped intel in full, global intel as an index, and the count of dormant intels", () => {
    const { directory, layer } = live();
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* idle(directory);
      const long = `The owner reviews every pull request on GitHub before it merges, ${"and ".repeat(30)}more.`;
      yield* save(threadId, long, "global", "preference");
      yield* approveAll;
      yield* save(threadId, "The workspace uses Biome.", "workspace", "fact");
      yield* save(threadId, "The thread's draft is in notes.md.", "thread", "fact");
      yield* save(threadId, "The API is flaky this week.", "thread", "temporary");
      yield* advance(9 * day);
      const context = yield* contextOf(missionId, threadId);
      expect(context).toContain("The workspace uses Biome.");
      expect(context).toContain("The thread's draft is in notes.md.");
      expect(context).not.toContain("flaky");
      expect(context).toContain("1 dormant intel");
      const globalId = (yield* panel()).intels.find((intel) => intel.scope === "Global")?.id ?? "";
      const line = context.split("\n").find((part) => part.includes(globalId)) ?? "";
      expect(line).toMatch(/\(global, preference\) The owner reviews every pull request/);
      expect(line).toContain("…");
      expect(line).not.toContain("more.");
    }).pipe(Effect.provide(layer));
  });

  it.effect("adds a new global intel at the end of the index, leaving the lines before it unchanged", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      yield* save(threadId, "The owner writes in British English.", "global", "preference");
      yield* approveAll;
      yield* advance(day);
      yield* save(threadId, "The owner's time zone is Paris.", "global", "fact");
      yield* approveAll;
      const indexOf = (context: string) => context.split("\n").filter((part) => part.includes("(global, "));
      const before = indexOf(yield* contextOf(missionId, threadId));
      yield* save(threadId, "The owner uses a Mac.", "global", "fact");
      yield* approveAll;
      const after = indexOf(yield* contextOf(missionId, threadId));
      expect(after.slice(0, before.length)).toEqual(before);
      expect(after).toHaveLength(3);
      expect(after.at(-1)).toContain("uses a Mac");
    }).pipe(Effect.provide(live().layer)),
  );
});

describe("fading", () => {
  it.effect("makes a temporary intel dormant, then archived; search finds it while dormant", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      const id = idOf(yield* save(threadId, "The API is flaky this week.", "thread", "temporary"));
      yield* advance(8 * day);
      expect((yield* intelOf(id))?.state).toBe("Active");
      expect(yield* contextOf(missionId, threadId)).toContain("flaky");
      yield* advance(day);
      expect((yield* intelOf(id))?.state).toBe("Dormant");
      expect(yield* contextOf(missionId, threadId)).not.toContain("flaky");
      expect(yield* tool(threadId, "search_intel", { query: "flaky api" })).toContain("flaky");
      expect((yield* intelOf(id))?.state).toBe("Active");
      expect((yield* intelOf(id))?.uses).toBe(1);
      expect(yield* contextOf(missionId, threadId)).toContain("flaky");
      // One use doubles the half-life to 6 days, counted from the use: still active 10 days later.
      yield* advance(10 * day);
      expect((yield* intelOf(id))?.state).toBe("Active");
      // Archived below 0.05, about 26 days after the use.
      yield* advance(17 * day);
      expect((yield* intelOf(id))?.state).toBe("Archived");
      expect(yield* tool(threadId, "search_intel", { query: "flaky api" })).toContain("No intel");
      expect((yield* panel("Archived")).intels.map((intel) => intel.id)).toEqual([id]);
      expect((yield* panel("Active")).intels).toEqual([]);
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("never fades a rule or a pinned intel", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      const rule = idOf(yield* save(threadId, "Always run the tests.", "thread", "rule"));
      const pinned = idOf(yield* save(threadId, "The repository is on GitHub.", "thread", "fact"));
      const plain = idOf(yield* save(threadId, "The CI runs on Linux.", "thread", "fact"));
      yield* call({ _tag: "PinIntel", intelId: pinned as IntelId, isPinned: true });
      yield* advance(1000 * day);
      expect((yield* intelOf(rule))?.state).toBe("Active");
      expect(yield* intelOf(pinned)).toMatchObject({ isPinned: true, state: "Active", strength: 1 });
      expect((yield* intelOf(plain))?.state).toBe("Archived");
      expect((yield* panel("Pinned")).intels.map((intel) => intel.id)).toEqual([pinned]);
      yield* call({ _tag: "PinIntel", intelId: pinned as IntelId, isPinned: false });
      expect((yield* intelOf(pinned))?.state).toBe("Archived");
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("counts search as a use, but not being in the context", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      const used = idOf(yield* save(threadId, "The staging server is slow today.", "thread", "temporary"));
      const unused = idOf(yield* save(threadId, "The office is closed today.", "thread", "temporary"));
      yield* advance(day);
      yield* tool(threadId, "search_intel", { query: "staging" });
      for (let index = 0; index < 10; index++) {
        yield* contextOf(missionId, threadId);
        yield* advance(day);
      }
      expect(yield* intelOf(unused)).toMatchObject({ state: "Dormant", uses: 0 });
      expect(yield* intelOf(used)).toMatchObject({ state: "Active", uses: 1 });
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("restores an archived intel from the panel", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      const id = idOf(yield* save(threadId, "The API is flaky this week.", "thread", "temporary"));
      yield* advance(20 * day);
      expect((yield* intelOf(id))?.state).toBe("Archived");
      yield* call({ _tag: "RestoreIntel", intelId: id as IntelId });
      expect(yield* intelOf(id)).toMatchObject({ state: "Active", strength: 1, uses: 0 });
      expect(yield* contextOf(missionId, threadId)).toContain("flaky");
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("follows the half-lives in Settings", () =>
    Effect.gen(function* () {
      const settings = yield* call({ _tag: "ReadSettings" });
      expect(settings.intelHalfLives).toEqual({ decision: 45, fact: 45, preference: 90, temporary: 3 });
      yield* updateSettings({ intelHalfLives: { ...settings.intelHalfLives, temporary: 30 } });
      const { threadId } = yield* idle();
      const id = idOf(yield* save(threadId, "The API is flaky this week.", "thread", "temporary"));
      yield* advance(20 * day);
      expect((yield* intelOf(id))?.state).toBe("Active");
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("makes a fact dormant after its half-life and a preference later", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      const fact = idOf(yield* save(threadId, "The relay runs on Cloudflare.", "thread", "fact"));
      const preference = idOf(yield* save(threadId, "The owner prefers tables.", "thread", "preference"));
      yield* advance(130 * day);
      expect((yield* intelOf(fact))?.state).toBe("Dormant");
      expect((yield* intelOf(preference))?.state).toBe("Active");
    }).pipe(Effect.provide(live().layer)),
  );
});

describe("ranked search", () => {
  it.effect("ranks the closest match first", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      // Saved worst match first, so only ranking puts the closest match first.
      yield* save(threadId, "Staging builds run nightly.", "thread", "fact");
      yield* save(threadId, "Deploys go to the staging server.", "thread", "fact");
      yield* save(threadId, "The staging server runs Linux.", "thread", "fact");
      const found = yield* tool(threadId, "search_intel", { query: "staging server linux" });
      const order = ["runs Linux", "Deploys go", "builds run"].map((part) => found.indexOf(part));
      expect(order.every((position) => position >= 0)).toBe(true);
      expect(order).toEqual([...order].sort((a, b) => a - b));
    }).pipe(Effect.provide(live().layer)),
  );

  it.effect("ranks an intel matching a rare word higher", () => {
    const { directory, layer } = live();
    return Effect.gen(function* () {
      const { threadId } = yield* idle(directory);
      yield* save(threadId, "Ask Priya before a deploy.", "workspace", "fact");
      for (const text of [
        "Staging uses Linux.",
        "Staging builds nightly.",
        "Staging logs to Grafana.",
        "Staging is slow.",
      ]) {
        yield* save(threadId, text, "thread", "fact");
      }
      const found = yield* tool(threadId, "search_intel", { query: "staging priya" });
      expect(found.indexOf("Priya")).toBeGreaterThan(0);
      expect(found.indexOf("Priya")).toBeLessThan(found.indexOf("Staging"));
    }).pipe(Effect.provide(layer));
  });

  it.effect("reads intels by identifier, counting a use", () =>
    Effect.gen(function* () {
      const { threadId } = yield* idle();
      const id = idOf(yield* save(threadId, "The owner prefers Bun.", "thread", "preference"));
      expect(yield* tool(threadId, "search_intel", { ids: [id] })).toContain("The owner prefers Bun.");
      expect((yield* intelOf(id))?.uses).toBe(1);
      expect(yield* tool(threadId, "search_intel", {})).toContain("Invalid arguments");
    }).pipe(Effect.provide(live().layer)),
  );
});

describe("the intel gauge over time", () => {
  it.effect("counts active scoped intel in full and global intel by its index line, not dormant intel", () =>
    Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      yield* save(threadId, `The owner wants ${"long ".repeat(150)}answers.`, "global", "preference");
      yield* approveAll;
      yield* save(threadId, "The API is flaky this week.", "thread", "temporary");
      const before = (yield* read(missionId, threadId)).intelGauge;
      expect(before.count).toBe(2);
      // The index line is at most 80 characters (20 tokens); the thread intel 7 tokens.
      expect(before.tokens).toBeLessThanOrEqual(27);
      yield* advance(9 * day);
      expect((yield* read(missionId, threadId)).intelGauge).toMatchObject({ count: 1 });
    }).pipe(Effect.provide(live().layer)),
  );
});
