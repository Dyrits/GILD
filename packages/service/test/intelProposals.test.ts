import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { IntelId, IntelProposal, ThreadId } from "@canopy/contracts";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { afterEach } from "vitest";
import { call, entryOf, fixture, start, tool } from "./fixtures/service.ts";

// Batch 16 (scoped-intel: Widening and narrowing proposed from evidence), on the test clock.

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
const idle = (workspacePath: string | null = null) =>
  Effect.gen(function* () {
    const started = yield* start("Hello", workspacePath);
    yield* settleTurns;
    return started;
  });
/** A new folder inside the fixture's directory, to work in as a workspace. */
const folder = (directory: string, name: string) => {
  const path = join(directory, name);
  mkdirSync(path);
  return path;
};
const save = (threadId: ThreadId, text: string, scope: string, kind = "fact") =>
  tool(threadId, "save_intel", { kind, scope, text });
const idOf = (answer: string) => (/intel (\S+?)[ .:]/.exec(answer)?.[1] ?? "") as IntelId;
const panel = (state: "Deleted" | null = null) => call({ _tag: "ListIntel", scope: null, state, threadId: null });
const proposals = panel().pipe(Effect.map((view) => view.proposals));
const resolve = (proposal: IntelProposal | undefined, isApproved: boolean) =>
  call({ _tag: "ResolveIntelProposal", isApproved, proposalId: proposal?.id ?? ("" as IntelProposal["id"]) });
const historyOf = (intelId: IntelId) => call({ _tag: "ReadIntelHistory", intelId });
const approveAll = Effect.gen(function* () {
  for (const change of (yield* panel()).awaiting) {
    yield* call({ _tag: "ResolveIntelChange", changeId: change.id, isApproved: true });
  }
});
/** A global intel saved by a thread and approved by the owner. */
const saveGlobal = (threadId: ThreadId, text: string, kind = "fact") =>
  Effect.gen(function* () {
    yield* save(threadId, text, "global", kind);
    yield* approveAll;
    return (yield* panel()).intels.find((intel) => intel.text === text)?.id ?? ("" as IntelId);
  });

/** The same convention saved separately in two workspaces. */
const twoWorkspaces = (directory: string) =>
  Effect.gen(function* () {
    const first = yield* idle(folder(directory, "alpha"));
    const second = yield* idle(folder(directory, "beta"));
    const older = idOf(yield* save(first.threadId, "Commit messages use the imperative mood.", "workspace"));
    yield* advance(1000);
    const newer = idOf(
      yield* save(second.threadId, "Commit messages use the imperative mood, always.", "workspace", "rule"),
    );
    return { first, newer, older, second };
  });

