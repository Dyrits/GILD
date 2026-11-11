import type { MissionSummary, WorkspaceId } from "@iskios/contracts";

// Moving a quest by dragging it in the sidebar (mission-tracking, Quest placement and moves): what a drop means and what
// the owner is asked to confirm. Nothing here moves a quest; the service does, once the owner confirms.

/** A place a quest can be moved to: a realm, or null id for the Borderlands. */
export interface Destination {
  readonly id: WorkspaceId | null;
  readonly name: string;
}

/** The Borderlands, as a destination. */
export const borderlandsDestination: Destination = { id: null, name: "the Borderlands" };

/** The name of the place a quest stands in now. */
export const sourceNameOf = (mission: Pick<MissionSummary, "workspaceName">): string =>
  mission.workspaceName ?? borderlandsDestination.name;

/** What the owner confirms before a move, naming the source and the destination and the change of lore. */
export interface MoveConfirmation {
  readonly body: string;
  readonly title: string;
}

/**
 * The confirmation for dropping a quest on a place, or null when it already stands there and a drop changes nothing.
 * The same words serve every move, including one into the Borderlands.
 */
export const moveConfirmationOf = (
  mission: Pick<MissionSummary, "title" | "workspaceId" | "workspaceName">,
  destination: Destination,
): MoveConfirmation | null => {
  if (mission.workspaceId === destination.id) return null;
  const source = sourceNameOf(mission);
  return {
    body: [
      `The quest and all its side-quests move from ${source} to ${destination.name}.`,
      `The lore shared in ${source} will no longer be available to them, and the lore shared in ${destination.name} will be. Lore is not copied.`,
      "Its conversation, journal, and own lore stay with the quest. Files, edits, and branches stay where they are.",
    ].join("\n\n"),
    title: `Move "${mission.title}" to ${destination.name}?`,
  };
};
