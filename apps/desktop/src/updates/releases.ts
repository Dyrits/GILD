import { compareVersions, isPrerelease, parseVersion } from "./versions.ts";

/** A GitHub release, reduced to what choosing an update reads. */
export type ReleaseListing = {
  readonly assets: readonly { readonly name: string; readonly size: number; readonly url: string }[];
  readonly isDraft: boolean;
  readonly isPrerelease: boolean;
  readonly notes: string;
  readonly pageUrl: string;
  readonly tag: string;
};

/** A newer release with the files this computer needs, ready to download. */
export type FoundRelease = {
  readonly installer: { readonly name: string; readonly size: number; readonly url: string };
  readonly notes: string;
  readonly pageUrl: string;
  readonly sumsUrl: string;
  readonly version: string;
};

/** The file of checksums the release workflow publishes beside the installers. */
export const sumsFileName = "SHA512SUMS.txt";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** Reads GitHub's release list, leaving out anything that does not have the expected shape. */
export const listingsOf = (json: unknown): ReleaseListing[] => {
  if (!Array.isArray(json)) return [];
  return json.flatMap((entry: unknown): ReleaseListing[] => {
    if (!isRecord(entry) || typeof entry.tag_name !== "string" || typeof entry.html_url !== "string") return [];
    const assets = Array.isArray(entry.assets) ? entry.assets : [];
    return [
      {
        assets: assets.flatMap((asset: unknown) =>
          isRecord(asset) &&
          typeof asset.name === "string" &&
          typeof asset.browser_download_url === "string" &&
          typeof asset.size === "number"
            ? [{ name: asset.name, size: asset.size, url: asset.browser_download_url }]
            : [],
        ),
        isDraft: entry.draft === true,
        isPrerelease: entry.prerelease === true,
        notes: typeof entry.body === "string" ? entry.body : "",
        pageUrl: entry.html_url,
        tag: entry.tag_name,
      },
    ];
  });
};

/** What a check found: a release to install, or none, with why when a newer one cannot be used. */
export type Choice =
  | { readonly _tag: "Found"; readonly release: FoundRelease }
  | { readonly _tag: "None"; readonly reason: string | null };

/**
 * The newest release newer than the running version that carries this computer's installer and the checksums: a
 * prerelease build follows prereleases and stable releases, a stable build stable releases only.
 */
export const chooseRelease = (
  listings: readonly ReleaseListing[],
  running: { readonly arch: string; readonly version: string },
): Choice => {
  const current = parseVersion(running.version);
  if (current === null) return { _tag: "None", reason: `The running version ${running.version} cannot be compared.` };
  const newer = listings
    .flatMap((listing) => {
      const version = parseVersion(listing.tag);
      const isOfChannel = isPrerelease(current) || (!listing.isPrerelease && !isPrerelease(version ?? current));
      if (listing.isDraft || version === null || !isOfChannel || compareVersions(version, current) <= 0) return [];
      return [{ listing, number: listing.tag.replace(/^v/, ""), version }];
    })
    .sort((left, right) => compareVersions(right.version, left.version));
  let reason: string | null = null;
  for (const { listing, number } of newer) {
    const installerName = `Iskios-${number}-mac-${running.arch}.dmg`;
    const installer = listing.assets.find((asset) => asset.name === installerName);
    const sums = listing.assets.find((asset) => asset.name === sumsFileName);
    if (installer !== undefined && sums !== undefined)
      return {
        _tag: "Found",
        release: { installer, notes: listing.notes, pageUrl: listing.pageUrl, sumsUrl: sums.url, version: number },
      };
    reason ??= `Release ${number} has no ${installer === undefined ? installerName : sumsFileName}.`;
  }
  return { _tag: "None", reason };
};

/** Reads `sha512sum` or `shasum` output (`<hash>  <name>`) into the hash of each file. */
export const checksumsOf = (text: string): Map<string, string> => {
  const sums = new Map<string, string>();
  for (const line of text.split("\n")) {
    const match = /^([0-9a-fA-F]{128})\s+\*?(.+?)\s*$/.exec(line);
    if (match?.[1] !== undefined && match[2] !== undefined) sums.set(match[2], match[1].toLowerCase());
  }
  return sums;
};

/** The notes of a release as plain text: tags and entities of the HTML GitHub's feed carries are removed. */
export const plainNotesOf = (notes: string): string =>
  notes
    .replace(/<\/(p|li|h[1-6]|div|ul|ol)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
