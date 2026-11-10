// Reading and comparing the versions harnesses report (provider-accounts, update a harness).

/** The `major.minor.patch` inside a harness's version text, such as "2.1.311 (Claude Code)", "codex-cli 0.160.1", or "opencode v2.2.0"; null when there is none. */
export const versionOf = (text: string | null): string | null => /\d+\.\d+\.\d+/.exec(text ?? "")?.[0] ?? null;

/** Whether `latest` is a higher release than `installed`, comparing their numbers part by part. */
export const isNewerVersion = (latest: string, installed: string): boolean => {
  const latestParts = latest.split(".").map(Number);
  const installedParts = installed.split(".").map(Number);
  for (const [index, part] of latestParts.entries()) {
    const other = installedParts[index] ?? 0;
    if (part !== other) return part > other;
  }
  return false;
};

/** The newer version to offer for an installed harness, or null when it is up to date or either version is unreadable. */
export const updateOf = (installed: string | null, latest: string | null): string | null => {
  const installedVersion = versionOf(installed);
  const latestVersion = versionOf(latest);
  return installedVersion !== null && latestVersion !== null && isNewerVersion(latestVersion, installedVersion)
    ? latestVersion
    : null;
};
