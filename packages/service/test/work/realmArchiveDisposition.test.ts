import { describe, expect, it } from "@effect/vitest";
import type { RitualCompanion } from "@iskios/contracts";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { call, fixture, read, settle } from "../fixtures/service.ts";

const list = () => call({ _tag: "ListMissions", isArchived: false, search: null, state: null, workspaceId: null });
const listArchived = () =>
  call({ _tag: "ListMissions", isArchived: true, search: null, state: null, workspaceId: null });
const claude: RitualCompanion = { accountId: null, effort: "default", harness: "claude", model: "claude-sonnet-5-5" };
const fixtures: ReturnType<typeof fixture>[] = [];
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

/** A realm tied to the fixture's folder, so a Ritual can be made in it. */
const createFolderRealm = Effect.fnUntraced(function* (path: string) {
  yield* call({ _tag: "CreateRealm", crest: null, name: "Garden", path });
  const realm = (yield* list()).workspaces[0];
  if (realm === undefined) return yield* Effect.die("No realm");
  return realm;
});

const createRitual = (path: string, instruction = "Hello") =>
  call({
    _tag: "CreateRitual",
    fallbacks: [],
    instruction,
    primary: claude,
    requestId: crypto.randomUUID(),
    schedule: { _tag: "Daily", time: "07:00" },
    title: "Morning digest",
    workspacePath: path,
  });

const runWithFolder = <Value, Failure, Requirements>(
  body: (path: string) => Effect.Effect<Value, Failure, Requirements>,
) => {
  const value = fixture();
  fixtures.push(value);
  return body(value.directory).pipe(Effect.provide(value.layer));
};

