/** A version split into its semantic-version parts; `null` when the text is not a version. */
type Version = { readonly core: readonly [number, number, number]; readonly prerelease: readonly string[] };

const versionPattern = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

/** Reads `1.2.3`, `v1.2.3-Prototype`, or `1.2.3-beta.1` as a version. */
export const parseVersion = (text: string): Version | null => {
  const match = versionPattern.exec(text.trim());
  if (match === null) return null;
  const [, major, minor, patch, prerelease] = match;
  return {
    core: [Number(major), Number(minor), Number(patch)],
    prerelease: prerelease === undefined ? [] : prerelease.split("."),
  };
};

const isNumeric = (identifier: string) => /^\d+$/.test(identifier);

const compareIdentifiers = (left: string, right: string) => {
  if (isNumeric(left) && isNumeric(right)) return Math.sign(Number(left) - Number(right));
  // A number ranks below a word, as in semantic versioning.
  if (isNumeric(left)) return -1;
  if (isNumeric(right)) return 1;
  return left < right ? -1 : left > right ? 1 : 0;
};

/** Orders two versions as semantic versioning does: a prerelease ranks below its release. Negative when `left` is older. */
export const compareVersions = (left: Version, right: Version) => {
  for (const index of [0, 1, 2] as const) {
    const difference = left.core[index] - right.core[index];
    if (difference !== 0) return Math.sign(difference);
  }
  if (left.prerelease.length === 0 || right.prerelease.length === 0)
    return Math.sign(right.prerelease.length - left.prerelease.length);
  const shared = Math.min(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < shared; index++) {
    const difference = compareIdentifiers(left.prerelease[index] ?? "", right.prerelease[index] ?? "");
    if (difference !== 0) return difference;
  }
  return Math.sign(left.prerelease.length - right.prerelease.length);
};

/** Whether a version names a prerelease: a build with one follows prereleases, a stable build only stable releases. */
export const isPrerelease = (version: Version) => version.prerelease.length > 0;
