import { describe, expect, it } from "vitest";
import {
  encodeBase64Url,
  encodeClientHello,
  encodeHostReply,
  newDeviceToken,
  newPairingSecret,
  parseClientHello,
  parseHostReply,
} from "../src/index.ts";

const secret = encodeBase64Url(newPairingSecret());
const token = encodeBase64Url(newDeviceToken());
const pair = { deviceKind: "phone", deviceName: "Ada's phone", secret, t: "pair" } as const;
const resume = { deviceId: "device-1", t: "resume", token } as const;
const paired = { deviceId: "device-1", hostName: "Studio", t: "paired", token } as const;

const asText = (value: unknown) => JSON.stringify(value);

describe("client hello", () => {
  it("accepts a pair hello and a resume hello", () => {
    expect(parseClientHello(asText(pair))).toEqual({ ok: true, value: pair });
    expect(parseClientHello(asText(resume))).toEqual({ ok: true, value: resume });
  });

  it("round trips through its encoder", () => {
    expect(parseClientHello(encodeClientHello({ ...pair, deviceKind: "desktop" }))).toEqual({
      ok: true,
      value: { ...pair, deviceKind: "desktop" },
    });
  });

  it("rejects text that is not a JSON object", () => {
    for (const text of ["", "nope", "null", "[]", "42", '"pair"', "{"]) {
      expect(parseClientHello(text), text).toEqual({ kind: "malformed", ok: false });
    }
  });

  it("rejects an unknown or missing type", () => {
    expect(parseClientHello(asText({ ...pair, t: "hello" })).ok).toBe(false);
    expect(parseClientHello(asText({ deviceKind: "phone", deviceName: "x", secret })).ok).toBe(false);
  });

  it("rejects a pair hello with a wrong device kind or name length", () => {
    expect(parseClientHello(asText({ ...pair, deviceKind: "tablet" })).ok).toBe(false);
    expect(parseClientHello(asText({ ...pair, deviceName: "" })).ok).toBe(false);
    expect(parseClientHello(asText({ ...pair, deviceName: "x".repeat(61) })).ok).toBe(false);
    expect(parseClientHello(asText({ ...pair, deviceName: "x".repeat(60) })).ok).toBe(true);
    expect(parseClientHello(asText({ ...pair, deviceName: 7 })).ok).toBe(false);
  });

  it("rejects a secret or token that is not base64url of the right size", () => {
    expect(parseClientHello(asText({ ...pair, secret: encodeBase64Url(new Uint8Array(15)) })).ok).toBe(false);
    expect(parseClientHello(asText({ ...pair, secret: "not base64url!" })).ok).toBe(false);
    expect(parseClientHello(asText({ ...resume, token: encodeBase64Url(new Uint8Array(31)) })).ok).toBe(false);
    expect(parseClientHello(asText({ ...resume, token: 5 })).ok).toBe(false);
  });

  it("rejects a resume hello without a device id", () => {
    expect(parseClientHello(asText({ ...resume, deviceId: "" })).ok).toBe(false);
    expect(parseClientHello(asText({ t: "resume", token })).ok).toBe(false);
  });

  it("rejects fields that do not belong to the type", () => {
    expect(parseClientHello(asText({ ...pair, extra: true })).ok).toBe(false);
    expect(parseClientHello(asText({ ...resume, deviceName: "x" })).ok).toBe(false);
  });
});

describe("host reply", () => {
  it("accepts paired, resumed and every refusal reason", () => {
    expect(parseHostReply(asText(paired))).toEqual({ ok: true, value: paired });
    expect(parseHostReply(asText({ hostName: "Studio", t: "resumed" }))).toEqual({
      ok: true,
      value: { hostName: "Studio", t: "resumed" },
    });
    for (const reason of ["code-invalid", "code-expired", "code-used", "unknown-device", "disabled", "disconnected"]) {
      expect(parseHostReply(asText({ reason, t: "refused" })), reason).toEqual({
        ok: true,
        value: { reason, t: "refused" },
      });
    }
  });

  it("round trips through its encoder", () => {
    expect(parseHostReply(encodeHostReply({ reason: "code-used", t: "refused" }))).toEqual({
      ok: true,
      value: { reason: "code-used", t: "refused" },
    });
  });

  it("rejects an unknown refusal reason and a missing one", () => {
    expect(parseHostReply(asText({ reason: "because", t: "refused" })).ok).toBe(false);
    expect(parseHostReply(asText({ t: "refused" })).ok).toBe(false);
  });

  it("rejects a paired reply with a short token or a missing host name", () => {
    expect(parseHostReply(asText({ ...paired, token: encodeBase64Url(new Uint8Array(16)) })).ok).toBe(false);
    expect(parseHostReply(asText({ ...paired, hostName: "" })).ok).toBe(false);
    expect(parseHostReply(asText({ deviceId: "d", t: "paired", token })).ok).toBe(false);
  });

  it("rejects a resumed reply with a name that is not text, and extra fields", () => {
    expect(parseHostReply(asText({ hostName: 3, t: "resumed" })).ok).toBe(false);
    expect(parseHostReply(asText({ hostName: "Studio", t: "resumed", token })).ok).toBe(false);
  });

  it("rejects text that is not a JSON object", () => {
    for (const text of ["", "x", "[]", "null"]) {
      expect(parseHostReply(text), text).toEqual({ kind: "malformed", ok: false });
    }
  });
});
