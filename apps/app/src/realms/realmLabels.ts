import type { WorkspaceChoice } from "@iskios/contracts";

/** A folder's final segment, accepting both desktop path separators. */
export const folderNameOf = (path: string) =>
  path
    .split(/[\\/]/)
    .filter((part) => part !== "")
    .at(-1) ?? path;

/** Whether a different active realm already carries the proposed label. */
export const hasRealmNameCollision = (
  name: string,
  realms: ReadonlyArray<WorkspaceChoice>,
  exceptId: string | null = null,
) => realms.some((realm) => realm.id !== exceptId && realm.name.trim().toLowerCase() === name.trim().toLowerCase());

/** Distinguishes duplicate active folder-realm labels while leaving unique and untied labels alone. */
export const realmLabelOf = (realm: WorkspaceChoice, realms: ReadonlyArray<WorkspaceChoice>): string => {
  if (realm.path === null || !hasRealmNameCollision(realm.name, realms, realm.id)) return realm.name;
  const parts = realm.path.split(/[\\/]/).filter((part) => part !== "");
  return `${realm.name} · ${parts.at(-2) ?? realm.path}`;
};
