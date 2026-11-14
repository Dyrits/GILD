import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { call, fixture, open, read, send, settle, withService } from "../fixtures/service.ts";

const list = () => call({ _tag: "ListMissions", isArchived: false, search: null, state: null, workspaceId: null });
const create = Effect.gen(function* () {
  yield* call({ _tag: "CreateRealm", crest: null, name: "Garden", path: null });
  const realm = (yield* list()).workspaces[0];
  if (realm === undefined) return yield* Effect.die("No realm");
  return realm;
});
const fixtures: ReturnType<typeof fixture>[] = [];
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

describe("confirming a realm archive safely", () => {
  it.live("returns the quest's current parent when it moved after its ending preview", () =>
    withService(
      Effect.gen(function* () {
        const source = yield* create;
        yield* call({ _tag: "CreateRealm", crest: null, name: "Notes", path: null });
        const destination = (yield* list()).workspaces.find((realm) => realm.name === "Notes");
        if (destination === undefined) return yield* Effect.die("No destination");
        const quest = yield* call({ _tag: "StartEmptyQuest", realmId: source.id, requestId: "new" });
        const preview = yield* call({ _tag: "PreviewEnding", ending: "Archived", missionId: quest.missionId });
        yield* call({ _tag: "MoveQuest", missionId: quest.missionId, realmId: destination.id });
        const parent = yield* call({
          _tag: "EndMission",
          ending: "Archived",
          missionId: quest.missionId,
          snapshot: preview.snapshot,
        });
        expect(parent).toEqual({ workspaceId: destination.id, workspaceName: "Notes" });
      }),
    ),
  );

  it.live("refuses a stale confirmation when an idle side-quest is added behind the running limit", () =>
    withService(
      Effect.gen(function* () {
        const realm = yield* create;
        const quest = yield* call({ _tag: "StartEmptyQuest", realmId: realm.id, requestId: "new" });
        for (let index = 0; index < 8; index++) {
          const side = yield* open(quest.threadId, "wait 10000");
          yield* settle(quest.missionId, (detail) => detail.thread.state === "Running", side.threadId);
        }
        const preview = yield* call({ _tag: "PreviewRealmArchive", workspaceId: realm.id });
        const idle = yield* open(quest.threadId, "Waiting for a running slot");
        expect((yield* read(quest.missionId, idle.threadId)).thread.state).toBe("Idle");
        expect(
          yield* Effect.flip(call({ _tag: "ArchiveRealm", snapshot: preview.snapshot, workspaceId: realm.id })),
        ).toMatchObject({ kind: "StaleVersion" });
      }),
    ),
  );

  it.live("refuses stale quest counts without hiding or archiving anything", () =>
    withService(
      Effect.gen(function* () {
        const realm = yield* create;
        const preview = yield* call({ _tag: "PreviewRealmArchive", workspaceId: realm.id });
        const quest = yield* call({ _tag: "StartEmptyQuest", realmId: realm.id, requestId: "new" });
        expect(
          yield* Effect.flip(call({ _tag: "ArchiveRealm", snapshot: preview.snapshot, workspaceId: realm.id })),
        ).toMatchObject({ kind: "StaleVersion" });
        expect((yield* list()).workspaces).toHaveLength(1);
        expect((yield* read(quest.missionId)).mission.state).toBe("Idle");
      }),
    ),
  );

  it.live("rechecks and stops working side-quests at every depth", () =>
    withService(
      Effect.gen(function* () {
        const realm = yield* create;
        const quest = yield* call({ _tag: "StartEmptyQuest", realmId: realm.id, requestId: "new" });
        const preview = yield* call({ _tag: "PreviewRealmArchive", workspaceId: realm.id });
        const side = yield* open(quest.threadId, "wait 5000");
        const deep = yield* open(side.threadId, "wait 5000");
        yield* settle(quest.missionId, (detail) => detail.thread.state === "Running", deep.threadId);
        expect(
          yield* Effect.flip(call({ _tag: "ArchiveRealm", snapshot: preview.snapshot, workspaceId: realm.id })),
        ).toMatchObject({ kind: "StaleVersion" });
        const current = yield* call({ _tag: "PreviewRealmArchive", workspaceId: realm.id });
        expect(current.workingCount).toBeGreaterThanOrEqual(2);
        yield* call({ _tag: "ArchiveRealm", snapshot: current.snapshot, workspaceId: realm.id });
        expect((yield* read(quest.missionId, side.threadId)).thread.state).toBe("Stopped");
        expect((yield* read(quest.missionId, deep.threadId)).thread.state).toBe("Stopped");
      }),
    ),
  );

  it.live("keeps a folder realm and its individual quest archives through a service restart", () => {
    const value = fixture();
    fixtures.push(value);
    const filename = join(value.directory, "keep.txt");
    writeFileSync(filename, "keep this file");
    return Effect.gen(function* () {
      const original = yield* Effect.gen(function* () {
        yield* call({ _tag: "CreateRealm", crest: null, name: "Folder garden", path: value.directory });
        const realm = (yield* list()).workspaces[0];
        if (realm === undefined) return yield* Effect.die("No realm");
        const quest = yield* call({ _tag: "StartEmptyQuest", realmId: realm.id, requestId: "new" });
        yield* send(quest.threadId, "A saved conversation");
        yield* settle(quest.missionId, (detail) => detail.thread.state === "Idle" && detail.messages.length === 2);
        const preview = yield* call({ _tag: "PreviewRealmArchive", workspaceId: realm.id });
        yield* call({ _tag: "ArchiveRealm", snapshot: preview.snapshot, workspaceId: realm.id });
        return { quest, realm };
      }).pipe(Effect.provide(value.layer));
      yield* Effect.gen(function* () {
        const realms = yield* call({ _tag: "ListArchivedRealms" });
        const saved = realms[0];
        if (saved === undefined) return yield* Effect.die("Archive did not survive restart");
        expect(saved.realm).toEqual(original.realm);
        expect((yield* read(original.quest.missionId)).messages).toHaveLength(2);
        yield* call({
          _tag: "RestoreRealm",
          appearance: null,
          shouldStartAfresh: false,
          snapshot: saved.snapshot,
          workspaceId: original.realm.id,
        });
        expect((yield* list()).missions[0]?.id).toBe(original.quest.missionId);
        expect(existsSync(filename)).toBe(true);
      }).pipe(Effect.provide(value.layer));
    });
  });
});
