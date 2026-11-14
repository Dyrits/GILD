import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { call, tool, withService } from "../fixtures/service.ts";

describe("recovering realms safely", () => {
  it.live("refuses a stale wipe when lore changed after the owner saw its preview", () =>
    withService(
      Effect.gen(function* () {
        yield* call({ _tag: "CreateRealm", crest: null, name: "Garden", path: null });
        const list = yield* call({
          _tag: "ListMissions",
          isArchived: false,
          search: null,
          state: null,
          workspaceId: null,
        });
        const realm = list.workspaces[0];
        if (realm === undefined) return yield* Effect.die("No realm");
        const quest = yield* call({ _tag: "StartEmptyQuest", realmId: realm.id, requestId: "quest" });
        yield* tool(quest.threadId, "save_intel", { kind: "fact", scope: "workspace", text: "A realm fact." });
        const original = yield* call({
          _tag: "ListIntel",
          scope: "Workspace",
          state: null,
          threadId: null,
          workspaceId: realm.id,
        });
        const entry = original.loreEntries[0];
        if (entry === undefined) return yield* Effect.die("No lore");
        const preview = yield* call({ _tag: "PreviewRealmArchive", workspaceId: realm.id });
        yield* call({ _tag: "ArchiveRealm", snapshot: preview.snapshot, workspaceId: realm.id });
        const wipe = yield* call({ _tag: "PreviewRealmArchive", workspaceId: realm.id });
        yield* call({ _tag: "EditIntel", loreEntryId: entry.id, text: "The updated realm fact." });
        expect(
          yield* Effect.flip(
            call({
              _tag: "RestoreRealm",
              appearance: null,
              shouldStartAfresh: true,
              snapshot: wipe.snapshot,
              workspaceId: realm.id,
            }),
          ),
        ).toMatchObject({ kind: "StaleVersion" });
        const after = yield* call({
          _tag: "ListIntel",
          scope: "Workspace",
          state: null,
          threadId: null,
          workspaceId: realm.id,
        });
        expect(after.loreEntries.map((value) => value.text)).toEqual(["The updated realm fact."]);
        expect(yield* call({ _tag: "ListArchivedRealms" })).toHaveLength(1);
      }),
    ),
  );

  it.live("ignores archived realm names when checking a new name but warns on restoring a collision", () =>
    withService(
      Effect.gen(function* () {
        yield* call({ _tag: "CreateRealm", crest: null, name: "Garden", path: null });
        const list = yield* call({
          _tag: "ListMissions",
          isArchived: false,
          search: null,
          state: null,
          workspaceId: null,
        });
        const realm = list.workspaces[0];
        if (realm === undefined) return yield* Effect.die("No realm");
        const preview = yield* call({ _tag: "PreviewRealmArchive", workspaceId: realm.id });
        yield* call({ _tag: "ArchiveRealm", snapshot: preview.snapshot, workspaceId: realm.id });
        yield* call({ _tag: "CreateRealm", crest: null, name: "Garden", path: null });
        const recovery = yield* call({ _tag: "PreviewRealmArchive", workspaceId: realm.id });
        const restore = {
          _tag: "RestoreRealm" as const,
          appearance: null,
          shouldStartAfresh: false,
          snapshot: recovery.snapshot,
          workspaceId: realm.id,
        };
        expect(yield* Effect.flip(call(restore))).toMatchObject({ kind: "InvalidInput" });
        yield* call({ ...restore, allowDuplicateName: true });
        expect(yield* call({ _tag: "ListArchivedRealms" })).toEqual([]);
      }),
    ),
  );
});