describe("proposing widening from evidence", () => {
  it.effect("proposes one global intel for the same intel saved in two workspaces", () => {
    const { directory, layer } = live();
    return Effect.gen(function* () {
      const { newer, older } = yield* twoWorkspaces(directory);
      const [proposal, ...rest] = yield* proposals;
      expect(rest).toEqual([]);
      expect(proposal).toMatchObject({
        intelKind: "Rule",
        kind: "Widen",
        scopeLabel: "Global",
        text: "Commit messages use the imperative mood, always.",
      });
      expect(proposal?.intels.map((intel) => intel.id).toSorted()).toEqual([newer, older].toSorted());
      expect(proposal?.intels.map((intel) => intel.scopeLabel).toSorted()).toEqual([
        "Workspace alpha",
        "Workspace beta",
      ]);
    }).pipe(Effect.provide(layer));
  });

  it.effect("changes nothing before the owner approves", () => {
    const { directory, layer } = live();
    return Effect.gen(function* () {
      yield* twoWorkspaces(directory);
      const view = yield* panel();
      expect(view.proposals).toHaveLength(1);
      expect(view.intels.map((intel) => intel.scope)).toEqual(["Workspace", "Workspace"]);
      expect(view.awaiting).toEqual([]);
    }).pipe(Effect.provide(layer));
  });

  it.effect("proposes nothing for different intels, one workspace, or a global intel already saying it", () => {
    const { directory, layer } = live();
    return Effect.gen(function* () {
      const first = yield* idle(folder(directory, "alpha"));
      const second = yield* idle(folder(directory, "beta"));
      yield* save(first.threadId, "Deploys go through the staging server first.", "workspace");
      yield* save(second.threadId, "The owner reviews pull requests on Fridays.", "workspace");
      yield* save(first.threadId, "The staging server runs Ubuntu.", "workspace");
      yield* save(second.threadId, "The staging server is in Frankfurt.", "workspace");
      expect(yield* proposals).toEqual([]);
      const other = idOf(yield* save(first.threadId, "Logs rotate every night at midnight.", "workspace"));
      yield* call({ _tag: "EditIntel", intelId: other, text: "Deploys go through the staging server first!" });
      expect(yield* proposals).toEqual([]);
      yield* saveGlobal(first.threadId, "Branch names start with the ticket number.");
      yield* save(first.threadId, "Branch names start with the ticket number here.", "workspace");
      yield* save(second.threadId, "Branch names start with the ticket number too.", "workspace");
      expect(yield* proposals).toEqual([]);
    }).pipe(Effect.provide(layer));
  });

  it.effect("proposes nothing for archived intel", () => {
    const { directory, layer } = live();
    return Effect.gen(function* () {
      const first = yield* idle(folder(directory, "alpha"));
      const second = yield* idle(folder(directory, "beta"));
      yield* save(first.threadId, "The provider's API is flaky this week.", "workspace", "temporary");
      yield* save(second.threadId, "The provider's API is flaky this week.", "workspace", "temporary");
      expect(yield* proposals).toHaveLength(1);
      yield* advance(20 * day);
      expect(yield* proposals).toEqual([]);
    }).pipe(Effect.provide(layer));
  });

  it.effect("carries the merged intels' uses into later evidence", () => {
    const { directory, layer } = live();
    return Effect.gen(function* () {
      const first = yield* idle(folder(directory, "alpha"));
      const second = yield* idle(folder(directory, "beta"));
      yield* save(first.threadId, "The staging database is called orchid.", "workspace");
      yield* advance(1000);
      const newer = idOf(yield* save(second.threadId, "The staging database is called orchid now.", "workspace"));
      yield* advance(10 * day);
      yield* tool(first.threadId, "search_intel", { query: "orchid" });
      yield* resolve((yield* proposals)[0], true);
      yield* advance(36 * day);
      expect(yield* proposals).toMatchObject([
        { intels: [{ id: newer }], kind: "Narrow", scopeLabel: "Workspace alpha", uses: 1 },
      ]);
    }).pipe(Effect.provide(layer));
  });

  it.effect("makes one global intel on approval, merging the others into it", () => {
    const { directory, layer } = live();
    return Effect.gen(function* () {
      const { first, newer, older, second } = yield* twoWorkspaces(directory);
      yield* tool(first.threadId, "search_intel", { query: "commit messages" });
      yield* tool(second.threadId, "search_intel", { query: "commit messages" });
      yield* resolve((yield* proposals)[0], true);
      const view = yield* panel();
      expect(view.proposals).toEqual([]);
      expect(view.intels).toMatchObject([
        { id: newer, kind: "Rule", scope: "Global", text: "Commit messages use the imperative mood, always.", uses: 2 },
      ]);
      expect((yield* panel("Deleted")).deleted.map((intel) => intel.id)).toEqual([older]);
      expect(entryOf((yield* historyOf(newer)).entries, "Widened")).toMatchObject({
        actor: "Owner",
        scopeLabel: "Global",
      });
      expect(entryOf((yield* historyOf(older)).entries, "Merged")).toMatchObject({ actor: "Owner", text: null });
      const elsewhere = yield* idle();
      expect(yield* tool(elsewhere.threadId, "search_intel", { ids: [newer] })).toContain("imperative mood, always");
    }).pipe(Effect.provide(layer));
  });

  it.effect("drops a declined proposal for good and changes nothing", () => {
    const { directory, layer } = live();
    return Effect.gen(function* () {
      yield* twoWorkspaces(directory);
      yield* resolve((yield* proposals)[0], false);
      const view = yield* panel();
      expect(view.proposals).toEqual([]);
      expect(view.intels.map((intel) => intel.scope)).toEqual(["Workspace", "Workspace"]);
      yield* advance(day);
      expect(yield* proposals).toEqual([]);
    }).pipe(Effect.provide(layer));
  });

  it.effect("proposes again when a third workspace joins a declined set", () => {
    const { directory, layer } = live();
    return Effect.gen(function* () {
      yield* twoWorkspaces(directory);
      yield* resolve((yield* proposals)[0], false);
      const third = yield* idle(folder(directory, "gamma"));
      yield* save(third.threadId, "Commit messages use the imperative mood.", "workspace");
      const [proposal] = yield* proposals;
      expect(proposal?.intels).toHaveLength(3);
    }).pipe(Effect.provide(layer));
  });

  it.effect("refuses a proposal that no longer holds", () => {
    const { directory, layer } = live();
    return Effect.gen(function* () {
      const { older } = yield* twoWorkspaces(directory);
      const [proposal] = yield* proposals;
      yield* call({ _tag: "DeleteIntel", intelId: older });
      const failure = yield* Effect.flip(resolve(proposal, true));
      expect(String(failure.message)).toContain("no longer");
      expect((yield* panel()).intels.map((intel) => intel.scope)).toEqual(["Workspace"]);
    }).pipe(Effect.provide(layer));
  });

  it.effect("undoes a widening and a merge from the history", () => {
    const { directory, layer } = live();
    return Effect.gen(function* () {
      const { newer, older } = yield* twoWorkspaces(directory);
      yield* resolve((yield* proposals)[0], true);
      yield* call({ _tag: "UndoIntelChange", entryId: entryOf((yield* historyOf(newer)).entries, "Widened").id });
      yield* call({ _tag: "UndoIntelChange", entryId: entryOf((yield* historyOf(older)).entries, "Merged").id });
      const intels = (yield* panel()).intels;
      expect(intels.map((intel) => intel.scopeLabel).toSorted()).toEqual(["Workspace alpha", "Workspace beta"]);
    }).pipe(Effect.provide(layer));
  });
});

