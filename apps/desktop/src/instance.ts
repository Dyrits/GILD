import { join } from "node:path";

/** What kind of instance this is: the installed app the owner works in, or a development or checking run. */
export interface InstanceInput {
  appData: string;
  /** An instance given its own data folder (`GILD_DATA_DIR`) is a throwaway one: checks, verification. */
  dataDirectory: string | undefined;
  hasProfileSwitch: boolean;
  isPackaged: boolean;
}

/** The name an instance runs under, and where Electron keeps its own profile (cache, local storage, session). */
export interface Instance {
  name: string;
  /** Null keeps Electron's default folder for that name. */
  profileFolder: string | null;
}

/**
 * Only the installed app is "Gild" and uses the default `Gild` profile and data folder. Every other run (`bun run
 * dev`, a check, a packaged build under test) is "Gild Dev" with a profile of its own, so none of them shares
 * localStorage, caches, or the single-instance lock with the owner's running app; one given a data folder keeps
 * its profile inside it. An explicit `--user-data-dir` wins.
 */
export const instanceOf = ({ appData, dataDirectory, hasProfileSwitch, isPackaged }: InstanceInput): Instance => {
  const isThrowaway = dataDirectory !== undefined && dataDirectory !== "";
  if (isPackaged && !isThrowaway) return { name: "Gild", profileFolder: null };
  if (hasProfileSwitch) return { name: "Gild Dev", profileFolder: null };
  return { name: "Gild Dev", profileFolder: isThrowaway ? join(dataDirectory, "profile") : join(appData, "Gild Dev") };
};
