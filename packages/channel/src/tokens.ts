import { sha256 } from "@noble/hashes/sha2.js";
import { randomBytes } from "@noble/hashes/utils.js";

export const deviceTokenBytes = 32;

/** A fresh secret a host gives a paired device so it can resume; 32 random bytes. */
export function newDeviceToken(): Uint8Array {
  return randomBytes(deviceTokenBytes);
}

/** The SHA-256 of a token: the host stores only this, never the token. */
export function hashToken(token: Uint8Array): Uint8Array {
  return sha256(token);
}

/** Compares two byte arrays without stopping at the first difference; lengths are not secret. */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return difference === 0;
}
