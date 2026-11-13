import type { UpdateState } from "./updateState";

/** The words for how long ago a check ended, in the coarsest unit that is not zero. */
export const lastCheckedTextOf = (lastCheckedAt: number | null, now: number): string => {
  if (lastCheckedAt === null) return "Not checked yet.";
  const minutes = Math.floor(Math.max(0, now - lastCheckedAt) / 60_000);
  if (minutes < 1) return "Last checked just now.";
  if (minutes < 60) return `Last checked ${minutes} minute${minutes === 1 ? "" : "s"} ago.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last checked ${hours} hour${hours === 1 ? "" : "s"} ago.`;
  const days = Math.floor(hours / 24);
  return `Last checked ${days} day${days === 1 ? "" : "s"} ago.`;
};

/** What the Updates section says about where an update stands, in one line. */
export const statusTextOf = (state: UpdateState): string => {
  const { status } = state;
  if (status._tag === "Unsupported") return status.reason;
  // An update already downloaded stays ready to install whether or not looking is still on.
  if (status._tag === "Ready") return `Iskios ${status.version} is downloaded and ready to install.`;
  if (!state.isEnabled) return "Looking for new releases is off. Iskios asks no one.";
  if (status._tag === "Checking") return "Looking for a newer release…";
  if (status._tag === "Downloading") return `Downloading ${status.version}: ${status.percent}%.`;
  if (status._tag === "Failed") return status.message;
  return status.note ?? "Iskios is up to date.";
};

/** Whether Check now does anything: checking is on and nothing is under way or waiting. */
export const canCheckNow = (state: UpdateState): boolean =>
  state.isEnabled && (state.status._tag === "Idle" || state.status._tag === "Failed");

/** What the confirmation before restarting says, so the owner knows what the restart costs. */
export const restartWarningOf = (version: string): string =>
  `Iskios quits and starts again as ${version}. Turns still running stop when it quits. A release can make what an earlier one saved unreadable, so read the notes above first.`;
