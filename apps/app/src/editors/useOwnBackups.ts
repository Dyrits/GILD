import type { BackupCompanion } from "@iskios/contracts";
import { useState } from "react";
import { isSameBackups } from "./presets";

/**
 * A backup list the owner edits against the saved one: the edit shows until the saved list changes from what the edit began with, as when a preset is chosen elsewhere, and then the saved list shows.
 * Saving the edit makes the saved list equal to it, so the editor shows the same list before and after the save arrives.
 */
export function useOwnBackups(saved: ReadonlyArray<BackupCompanion>) {
  const [own, setOwn] = useState<{
    editedFrom: ReadonlyArray<BackupCompanion>;
    value: ReadonlyArray<BackupCompanion>;
  } | null>(null);
  return {
    backups: own !== null && isSameBackups(own.editedFrom, saved) ? own.value : saved,
    discard: () => setOwn(null),
    edit: (value: ReadonlyArray<BackupCompanion>) => setOwn({ editedFrom: saved, value }),
  };
}
