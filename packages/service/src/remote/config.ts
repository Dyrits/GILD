import { hostname } from "node:os";
import { Context } from "effect";

/**
 * The shared relay on the owner's free Cloudflare account (decision record 0016). One place names it, so the address
 * can change in a release; a pairing code carries the address it was made with.
 */
export const defaultRelayOrigin = "https://iskios-relay.dyrits.workers.dev";

/** What device pairing needs from outside the database. */
export interface RemoteSettings {
  /** The computer's own name, offered as the host's name until the owner chooses one. */
  readonly computerName: string;
  /** The relay a new pairing code names, unless the owner's host record names another. */
  readonly relayOrigin: string;
}

export class RemoteConfig extends Context.Service<RemoteConfig, RemoteSettings>()("iskios/RemoteConfig") {}

/** The computer's name without its network suffix: `Studio.local` and `Studio.lan` read as `Studio`. */
export const computerNameOf = (raw: string = hostname()) => raw.split(".")[0]?.trim() || "This computer";

/** Whether a relay address is on this computer: only a test or a development run names one. */
export const isLocalOrigin = (origin: string) => {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  } catch {
    return false;
  }
};
