import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { call, read, tool, withService } from "../fixtures/service.ts";

const list = (isArchived = false) =>
  call({ _tag: "ListMissions", isArchived, search: null, state: null, workspaceId: null });

describe("archiving and restoring realms", () => {
  it.live("restores the realm's quests without reopening a previously archived quest", () =>
    withService(
      Effect.gen(function* () {
        yield* call({ _tag: "CreateRealm", crest: null, name: "Garden", path: null });
        const realm = (yield* list()).workspaces[0];
        if (realm === undefined) return yield* Effect.die("No realm");
        const active = yield* call({ _tag: "StartEmptyQuest", realmId: realm.id, requestId: "active" });
        const archived = yield* call({ _tag: "StartEmptyQuest", realmId: realm.id, requestId: "archived" });
        const ending = yield* call({ _tag: "PreviewEnding", ending: "Archived", missionId: archived.missionId });
        yield* call({
          _tag: "EndMission",
          ending: "Archived",
          missionId: archived.missionId,
          snapshot: ending.snapshot,
        });
        const preview = yield* call({ _tag: "PreviewRealmArchive", workspaceId: realm.id });
        expect(preview.questCount).toBe(2);
        expect((yield* list()).missions).toHaveLength(1);
        yield* call({ _tag: "ArchiveRealm", snapshot: preview.snapshot, workspaceId: realm.id });
        expect((yield* list()).workspaces).toEqual([]);
        expect((yield* list()).missions).toEqual([]);
        const saved = yield* call({ _tag: "ListArchivedRealms" });
        expect(saved[0]?.realm.id).toBe(realm.id);
        const recovery = saved[0];
        if (recovery === undefined) return yield* Effect.die("No archived realm");
        yield* call({
          _tag: "RestoreRealm",
          appearance: null,
          shouldStartAfresh: false,
          snapshot: recovery.snapshot,
          workspaceId: realm.id,
        });
        expect((yield* list()).missions.map((quest) => quest.id)).toEqual([active.missionId]);
        expect((yield* read(archived.missionId)).mission.state).toBe("Archived");
        expect((yield* list()).workspaces[0]?.id).toBe(realm.id);
      }),
    ),
  );

  it.live("refuses implicit reuse of an archived folder or work in its hidden quests", () =>
    withService(
      Effect.gen(function* () {
        const roots = yield* call({ _tag: "BrowseFolders", path: null, shouldIncludeHidden: false });
        const path = roots.folders[0]?.path;
        if (path === undefined) return yield* Effect.die("No folder");
        yield* call({ _tag: "CreateRealm", crest: null, name: "Garden", path });
        const realm = (yield* list()).workspaces[0];
        if (realm === undefined) return yield* Effect.die("No realm");
        const quest = yield* call({ _tag: "StartEmptyQuest", realmId: realm.id, requestId: "quest" });
        const preview = yield* call({ _tag: "PreviewRealmArchive", workspaceId: realm.id });
        yield* call({ _tag: "ArchiveRealm", snapshot: preview.snapshot, workspaceId: realm.id });
        expect(yield* Effect.flip(call({ _tag: "CreateRealm", crest: null, name: "New garden", path }))).toMatchObject({
          kind: "InvalidInput",
        });
        expect(
          yield* Effect.flip(
            call({
              _tag: "StartEmptyQuest",
              realmId: realm.id,
              requestId: "hidden",
            }),
          ),
        ).toMatchObject({ kind: "InvalidInput" });
        expect(
          yield* Effect.flip(
            call({
              _tag: "SendMessage",
              delivery: null,
              requestId: "hidden-message",
              text: "hello",
              threadId: quest.threadId,
            }),
          ),
        ).toMatchObject({ kind: "InvalidInput" });
        expect(yield* Effect.flip(call({ _tag: "ReopenMission", missionId: quest.missionId }))).toMatchObject({
          kind: "InvalidInput",
        });
        expect((yield* call({ _tag: "FindArchivedRealm", path }))?.realm.id).toBe(realm.id);
        expect((yield* list()).missions).toEqual([]);
      }),
    ),
  );

  it.live("requires confirmation before creating or renaming to a duplicate active name", () =>
    withService(
      Effect.gen(function* () {
        yield* call({ _tag: "CreateRealm", crest: null, name: "Garden", path: null });
        expect(
          yield* Effect.flip(call({ _tag: "CreateRealm", crest: null, name: "garden", path: null })),
        ).toMatchObject({ kind: "InvalidInput", message: expect.stringContaining("active realm") });
        yield* call({ _tag: "CreateRealm", allowDuplicateName: true, crest: null, name: "Garden", path: null });
        yield* call({ _tag: "CreateRealm", crest: null, name: "Notes", path: null });
        const notes = (yield* list()).workspaces.find((realm) => realm.name === "Notes");
        if (notes === undefined) return yield* Effect.die("No notes realm");
        expect(yield* Effect.flip(call({ _tag: "RenameRealm", name: "Garden", workspaceId: notes.id }))).toMatchObject({
          kind: "InvalidInput",
        });
        yield* call({ _tag: "RenameRealm", allowDuplicateName: true, name: "Garden", workspaceId: notes.id });
        expect((yield* list()).workspaces).toHaveLength(3);
      }),
    ),
  );

  it.live("starts afresh with only realm lore deleted recoverably and all old quests archived", () =>
    withService(
      Effect.gen(function* () {
        yield* call({ _tag: "CreateRealm", crest: null, name: "Garden", path: null });
        const realm = (yield* list()).workspaces[0];
        if (realm === undefined) return yield* Effect.die("No realm");
        const quest = yield* call({ _tag: "StartEmptyQuest", realmId: realm.id, requestId: "quest" });
        yield* tool(quest.threadId, "save_intel", { kind: "fact", scope: "workspace", text: "Realm fact." });
        yield* tool(quest.threadId, "save_intel", { kind: "fact", scope: "mission", text: "Quest fact." });
        const preview = yield* call({ _tag: "PreviewRealmArchive", workspaceId: realm.id });
        expect(preview.loreCount).toBe(1);
        yield* call({ _tag: "ArchiveRealm", snapshot: preview.snapshot, workspaceId: realm.id });
        const saved = yield* call({ _tag: "PreviewRealmArchive", workspaceId: realm.id });
        yield* call({
          _tag: "RestoreRealm",
          appearance: { crest: null, name: "Fresh garden" },
          shouldStartAfresh: true,
          snapshot: saved.snapshot,
          workspaceId: realm.id,
        });
        expect((yield* list()).workspaces[0]).toMatchObject({ id: realm.id, name: "Fresh garden" });
        expect((yield* list()).missions).toEqual([]);
        expect((yield* read(quest.missionId)).mission.state).toBe("Archived");
        const current = yield* call({
          _tag: "ListIntel",
          scope: null,
          state: null,
          threadId: quest.threadId,
        });
        expect(current.loreEntries.map((entry) => entry.text)).toEqual(["Quest fact."]);
        const deleted = yield* call({
          _tag: "ListIntel",
          scope: "Workspace",
          state: "Deleted",
          threadId: null,
          workspaceId: realm.id,
        });
        const entry = deleted.deleted[0];
        if (entry === undefined) return yield* Effect.die("No deleted lore");
        const history = yield* call({ _tag: "ReadIntelHistory", loreEntryId: entry.id });
        const removal = history.entries.find((change) => change.kind === "Deleted");
        if (removal === undefined) return yield* Effect.die("No deletion history");
        yield* call({ _tag: "UndoIntelChange", entryId: removal.id });
        expect((yield* call({ _tag: "PreviewRealmArchive", workspaceId: realm.id })).loreCount).toBe(1);
      }),
    ),
  );
});