describe("proposing narrowing from evidence", () => {
  it.effect("proposes moving a global intel used only in one workspace for its whole half-life", () => {
    const { directory, layer } = live();
    return Effect.gen(function* () {
      const { threadId } = yield* idle(folder(directory, "alpha"));
      const id = yield* saveGlobal(threadId, "The staging database is called orchid.");
      yield* advance(20 * day);
      yield* tool(threadId, "search_intel", { query: "orchid" });
      expect(yield* proposals).toEqual([]);
      yield* advance(26 * day);
      yield* tool(threadId, "search_intel", { query: "orchid" });
      expect(yield* proposals).toMatchObject([
        {
          halfLifeDays: 45,
          intels: [{ id, scopeLabel: "Global" }],
          kind: "Narrow",
          scopeLabel: "Workspace alpha",
          uses: 2,
        },
      ]);
      expect((yield* panel()).intels).toMatchObject([{ id, scope: "Global" }]);
    }).pipe(Effect.provide(layer));
  });

  it.effect("proposes nothing for an intel used elsewhere, never used, or a rule", () => {
    const { directory, layer } = live();
    return Effect.gen(function* () {
      const { threadId } = yield* idle(folder(directory, "alpha"));
      const scratch = yield* idle();
      yield* saveGlobal(threadId, "The staging database is called orchid.");
      yield* saveGlobal(threadId, "The owner signs off messages with a dash.", "preference");
      yield* saveGlobal(threadId, "Never push to the release branch on weekends.", "rule");
      yield* advance(100 * day);
      yield* tool(threadId, "search_intel", { query: "orchid weekends" });
      yield* tool(scratch.threadId, "search_intel", { query: "orchid" });
      expect(yield* proposals).toEqual([]);
    }).pipe(Effect.provide(layer));
  });

  it.effect("proposes nothing for an intel used in two workspaces or by a thread without one", () => {
    const { directory, layer } = live();
    return Effect.gen(function* () {
      const alpha = yield* idle(folder(directory, "alpha"));
      const beta = yield* idle(folder(directory, "beta"));
      const scratch = yield* idle();
      yield* saveGlobal(alpha.threadId, "The staging database is called orchid.");
      yield* saveGlobal(alpha.threadId, "The release train leaves on Tuesdays.");
      yield* advance(46 * day);
      yield* tool(alpha.threadId, "search_intel", { query: "orchid" });
      yield* tool(beta.threadId, "search_intel", { query: "orchid" });
      yield* tool(scratch.threadId, "search_intel", { query: "release train tuesdays" });
      expect(yield* proposals).toEqual([]);
    }).pipe(Effect.provide(layer));
  });

  it.effect("counts only the uses over the last half-life", () => {
    const { directory, layer } = live();
    return Effect.gen(function* () {
      const alpha = yield* idle(folder(directory, "alpha"));
      const beta = yield* idle(folder(directory, "beta"));
      yield* saveGlobal(alpha.threadId, "The staging database is called orchid.");
      yield* advance(10 * day);
      yield* tool(beta.threadId, "search_intel", { query: "orchid" });
      yield* advance(50 * day);
      yield* tool(alpha.threadId, "search_intel", { query: "orchid" });
      expect(yield* proposals).toMatchObject([{ kind: "Narrow", scopeLabel: "Workspace alpha", uses: 1 }]);
    }).pipe(Effect.provide(layer));
  });

  it.effect("moves the intel to the workspace on approval, undoably", () => {
    const { directory, layer } = live();
    return Effect.gen(function* () {
      const { threadId } = yield* idle(folder(directory, "alpha"));
      const id = yield* saveGlobal(threadId, "The staging database is called orchid.");
      yield* advance(46 * day);
      yield* tool(threadId, "relied_on_intel", { ids: [id] });
      yield* resolve((yield* proposals)[0], true);
      expect((yield* panel()).intels).toMatchObject([{ id, scope: "Workspace", scopeLabel: "Workspace alpha" }]);
      expect(yield* proposals).toEqual([]);
      const narrowed = entryOf((yield* historyOf(id)).entries, "Narrowed");
      expect(narrowed).toMatchObject({ actor: "Owner", scopeLabel: "Workspace alpha" });
      yield* call({ _tag: "UndoIntelChange", entryId: narrowed.id });
      expect((yield* panel()).intels).toMatchObject([{ id, scope: "Global" }]);
    }).pipe(Effect.provide(layer));
  });
});
