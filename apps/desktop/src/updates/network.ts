import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { rm } from "node:fs/promises";
import type { ReleaseListing } from "./releases.ts";
import { listingsOf } from "./releases.ts";

/** The repository's public release list, the one address a check asks; a development run may name another. */
export const defaultReleasesUrl = "https://api.github.com/repos/Dyrits/ISKIOS/releases?per_page=30";

/** The page owners can open when an update cannot install itself. */
export const releasesPageUrl = "https://github.com/Dyrits/ISKIOS/releases";

/** Platform `fetch`, replaceable so tests answer from a local server. */
export type Fetch = typeof fetch;

/** Why a request to GitHub failed, in words for the Updates section. */
export class UpdateRequestError extends Error {}

const failWith = (url: string, reason: unknown): never => {
  const text = reason instanceof Error ? reason.message : String(reason);
  throw new UpdateRequestError(`Could not reach ${new URL(url).host}: ${text}`);
};

/**
 * Asks for the release list. The request names the app and its version in the user agent and carries nothing
 * about quests, workspaces, accounts, or the owner (requirements, Update check carries no owner data).
 */
export const fetchListings = async (fetchFn: Fetch, url: string, appVersion: string): Promise<ReleaseListing[]> => {
  const response = await fetchFn(url, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": `Iskios/${appVersion}` },
  }).catch((reason: unknown) => failWith(url, reason));
  if (!response.ok) throw new UpdateRequestError(`GitHub answered ${response.status} to the release list.`);
  return listingsOf(await response.json());
};

/** Reads a small text file of a release, such as its checksums. */
export const fetchText = async (fetchFn: Fetch, url: string, appVersion: string): Promise<string> => {
  const response = await fetchFn(url, { headers: { "User-Agent": `Iskios/${appVersion}` } }).catch((reason: unknown) =>
    failWith(url, reason),
  );
  if (!response.ok) throw new UpdateRequestError(`GitHub answered ${response.status} for ${new URL(url).pathname}.`);
  return response.text();
};

/** Downloads a file to disk, reporting how much of it has arrived, and returns its SHA-512 as hex. */
export const downloadFile = async (
  fetchFn: Fetch,
  url: string,
  destination: string,
  options: { appVersion: string; onProgress: (percent: number) => void },
): Promise<string> => {
  const response = await fetchFn(url, { headers: { "User-Agent": `Iskios/${options.appVersion}` } }).catch(
    (reason: unknown) => failWith(url, reason),
  );
  if (!response.ok || response.body === null)
    throw new UpdateRequestError(`GitHub answered ${response.status} for ${new URL(url).pathname}.`);
  const total = Number(response.headers.get("content-length") ?? 0);
  const hash = createHash("sha512");
  const file = createWriteStream(destination);
  let received = 0;
  try {
    for await (const chunk of response.body) {
      hash.update(chunk);
      received += chunk.byteLength;
      if (!file.write(chunk)) await new Promise<void>((resolve) => file.once("drain", () => resolve()));
      if (total > 0) options.onProgress(Math.min(100, Math.floor((received / total) * 100)));
    }
    await new Promise<void>((resolve, reject) =>
      file.end((error?: Error | null) => (error ? reject(error) : resolve())),
    );
  } catch (reason) {
    file.destroy();
    await rm(destination, { force: true });
    return failWith(url, reason);
  }
  return hash.digest("hex");
};
