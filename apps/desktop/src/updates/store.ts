import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** What the app keeps about updates on this computer: the owner's switch and when it last checked. */
export type UpdateSettings = { readonly isEnabled: boolean; readonly lastCheckedAt: number | null };

const defaults: UpdateSettings = { isEnabled: true, lastCheckedAt: null };

/** Reads the saved settings; a missing or unreadable file means the defaults, so checking starts on. */
export const readUpdateSettings = (file: string): UpdateSettings => {
  try {
    const saved: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (typeof saved !== "object" || saved === null) return defaults;
    const isEnabled = "isEnabled" in saved ? saved.isEnabled : null;
    const lastCheckedAt = "lastCheckedAt" in saved ? saved.lastCheckedAt : null;
    return {
      isEnabled: typeof isEnabled === "boolean" ? isEnabled : defaults.isEnabled,
      lastCheckedAt: typeof lastCheckedAt === "number" ? lastCheckedAt : null,
    };
  } catch {
    return defaults;
  }
};

/** Saves the settings beside the app's data. */
export const writeUpdateSettings = (file: string, settings: UpdateSettings) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(settings));
};
