import type { WorkspaceChoice } from "@iskios/contracts";

/**
 * The realms tied to a folder, by name. A quest is placed by its realm's folder, so a realm tied to no folder is not
 * offered where a quest starts or is proposed yet (CHG-0161, decision record 0015).
 */
export const tiedRealmsOf = (realms: ReadonlyArray<WorkspaceChoice>) =>
  realms
    .filter((realm): realm is WorkspaceChoice & { readonly path: string } => realm.path !== null)
    .sort((current, next) => current.name.localeCompare(next.name));
