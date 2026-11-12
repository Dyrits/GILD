import { describe, expect, it } from "vitest";
import { decodeBase64Url, encodeBase64Url } from "../src/index.ts";

describe("base64url", () => {
  it("encodes the RFC 4648 examples without padding", () => {
    const text = (value: string) => encodeBase64Url(new TextEncoder().encode(value));
    expect([text(""), text("f"), text("fo"), text("foo"), text("foob"), text("fooba"), text("foobar")]).toEqual([
      "",
      "Zg",
      "Zm8",
      "Zm9v",
      "Zm9vYg",
      "Zm9vYmE",
      "Zm9vYmFy",
    ]);
  });

  it("uses the URL-safe alphabet", () => {
    expect(encodeBase64Url(new Uint8Array([0xfb, 0xff, 0xfe]))).toBe("-__-");
  });

  it("round trips every length from 0 to 70 bytes", () => {
    for (let length = 0; length <= 70; length += 1) {
      const bytes = new Uint8Array(length).map((_, index) => (index * 37 + length) & 0xff);
      expect(decodeBase64Url(encodeBase64Url(bytes)), `length ${length}`).toEqual(bytes);
    }
  });

  it("rejects characters outside the alphabet, padding, and impossible lengths", () => {
    expect(decodeBase64Url("Zm9v+")).toBeNull();
    expect(decodeBase64Url("Zm8=")).toBeNull();
    expect(decodeBase64Url("Zm 9v")).toBeNull();
    expect(decodeBase64Url("Zm9vY")).toBeNull();
  });

  it("rejects text with nonzero spare bits, which would decode to the same bytes as another text", () => {
    expect(decodeBase64Url("Zg")).toEqual(new Uint8Array([0x66]));
    expect(decodeBase64Url("Zh")).toBeNull();
  });
});
