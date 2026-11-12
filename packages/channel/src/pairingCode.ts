import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, randomBytes } from "@noble/hashes/utils.js";
import { decodeBase64Url, encodeBase64Url } from "./base64url.ts";
import { fail, type Result, succeed } from "./result.ts";

export const pairingCodePrefix = "iskios1-";
export const publicKeyBytes = 32;
export const roomBytes = 16;
export const pairingSecretBytes = 16;
const checksumBytes = 4;
const maxOriginBytes = 255;
const fixedBytes = publicKeyBytes + roomBytes + pairingSecretBytes;
const roomPattern = /^[0-9a-f]{32}$/;
const versionPattern = /^iskios(\d+)-/;

/** What a host puts in a pairing code and a device reads out of it. */
export interface PairingCode {
  hostPublicKey: Uint8Array;
  relayOrigin: string;
  /** Lowercase hex of 16 random bytes, chosen by the host. */
  room: string;
  /** One-time secret, 16 random bytes, that proves the device saw the code. */
  secret: Uint8Array;
}

export type PairingCodeErrorKind = "malformed" | "unsupported-version" | "bad-checksum";

/** A fresh room name: 16 random bytes as 32 lowercase hex characters. */
export function newRoomName(): string {
  return bytesToHex(randomBytes(roomBytes));
}

/** A fresh one-time pairing secret: 16 random bytes. */
export function newPairingSecret(): Uint8Array {
  return randomBytes(pairingSecretBytes);
}

/** True for an origin the relay may have: https, or plain http only for a relay run on this computer. */
export function isAllowedRelayOrigin(origin: string): boolean {
  if (new TextEncoder().encode(origin).byteLength > maxOriginBytes) return false;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  const isLocalHttp = url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  // Only the canonical form, so no path, query, credentials or default port can hide in a code.
  return (url.protocol === "https:" || isLocalHttp) && url.origin === origin;
}

/**
 * Writes a pairing code: the prefix, then the base64url of the key, room, secret and origin followed by a 4-byte
 * checksum of those bytes. The arguments come from the host itself, so a bad one is a bug and throws a RangeError.
 */
export function encodePairingCode(code: PairingCode): string {
  if (code.hostPublicKey.byteLength !== publicKeyBytes) throw new RangeError("host public key must be 32 bytes");
  if (!roomPattern.test(code.room)) throw new RangeError("room must be 32 lowercase hex characters");
  if (code.secret.byteLength !== pairingSecretBytes) throw new RangeError("secret must be 16 bytes");
  if (!isAllowedRelayOrigin(code.relayOrigin)) throw new RangeError("relay origin must be https or local http");
  const origin = new TextEncoder().encode(code.relayOrigin);
  const body = new Uint8Array(fixedBytes + origin.byteLength + checksumBytes);
  body.set(code.hostPublicKey, 0);
  body.set(hexToBytes(code.room), publicKeyBytes);
  body.set(code.secret, publicKeyBytes + roomBytes);
  body.set(origin, fixedBytes);
  body.set(checksumOf(body.subarray(0, body.length - checksumBytes)), body.length - checksumBytes);
  return pairingCodePrefix + encodeBase64Url(body);
}

/** Reads a pairing code pasted by a person: surrounding whitespace is ignored; any other change is reported. */
export function decodePairingCode(text: string): Result<PairingCode, PairingCodeErrorKind> {
  const trimmed = text.trim();
  const version = versionPattern.exec(trimmed);
  if (version === null) return fail("malformed");
  if (`iskios${version[1]}-` !== pairingCodePrefix) return fail("unsupported-version");
  const bytes = decodeBase64Url(trimmed.slice(pairingCodePrefix.length));
  if (bytes === null || bytes.byteLength <= fixedBytes + checksumBytes) return fail("malformed");
  const body = bytes.subarray(0, bytes.length - checksumBytes);
  const checksum = bytes.subarray(bytes.length - checksumBytes);
  if (!checksumOf(body).every((byte, index) => byte === checksum[index])) return fail("bad-checksum");
  let relayOrigin: string;
  try {
    relayOrigin = new TextDecoder("utf-8", { fatal: true }).decode(body.subarray(fixedBytes));
  } catch {
    return fail("malformed");
  }
  if (!isAllowedRelayOrigin(relayOrigin)) return fail("malformed");
  return succeed({
    hostPublicKey: body.slice(0, publicKeyBytes),
    relayOrigin,
    room: bytesToHex(body.subarray(publicKeyBytes, publicKeyBytes + roomBytes)),
    secret: body.slice(publicKeyBytes + roomBytes, fixedBytes),
  });
}

function checksumOf(body: Uint8Array): Uint8Array {
  return sha256(body).subarray(0, checksumBytes);
}