describe("choosing what a realm archive does with its quests and Rituals", () => {
  it.live("lists the active quests by title and the Rituals apart from them", () =>
    runWithFolder((path) =>
      Effect.gen(function* () {
        const realm = yield* createFolderRealm(path);
        const quest = yield* call({ _tag: "StartEmptyQuest", realmId: realm.id, requestId: "one" });
        yield* call({ _tag: "RenameMission", missionId: quest.missionId, title: "Plant the beans" });
        const ritual = yield* createRitual(path);
        const preview = yield* call({ _tag: "PreviewRealmArchive", workspaceId: realm.id });
        expect(preview.quests).toEqual([{ id: quest.missionId, isWorking: false, title: "Plant the beans" }]);
        expect(preview.questCount).toBe(1);
        expect(preview.rituals).toEqual([{ id: ritual.ritualId, isOn: true, title: "Morning digest" }]);
      }),
    ),
  );

  it.live("moves the chosen quests to the Borderlands and archives the others with the realm", () =>
    runWithFolder((path) =>
      Effect.gen(function* () {
        const realm = yield* createFolderRealm(path);
        const keep = yield* call({ _tag: "StartEmptyQuest", realmId: realm.id, requestId: "keep" });
        const leave = yield* call({ _tag: "StartEmptyQuest", realmId: realm.id, requestId: "leave" });
        const preview = yield* call({ _tag: "PreviewRealmArchive", workspaceId: realm.id });
        yield* call({
          _tag: "ArchiveRealm",
          movedQuestIds: [keep.missionId],
          snapshot: preview.snapshot,
          workspaceId: realm.id,
        });
        const active = (yield* list()).missions;
        expect(active.map((quest) => quest.id)).toEqual([keep.missionId]);
        expect(active[0]?.workspaceId).toBeNull();
        expect((yield* listArchived()).missions.map((quest) => quest.id)).toEqual([leave.missionId]);
        // Restoring the realm does not pull the moved quest back.
        const saved = (yield* call({ _tag: "ListArchivedRealms" }))[0];
        if (saved === undefined) return yield* Effect.die("No archived realm");
        yield* call({
          _tag: "RestoreRealm",
          appearance: null,
          shouldStartAfresh: false,
          snapshot: saved.snapshot,
          workspaceId: realm.id,
        });
        expect((yield* list()).missions.find((quest) => quest.id === keep.missionId)?.workspaceId).toBeNull();
        expect((yield* list()).missions.find((quest) => quest.id === leave.missionId)?.workspaceId).toBe(realm.id);
      }),
    ),
  );

  it.live("refuses to move a quest at work, a stranger, or a Ritual's quest, and changes nothing", () =>
    runWithFolder((path) =>
      Effect.gen(function* () {
        const realm = yield* createFolderRealm(path);
        const working = yield* call({ _tag: "StartEmptyQuest", realmId: realm.id, requestId: "work" });
        yield* call({
          _tag: "SendMessage",
          delivery: null,
          requestId: "go",
          text: "wait 5000",
          threadId: working.threadId,
        });
        yield* settle(working.missionId, (detail) => detail.thread.state === "Running");
        const stranger = yield* call({ _tag: "StartEmptyQuest", realmId: null, requestId: "free" });
        const ritual = yield* createRitual(path);
        const preview = yield* call({ _tag: "PreviewRealmArchive", workspaceId: realm.id });
        expect(preview.quests.find((quest) => quest.id === working.missionId)?.isWorking).toBe(true);
        for (const id of [working.missionId, stranger.missionId, ritual.missionId]) {
          expect(
            yield* Effect.flip(
              call({ _tag: "ArchiveRealm", movedQuestIds: [id], snapshot: preview.snapshot, workspaceId: realm.id }),
            ),
          ).toMatchObject({ kind: "InvalidInput" });
        }
        expect((yield* list()).workspaces.map((each) => each.id)).toEqual([realm.id]);
        expect((yield* read(working.missionId)).thread.state).toBe("Running");
      }),
    ),
  );

  it.live("switches the realm's Rituals off, keeps them and their quests, and leaves them off after a restore", () =>
    runWithFolder((path) =>
      Effect.gen(function* () {
        const realm = yield* createFolderRealm(path);
        const ritual = yield* createRitual(path);
        const preview = yield* call({ _tag: "PreviewRealmArchive", workspaceId: realm.id });
        yield* call({ _tag: "ArchiveRealm", snapshot: preview.snapshot, workspaceId: realm.id });
        const archived = yield* call({ _tag: "ReadRitual", missionId: ritual.missionId });
        expect(archived).toMatchObject({ isOn: false, isRealmArchived: true, nextRunAt: null });
        expect((yield* listArchived()).missions).toEqual([]);
        // Neither the switch nor a manual run works until the realm is restored.
        const update = (isOn: boolean) =>
          call({
            _tag: "UpdateRitual",
            fallbacks: [],
            instruction: archived?.instruction ?? "",
            isOn,
            primary: claude,
            ritualId: ritual.ritualId,
            schedule: { _tag: "Daily", time: "07:00" },
            title: "Morning digest",
          });
        expect(yield* Effect.flip(update(true))).toMatchObject({ kind: "InvalidInput" });
        expect(yield* Effect.flip(call({ _tag: "RunRitual", ritualId: ritual.ritualId }))).toMatchObject({
          kind: "InvalidInput",
        });
        const saved = (yield* call({ _tag: "ListArchivedRealms" }))[0];
        if (saved === undefined) return yield* Effect.die("No archived realm");
        yield* call({
          _tag: "RestoreRealm",
          appearance: null,
          shouldStartAfresh: true,
          snapshot: saved.snapshot,
          workspaceId: realm.id,
        });
        expect(yield* call({ _tag: "ReadRitual", missionId: ritual.missionId })).toMatchObject({
          isOn: false,
          isRealmArchived: false,
        });
        yield* update(true);
        expect((yield* call({ _tag: "ReadRitual", missionId: ritual.missionId }))?.isOn).toBe(true);
      }),
    ),
  );

  it.live("stops a Ritual's run underway and counts it among the threads at work", () =>
    runWithFolder((path) =>
      Effect.gen(function* () {
        const realm = yield* createFolderRealm(path);
        const ritual = yield* createRitual(path, "wait 5000");
        yield* call({ _tag: "RunRitual", ritualId: ritual.ritualId });
        yield* settle(ritual.missionId, (detail) => detail.thread.state === "Running");
        const preview = yield* call({ _tag: "PreviewRealmArchive", workspaceId: realm.id });
        expect(preview.workingCount).toBe(1);
        yield* call({ _tag: "ArchiveRealm", snapshot: preview.snapshot, workspaceId: realm.id });
        expect((yield* read(ritual.missionId)).thread.state).toBe("Stopped");
      }),
    ),
  );
});
