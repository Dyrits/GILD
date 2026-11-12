// Choosing which host the window shows (device-pairing). The pure parts: where a host's link is, how soon to try a
// failed link again, and what a link's close tells the owner.

/** The loopback server's address for the link to one paired host; the token and the port stay those of the window's. */
export const hostEndpointOf = (endpoint: string, hostId: string) => {
  const url = new URL(endpoint);
  url.pathname = `/host/${hostId}`;
  return url.toString();
};

/**
 * Application close codes of a link to a host: could not open it (try again later), the host ended it, and the host
 * refused this installation (trying again cannot help; the owner pairs again).
 */
export const hostLinkCodes = { couldNotOpen: 4000, ended: 4001, refused: 4002 } as const;

/** The words for a link to a host that closed with `code`, or null when the close says nothing about the host. */
export const linkFailureOf = (code: number, reason: string): string | null =>
  code === hostLinkCodes.couldNotOpen || code === hostLinkCodes.ended || code === hostLinkCodes.refused ? reason : null;

/** Whether a close means no later try can work, so the link stops trying. */
export const isFinalLinkClose = (code: number) => code === hostLinkCodes.refused;

const shortestRetryMillis = 1_000;
const longestHostRetryMillis = 30_000;

/**
 * How long to wait before trying a link again after `failures` failures in a row: a second for the local service, which
 * is on this computer; for a host it doubles up to half a minute, since each try asks the relay, which has a daily
 * allowance shared by everyone.
 */
export const retryDelayOf = (failures: number, isHost: boolean) =>
  isHost ? Math.min(shortestRetryMillis * 2 ** Math.max(0, failures - 1), longestHostRetryMillis) : shortestRetryMillis;
