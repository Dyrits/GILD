import { Schema } from "effect";
import { Crest } from "./crest.ts";
import { MissionId, RitualId, WorkspaceId } from "./ids.ts";
import { WorkspaceChoice } from "./workspaces.ts";

/** The independently chosen name and crest for a recovered realm. */
export const RealmAppearance = Schema.Struct({ crest: Schema.NullOr(Crest), name: Schema.String });
export type RealmAppearance = typeof RealmAppearance.Type;

/** A quest's authoritative parent placement when an ending commits. */
export const QuestPlacement = Schema.Struct({
  workspaceId: Schema.NullOr(WorkspaceId),
  workspaceName: Schema.NullOr(Schema.String),
});
export type QuestPlacement = typeof QuestPlacement.Type;

/** An active quest the owner can choose to move to the Borderlands instead of archiving it with its realm. */
export const RealmArchiveQuest = Schema.Struct({ id: MissionId, isWorking: Schema.Boolean, title: Schema.String });
export type RealmArchiveQuest = typeof RealmArchiveQuest.Type;

/** A Ritual of the realm, which an archive switches off and keeps. */
export const RealmArchiveRitual = Schema.Struct({ id: RitualId, isOn: Schema.Boolean, title: Schema.String });
export type RealmArchiveRitual = typeof RealmArchiveRitual.Type;

/** A realm's archive state and the exact contents a confirmation covers. */
export const RealmArchivePreview = Schema.Struct({
  archivedAt: Schema.NullOr(Schema.Number),
  loreCount: Schema.Int,
  /** Every quest of the realm, archived earlier or not; Rituals' quests are not among them. */
  questCount: Schema.Int,
  /** The quests an archive would still end: the owner may move any that is not at work to the Borderlands. */
  quests: Schema.Array(RealmArchiveQuest),
  realm: WorkspaceChoice,
  rituals: Schema.Array(RealmArchiveRitual),
  snapshot: Schema.String,
  workingCount: Schema.Int,
});
export type RealmArchivePreview = typeof RealmArchivePreview.Type;

/** Makes a realm, asking before a duplicate active name is accepted. */
export const CreateRealm = Schema.TaggedStruct("CreateRealm", {
  ...RealmAppearance.fields,
  allowDuplicateName: Schema.optional(Schema.Boolean),
  path: Schema.NullOr(Schema.String),
});
/** Renames a realm without treating its name as its identity. */
export const RenameRealm = Schema.TaggedStruct("RenameRealm", {
  allowDuplicateName: Schema.optional(Schema.Boolean),
  name: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(80)),
  workspaceId: WorkspaceId,
});
/** Keeps the owner's crest for a realm. */
export const SetRealmCrest = Schema.TaggedStruct("SetRealmCrest", {
  crest: Schema.NullOr(Crest),
  workspaceId: WorkspaceId,
});
/** Previews the quests, lore and working threads covered by a realm archive. */
export const PreviewRealmArchive = Schema.TaggedStruct("PreviewRealmArchive", { workspaceId: WorkspaceId });
/**
 * Archives a realm only when its confirmed contents are unchanged: the quests named in `movedQuestIds` go to the
 * Borderlands with their trees, the others are archived with the realm, and its Rituals are switched off.
 */
export const ArchiveRealm = Schema.TaggedStruct("ArchiveRealm", {
  movedQuestIds: Schema.optional(Schema.Array(MissionId)),
  snapshot: Schema.String,
  workspaceId: WorkspaceId,
});
/** Lists archived realms, including empty ones, for recovery. */
export const ListArchivedRealms = Schema.TaggedStruct("ListArchivedRealms", {});
/** Finds an archived realm by the chosen folder's resolved path. */
export const FindArchivedRealm = Schema.TaggedStruct("FindArchivedRealm", { path: Schema.String });
/** Restores a realm or starts it afresh with old quests kept archived and recoverably deleted realm lore. */
export const RestoreRealm = Schema.TaggedStruct("RestoreRealm", {
  allowDuplicateName: Schema.optional(Schema.Boolean),
  appearance: Schema.NullOr(RealmAppearance),
  shouldStartAfresh: Schema.Boolean,
  snapshot: Schema.String,
  workspaceId: WorkspaceId,
});

/** Realm lifecycle requests kept together at the transport boundary. */
export const realmRequests = [
  CreateRealm,
  RenameRealm,
  SetRealmCrest,
  PreviewRealmArchive,
  ArchiveRealm,
  ListArchivedRealms,
  FindArchivedRealm,
  RestoreRealm,
] as const;
/** The wire result of each realm lifecycle request. */
export const realmResults = {
  ArchiveRealm: Schema.Null,
  CreateRealm: Schema.Null,
  FindArchivedRealm: Schema.NullOr(RealmArchivePreview),
  ListArchivedRealms: Schema.Array(RealmArchivePreview),
  PreviewRealmArchive: RealmArchivePreview,
  RenameRealm: Schema.Null,
  RestoreRealm: Schema.Null,
  SetRealmCrest: Schema.Null,
};
