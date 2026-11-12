import { decodeBase64Url } from "./base64url.ts";

/** Which side of a room a connection plays. */
export type Role = "client" | "host";

/** What a valid connection URL asks for. */
export type Connect = {
  /** The decoded host claim secret; always null for a client, whose claim is not read. */
  readonly claim: Uint8Array | null;
  readonly role: Role;
  readonly room: string;
};

const roomPattern = /^[A-Za-z0-9_-]{16,64}$/;
const minimumClaimBytes = 16;

/**
 * Reads `/r/<room>?role=host&claim=<secret>` or `/r/<room>?role=client`; any other URL gives null so that the caller
 * answers 404 and nothing about the relay is readable.
 */
export const parseConnect = (url: string): Connect | null => {
  const parsed = URL.canParse(url, "http://relay.invalid") ? new URL(url, "http://relay.invalid") : null;
  if (parsed === null) return null;
  const [, prefix, room, ...rest] = parsed.pathname.split("/");
  if (prefix !== "r" || room === void 0 || rest.length > 0 || !roomPattern.test(room)) return null;
  const role = parsed.searchParams.get("role");
  if (role === "client") return { claim: null, role, room };
  if (role !== "host") return null;
  const claim = decodeBase64Url(parsed.searchParams.get("claim") ?? "");
  return claim !== null && claim.length >= minimumClaimBytes ? { claim, role, room } : null;
};
