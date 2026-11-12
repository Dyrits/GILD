import { describe, expect, it } from "vitest";
import { constantTimeEqual, hashToken, newDeviceToken } from "../src/index.ts";

describe("device tokens", () => {
  it("makes 32 random bytes each time", () => {
    const first = newDeviceToken();
    expect(first.byteLength).toBe(32);
    expect(constantTimeEqual(first, newDeviceToken())).toBe(false);
  });

  it("hashes with SHA-256", () => {
    const hash = hashToken(new TextEncoder().encode("abc"));
    expect(Array.from(hash.subarray(0, 4))).toEqual([0xba, 0x78, 0x16, 0xbf]);
    expect(hash.byteLength).toBe(32);
  });

  it("gives a different hash for a token changed by one bit", () => {
    const token = newDeviceToken();
    const changed = token.slice();
    changed[5] = (changed[5] ?? 0) ^ 1;
    expect(constantTimeEqual(hashToken(token), hashToken(changed))).toBe(false);
  });
});

describe("constantTimeEqual", () => {
  it("is true for equal bytes, including two empty arrays", () => {
    expect(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
    expect(constantTimeEqual(new Uint8Array(0), new Uint8Array(0))).toBe(true);
  });

  it("is false when any byte differs, first or last", () => {
    expect(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([0, 2, 3]))).toBe(false);
    expect(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
  });

  it("is false when the lengths differ", () => {
    expect(constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 0]))).toBe(false);
  });
});
