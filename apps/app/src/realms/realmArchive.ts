import type { MissionId, RealmArchiveQuest } from "@iskios/contracts";

/** Keeps only choices the refreshed archive preview still offers and allows to move. */
export const retainedArchiveChoicesOf = (
  selected: ReadonlySet<MissionId>,
  quests: ReadonlyArray<Pick<RealmArchiveQuest, "id" | "isWorking">>,
): ReadonlySet<MissionId> => {
  const offered = new Set(quests.filter((quest) => !quest.isWorking).map((quest) => quest.id));
  return new Set([...selected].filter((id) => offered.has(id)));
};

/** The confirming button says what it does beyond archiving. */
export const archiveLabelOf = (workingCount: number, movedCount: number) =>
  `${workingCount > 0 ? "Stop and archive realm" : "Archive realm"}${movedCount > 0 ? `, move ${movedCount}` : ""}`;

/** Archived realm records whose names contain the owner's search, ignoring case and surrounding search whitespace. */
export const matchingArchivedRealmsOf = <Preview extends { realm: { name: string } }>(
  previews: ReadonlyArray<Preview>,
  search: string,
): Array<Preview> =>
  previews.filter((preview) => preview.realm.name.toLowerCase().includes(search.trim().toLowerCase()));
