import { decodeBase64Url } from "./base64url.ts";
import { fail, type Result, succeed } from "./result.ts";
import { deviceTokenBytes } from "./tokens.ts";

export const maxDeviceNameLength = 60;
const maxNameLength = 200;
const pairingSecretLength = 16;

export type DeviceKind = "desktop" | "phone";
export type RefusalReason =
  | "code-invalid"
  | "code-expired"
  | "code-used"
  | "unknown-device"
  | "disabled"
  | "disconnected";

/** The first message a paired device sends inside the secure channel. `secret` and `token` are base64url. */
export type ClientHello =
  | { t: "pair"; secret: string; deviceName: string; deviceKind: DeviceKind }
  | { t: "resume"; deviceId: string; token: string };

/** The host's answer to a ClientHello. `token` is base64url of 32 random bytes. */
export type HostReply =
  | { t: "paired"; deviceId: string; token: string; hostName: string }
  | { t: "resumed"; hostName: string }
  | { t: "refused"; reason: RefusalReason };

export type ProtocolErrorKind = "malformed";

const refusalReasons = {
  "code-expired": true,
  "code-invalid": true,
  "code-used": true,
  disabled: true,
  disconnected: true,
  "unknown-device": true,
} satisfies Record<RefusalReason, true>;

function isDeviceKind(value: unknown): value is DeviceKind {
  return value === "desktop" || value === "phone";
}

function isRefusalReason(value: unknown): value is RefusalReason {
  return typeof value === "string" && Object.hasOwn(refusalReasons, value);
}

/** Reads the text of a first message from a device; anything off-shape, including an unknown field, is "malformed". */
export function parseClientHello(text: string): Result<ClientHello, ProtocolErrorKind> {
  const value = parseObject(text);
  if (value === null) return fail("malformed");
  if (value.t === "pair" && hasExactKeys(value, ["deviceKind", "deviceName", "secret", "t"])) {
    const { deviceKind, deviceName, secret } = value;
    if (
      isDeviceKind(deviceKind) &&
      isText(deviceName, maxDeviceNameLength) &&
      isBase64UrlOfLength(secret, pairingSecretLength)
    ) {
      return succeed({ deviceKind, deviceName, secret, t: "pair" });
    }
    return fail("malformed");
  }
  if (value.t === "resume" && hasExactKeys(value, ["deviceId", "t", "token"])) {
    const { deviceId, token } = value;
    if (isText(deviceId, maxNameLength) && isBase64UrlOfLength(token, deviceTokenBytes)) {
      return succeed({ deviceId, t: "resume", token });
    }
  }
  return fail("malformed");
}

/** Reads the text of the host's answer; anything off-shape, including an unknown field, is "malformed". */
export function parseHostReply(text: string): Result<HostReply, ProtocolErrorKind> {
  const value = parseObject(text);
  if (value === null) return fail("malformed");
  if (value.t === "paired" && hasExactKeys(value, ["deviceId", "hostName", "t", "token"])) {
    const { deviceId, hostName, token } = value;
    if (
      isText(deviceId, maxNameLength) &&
      isText(hostName, maxNameLength) &&
      isBase64UrlOfLength(token, deviceTokenBytes)
    ) {
      return succeed({ deviceId, hostName, t: "paired", token });
    }
  }
  if (value.t === "resumed" && hasExactKeys(value, ["hostName", "t"])) {
    const { hostName } = value;
    if (isText(hostName, maxNameLength)) return succeed({ hostName, t: "resumed" });
  }
  if (value.t === "refused" && hasExactKeys(value, ["reason", "t"])) {
    const { reason } = value;
    if (isRefusalReason(reason)) {
      return succeed({ reason, t: "refused" });
    }
  }
  return fail("malformed");
}

/** The text to send for a hello, as the parser expects it. */
export function encodeClientHello(hello: ClientHello): string {
  return JSON.stringify(hello);
}

/** The text to send for a reply, as the parser expects it. */
export function encodeHostReply(reply: HostReply): string {
  return JSON.stringify(reply);
}

function parseObject(text: string): Record<string, unknown> | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function hasExactKeys(value: Record<string, unknown>, sortedKeys: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === sortedKeys.length && keys.every((key, index) => key === sortedKeys[index]);
}

/** A string of 1 to `max` characters (code points). */
function isText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && [...value].length <= max;
}

function isBase64UrlOfLength(value: unknown, byteLength: number): value is string {
  return typeof value === "string" && decodeBase64Url(value)?.byteLength === byteLength;
}
