import { mkdirSync, realpathSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import type { MissionId, Request } from "@iskios/contracts";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { Service } from "../../src/index.ts";
import { call, fixture, open, read, send, settle, start } from "../fixtures/service.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

/** Runs a check on a service whose data folder also holds two folders to tie realms to. */
const withService = <A, E, R>(body: (folders: { garden: string; workshop: string }) => Effect.Effect<A, E, R>) => {
  const value = fixture();
  fixtures.push(value);
  // Real paths, as a realm stores them: the temporary folder is a link on macOS.
  const garden = join(realpathSync(value.directory), "garden");
  const workshop = join(realpathSync(value.directory), "workshop");
  mkdirSync(garden);
  mkdirSync(workshop);
  return body({ garden, workshop }).pipe(Effect.provide(value.layer));
};

const failureOf = (request: Request) =>
  Effect.gen(function* () {
    return yield* Effect.flip((yield* Service).handle(request));
  });

const listed = () => call({ _tag: "ListMissions", isArchived: false, search: null, state: null, workspaceId: null });

/** A realm tied to a folder, or to none with a null path, and its id. */
const makeRealm = (name: string, path: string | null) =>
  Effect.gen(function* () {
    yield* call({ _tag: "CreateRealm", crest: null, name, path });
    const realm = (yield* listed()).workspaces.find((each) => each.name === name);
    if (realm === undefined) return yield* Effect.die(new Error(`no realm ${name}`));
    return realm.id;
  });

const realmOf = (missionId: MissionId) =>
  Effect.gen(function* () {
    return (yield* listed()).missions.find((mission) => mission.id === missionId)?.workspaceId;
  });

const idle = (detail: { thread: { state: string } }) => detail.thread.state === "Idle";
const lastReplyOf = (detail: { messages: ReadonlyArray<{ sender: string; text: string }> }) =>
  detail.messages.filter((message) => message.sender === "agent").at(-1)?.text ?? "";

describe("moving a quest between realms and the Borderlands", () => {
  it.live("moves the quest and every side-quest, and keeps the conversation", () =>
    withService(({ garden, workshop }) =>
      Effect.gen(function* () {
        const gardenId = yield* makeRealm("Garden", garden);
        const workshopId = yield* makeRealm("Workshop", workshop);
        const quest = yield* call({ _tag: "StartEmptyQuest", realmId: gardenId, requestId: "q1" });
        yield* send(quest.threadId, "Hello");
        const before = yield* settle(quest.missionId, (detail) => detail.messages.length === 2 && idle(detail));
        const side = yield* open(quest.threadId, "Side");
        const grandchild = yield* open(side.threadId, "Deeper");
        yield* settle(quest.missionId, idle, grandchild.threadId);
        yield* settle(quest.missionId, idle, side.threadId);
        yield* settle(quest.missionId, idle);

        yield* call({ _tag: "MoveQuest", missionId: quest.missionId, realmId: workshopId });

        expect(yield* realmOf(quest.missionId)).toBe(workshopId);
        for (const threadId of [quest.threadId, side.threadId, grandchild.threadId]) {
          const detail = yield* read(quest.missionId, threadId);
          expect(detail.thread.workspace?.path).toBe(workshop);
        }
        const after = yield* read(quest.missionId);
        expect(after.messages.map((message) => message.text)).toEqual(before.messages.map((message) => message.text));

        yield* call({ _tag: "MoveQuest", missionId: quest.missionId, realmId: null });
        expect(yield* realmOf(quest.missionId)).toBeNull();
        for (const threadId of [quest.threadId, side.threadId, grandchild.threadId]) {
          expect((yield* read(quest.missionId, threadId)).thread.workspace).toBeNull();
        }
      }),
    ),
  );

  it.live("moves a quest into a realm tied to no folder, whose threads then use the scratch folder", () =>
    withService(({ garden }) =>
      Effect.gen(function* () {
        const gardenId = yield* makeRealm("Garden", garden);
        const untiedId = yield* makeRealm("Notes", null);
        const quest = yield* call({ _tag: "StartEmptyQuest", realmId: gardenId, requestId: "q2" });
        yield* call({ _tag: "MoveQuest", missionId: quest.missionId, realmId: untiedId });
        expect(yield* realmOf(quest.missionId)).toBe(untiedId);
        expect((yield* read(quest.missionId)).thread.workspace).toBeNull();
      }),
    ),
  );

  it.live("refuses while a thread of the quest is in a turn, and changes nothing", () =>
    withService(({ garden, workshop }) =>
      Effect.gen(function* () {
        const gardenId = yield* makeRealm("Garden", garden);
        const workshopId = yield* makeRealm("Workshop", workshop);
        const quest = yield* call({ _tag: "StartEmptyQuest", realmId: gardenId, requestId: "q3" });
        yield* send(quest.threadId, "wait 2000");
        yield* settle(quest.missionId, (detail) => detail.thread.state === "Running");

        const refusal = yield* failureOf({ _tag: "MoveQuest", missionId: quest.missionId, realmId: workshopId });
        expect(refusal).toMatchObject({ kind: "InvalidInput" });
        expect(yield* realmOf(quest.missionId)).toBe(gardenId);
        expect((yield* read(quest.missionId)).thread.workspace?.path).toBe(garden);
      }),
    ),
  );

  it.live("refuses an unknown quest or realm", () =>
    withService(({ garden }) =>
      Effect.gen(function* () {
        const gardenId = yield* makeRealm("Garden", garden);
        const quest = yield* call({ _tag: "StartEmptyQuest", realmId: null, requestId: "q4" });
        expect(yield* failureOf({ _tag: "MoveQuest", missionId: "missing" as never, realmId: gardenId })).toMatchObject(
          {
            kind: "NotFound",
          },
        );
        expect(
          yield* failureOf({ _tag: "MoveQuest", missionId: quest.missionId, realmId: "missing" as never }),
        ).toMatchObject({ kind: "InvalidInput", message: "No such realm." });
        expect(yield* realmOf(quest.missionId)).toBeNull();
      }),
    ),
  );

  it.live("leaves a quest as it is when moved to where it already stands", () =>
    withService(({ garden }) =>
      Effect.gen(function* () {
        const gardenId = yield* makeRealm("Garden", garden);
        const quest = yield* call({ _tag: "StartEmptyQuest", realmId: gardenId, requestId: "q5" });
        yield* call({ _tag: "MoveQuest", missionId: quest.missionId, realmId: gardenId });
        expect(yield* realmOf(quest.missionId)).toBe(gardenId);
      }),
    ),
  );

  it.live(
    "keeps the harness session across a move, which still gives the thread its new folder and a journal line",
    () =>
      withService(({ garden }) =>
        Effect.gen(function* () {
          const gardenId = yield* makeRealm("Garden", garden);
          const quest = yield* call({ _tag: "StartEmptyQuest", realmId: null, requestId: "q6" });
          const { threadId } = quest;
          yield* send(threadId, "runner");
          yield* settle(quest.missionId, (detail) => detail.messages.length === 2 && idle(detail));

          yield* call({ _tag: "MoveQuest", missionId: quest.missionId, realmId: gardenId });
          yield* send(threadId, "runner");
          const kept = yield* settle(quest.missionId, (detail) => detail.messages.length === 4 && idle(detail));
          expect(lastReplyOf(kept)).toBe(`Echo: claude/claude-sonnet-5-5/default/session fake-${threadId}`);

          yield* send(threadId, "cwd");
          const folder = yield* settle(quest.missionId, (detail) => detail.messages.length === 6 && idle(detail));
          expect(lastReplyOf(folder)).toBe(`Echo: ${garden}`);

          yield* send(threadId, "context");
          const context = yield* settle(quest.missionId, (detail) => detail.messages.length === 8 && idle(detail));
          expect(lastReplyOf(context)).toContain("Moved by the user from the Borderlands to Garden");
        }),
      ),
  );

  // A quest held in Attention because its realm's folder is gone stayed held after a move out of that realm, with its
  // message waiting and nothing to say so (the owner's quest moved from a realm whose folder had been deleted).
  it.live("frees a quest held for its missing folder, which then runs its waiting message at the destination", () =>
    withService(({ garden, workshop }) =>
      Effect.gen(function* () {
        const gardenId = yield* makeRealm("Garden", garden);
        const workshopId = yield* makeRealm("Workshop", workshop);
        const quest = yield* call({ _tag: "StartEmptyQuest", realmId: gardenId, requestId: "q1" });
        yield* send(quest.threadId, "Hello");
        yield* settle(quest.missionId, (detail) => detail.messages.length === 2 && idle(detail));
        rmSync(garden, { recursive: true });
        yield* send(quest.threadId, "Again");
        const held = yield* settle(quest.missionId, (detail) => detail.thread.state === "Attention");
        expect(held.thread.blocker).toBe("MissingWorkspace");

        yield* call({ _tag: "MoveQuest", missionId: quest.missionId, realmId: workshopId });

        const after = yield* settle(quest.missionId, (detail) => lastReplyOf(detail).includes("Again") && idle(detail));
        expect(after.thread.blocker).toBeNull();
      }),
    ),
  );

  it.live("reads the same threads at the destination: a moved quest lists under its new realm", () =>
    withService(({ garden, workshop }) =>
      Effect.gen(function* () {
        const gardenId = yield* makeRealm("Garden", garden);
        const workshopId = yield* makeRealm("Workshop", workshop);
        const started = yield* start("Hello", garden);
        yield* settle(started.missionId, idle);
        expect(yield* realmOf(started.missionId)).toBe(gardenId);
        yield* call({ _tag: "MoveQuest", missionId: started.missionId, realmId: workshopId });
        const filtered = yield* call({
          _tag: "ListMissions",
          isArchived: false,
          search: null,
          state: null,
          workspaceId: workshopId,
        });
        expect(filtered.missions.map((mission) => mission.id)).toEqual([started.missionId]);
      }),
    ),
  );
});
