import { sha256 } from "@noble/hashes/sha2.js";
import { describe, expect, it } from "vitest";
import {
  decodePairingCode,
  encodeBase64Url,
  encodePairingCode,
  generateKeyPair,
  newPairingSecret,
  newRoomName,
} from "../src/index.ts";

const sample = () => ({
  hostPublicKey: generateKeyPair().publicKey,
  relayOrigin: "https://relay-lab.example.workers.dev",
  room: newRoomName(),
  secret: newPairingSecret(),
});

/** A code written by hand with a correct checksum around any origin text, to reach what the encoder refuses to write. */
const forgeCode = (origin: string) => {
  const originBytes = new TextEncoder().encode(origin);
  const body = new Uint8Array(64 + originBytes.length).fill(7);
  body.set(originBytes, 64);
  const forged = new Uint8Array(body.length + 4);
  forged.set(body);
  forged.set(sha256(body).subarray(0, 4), body.length);
  return `iskios1-${encodeBase64Url(forged)}`;
};

describe("pairing code", () => {
  it("makes rooms of 32 lowercase hex characters and secrets of 16 bytes", () => {
    expect(newRoomName()).toMatch(/^[0-9a-f]{32}$/);
    expect(newRoomName()).not.toBe(newRoomName());
    expect(newPairingSecret().byteLength).toBe(16);
  });

  it("round trips a code", () => {
    const code = sample();
    const text = encodePairingCode(code);
    expect(text).toMatch(/^iskios1-[A-Za-z0-9_-]+$/);
    expect(decodePairingCode(text)).toEqual({ ok: true, value: code });
  });

  it("round trips a local http origin with a port", () => {
    const code = { ...sample(), relayOrigin: "http://127.0.0.1:8787" };
    expect(decodePairingCode(encodePairingCode(code))).toEqual({ ok: true, value: code });
    const local = { ...sample(), relayOrigin: "http://localhost:8787" };
    expect(decodePairingCode(encodePairingCode(local))).toEqual({ ok: true, value: local });
  });

  it("tolerates surrounding whitespace and a trailing newline", () => {
    const code = sample();
    const text = encodePairingCode(code);
    expect(decodePairingCode(`  \t${text}\r\n`)).toEqual({ ok: true, value: code });
    expect(decodePairingCode(`${text}\n`)).toEqual({ ok: true, value: code });
  });

  it("catches a changed character with the checksum", () => {
    const text = encodePairingCode(sample());
    for (const position of [10, 40, 60, 80, text.length - 8]) {
      const original = text[position] ?? "";
      const replacement = original === "A" ? "B" : "A";
      const changed = text.slice(0, position) + replacement + text.slice(position + 1);
      expect(decodePairingCode(changed), `position ${position}`).toEqual({ kind: "bad-checksum", ok: false });
    }
  });

  it("catches a truncation and a code with extra characters", () => {
    const text = encodePairingCode(sample());
    for (const cut of [1, 2, 3, 4, 10, 60]) {
      expect(decodePairingCode(text.slice(0, -cut)).ok, `cut ${cut}`).toBe(false);
    }
    expect(decodePairingCode(`${text}AAAA`).ok).toBe(false);
    expect(decodePairingCode("iskios1-").ok).toBe(false);
  });

  it("rejects an unsupported version", () => {
    const text = encodePairingCode(sample());
    expect(decodePairingCode(text.replace("iskios1-", "iskios2-"))).toEqual({ kind: "unsupported-version", ok: false });
    expect(decodePairingCode(text.replace("iskios1-", "iskios10-"))).toEqual({
      kind: "unsupported-version",
      ok: false,
    });
  });

  it("rejects text that is not a pairing code", () => {
    for (const text of ["", "hello", "iskios-abc", "ISKIOS1-abc", "iskios1 abc", "iskios1-@@@@"]) {
      expect(decodePairingCode(text), text).toEqual({ kind: "malformed", ok: false });
    }
  });

  it("refuses to encode an origin that is not https or local http", () => {
    for (const relayOrigin of [
      "http://relay.example.com",
      "ftp://relay.example.com",
      "https://relay.example.com/path",
      "https://user@relay.example.com",
      "https://relay.example.com/",
      "relay.example.com",
      "http://localhost.evil.example",
      "http://127.0.0.2",
    ]) {
      expect(() => encodePairingCode({ ...sample(), relayOrigin }), relayOrigin).toThrow(RangeError);
    }
  });

  it("refuses to decode a well-checksummed code that carries a bad origin", () => {
    expect(decodePairingCode(forgeCode("https://relay.example.com")).ok).toBe(true);
    expect(decodePairingCode(forgeCode("http://relay.example.com"))).toEqual({ kind: "malformed", ok: false });
    expect(decodePairingCode(forgeCode("https://relay.example.com/x"))).toEqual({ kind: "malformed", ok: false });
    expect(decodePairingCode(forgeCode("javascript:alert(1)"))).toEqual({ kind: "malformed", ok: false });
  });

  it("refuses to encode a key, room or secret of the wrong shape", () => {
    expect(() => encodePairingCode({ ...sample(), hostPublicKey: new Uint8Array(31) })).toThrow(RangeError);
    expect(() => encodePairingCode({ ...sample(), secret: new Uint8Array(15) })).toThrow(RangeError);
    expect(() => encodePairingCode({ ...sample(), room: "ABCDEF" })).toThrow(RangeError);
    expect(() => encodePairingCode({ ...sample(), room: newRoomName().toUpperCase() })).toThrow(RangeError);
  });

  it("keeps the code short enough to paste in one line", () => {
    expect(encodePairingCode(sample()).length).toBeLessThan(200);
  });
});
