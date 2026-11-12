import { bytesToHex } from "@noble/hashes/utils.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type Carrier,
  defaultHandshakeTimeoutMs,
  fragmentBytes,
  generateKeyPair,
  maxMessageBytes,
  openInitiator,
  openResponder,
  type SecureChannel,
} from "../src/index.ts";
import { createNoiseInitiator, type TransportKeys } from "../src/noise/index.ts";
import { fakeCarrierPair, type Interference, settle, silentCarrier } from "./fixtures/fakeCarrier.ts";

const prologue = new TextEncoder().encode("room-1");
const empty = new Uint8Array(0);

/** Opens both sides over a fake link and fails the test unless both handshakes succeed. */
const connect = async (interference: { fromFirst?: Interference; fromSecond?: Interference } = {}) => {
  const host = generateKeyPair();
  const [first, second] = fakeCarrierPair(interference);
  const [initiator, responder] = await Promise.all([
    openInitiator(first, host.publicKey, prologue),
    openResponder(second, host, prologue),
  ]);
  if (!initiator.ok || !responder.ok) throw new Error(`handshake failed: ${JSON.stringify([initiator, responder])}`);
  return { first, host, initiator: initiator.value, responder: responder.value, second };
};

/** Records what a channel delivers and whether it closed. */
const watch = (channel: SecureChannel) => {
  const seen = { closes: 0, messages: [] as Uint8Array[], texts: [] as string[] };
  channel.onMessage((data) => seen.messages.push(data));
  channel.onClose(() => {
    seen.closes += 1;
  });
  return seen;
};

const watchText = (channel: SecureChannel) => {
  const seen = { closes: 0, texts: [] as string[] };
  channel.onText((text) => seen.texts.push(text));
  channel.onClose(() => {
    seen.closes += 1;
  });
  return seen;
};

/** An initiator that speaks Noise directly, so a test can send records a well-behaved channel never would. */
const rawInitiator = async (carrier: Carrier, hostPublicKey: Uint8Array): Promise<TransportKeys> => {
  const handshake = createNoiseInitiator({ prologue, remoteStatic: hostPublicKey });
  const reply = new Promise<Uint8Array>((resolve) => carrier.onMessage(resolve));
  carrier.send(handshake.writeMessage(empty));
  handshake.readMessage(await reply);
  return handshake.split();
};

const connectRaw = async () => {
  const host = generateKeyPair();
  const [first, second] = fakeCarrierPair();
  const [keys, responder] = await Promise.all([
    rawInitiator(first, host.publicKey),
    openResponder(second, host, prologue),
  ]);
  if (!responder.ok) throw new Error("responder handshake failed");
  const sendRecord = (flag: number, payload: Uint8Array) => {
    const record = new Uint8Array(1 + payload.length);
    record[0] = flag;
    record.set(payload, 1);
    first.send(keys.send.encryptWithAd(empty, record));
  };
  return { first, responder: responder.value, second, sendRecord };
};

const pattern = (length: number) => new Uint8Array(length).map((_, index) => (index * 31 + (index >> 8)) & 0xff);

afterEach(() => {
  vi.useRealTimers();
});

describe("opening a secure channel", () => {
  it("opens both sides and carries text both ways", async () => {
    const { initiator, responder } = await connect();
    const atResponder = watchText(responder);
    const atInitiator = watchText(initiator);
    initiator.sendText("hello host");
    responder.sendText("hello device");
    await settle();
    expect(atResponder.texts).toEqual(["hello host"]);
    expect(atInitiator.texts).toEqual(["hello device"]);
  });

  it("carries bytes, including an empty message, in order", async () => {
    const { initiator, responder } = await connect();
    const seen = watch(responder);
    initiator.send(new Uint8Array([1, 2, 3]));
    initiator.send(empty);
    initiator.send(new Uint8Array([4]));
    await settle();
    expect(seen.messages.map((data) => Array.from(data))).toEqual([[1, 2, 3], [], [4]]);
  });

  it("adds no framing around handshake messages and one flag byte plus a tag around a record", async () => {
    const { first, initiator, second } = await connect();
    initiator.send(new Uint8Array(100));
    expect(first.sent[0]?.length).toBe(48);
    expect(second.sent[0]?.length).toBe(48);
    expect(first.sent[1]?.length).toBe(1 + 100 + 16);
  });

  it("holds a message that arrives before the first listener is added", async () => {
    const { initiator, responder } = await connect();
    responder.sendText("early");
    await settle();
    const seen = watchText(initiator);
    expect(seen.texts).toEqual(["early"]);
  });

  it("does not show the plaintext to the carrier", async () => {
    const { first, initiator, second } = await connect();
    initiator.sendText("SECRET-MARKER-0123456789");
    await settle();
    const everything = [...first.sent, ...second.sent].map(bytesToHex).join("");
    expect(everything).not.toContain(bytesToHex(new TextEncoder().encode("SECRET-MARKER")));
  });

  it("fails on both sides when the initiator has the wrong host key", async () => {
    const host = generateKeyPair();
    const [first, second] = fakeCarrierPair();
    const [initiator, responder] = await Promise.all([
      openInitiator(first, generateKeyPair().publicKey, prologue),
      openResponder(second, host, prologue),
    ]);
    expect(responder).toEqual({ kind: "handshake-failed", ok: false });
    // The responder says nothing and hangs up, so the initiator only sees the carrier close.
    expect(initiator).toEqual({ kind: "carrier-closed", ok: false });
    expect(second.sent).toEqual([]);
  });

  it("fails when the two sides disagree on the prologue", async () => {
    const host = generateKeyPair();
    const [first, second] = fakeCarrierPair();
    const [initiator, responder] = await Promise.all([
      openInitiator(first, host.publicKey, new TextEncoder().encode("room-1")),
      openResponder(second, host, new TextEncoder().encode("room-2")),
    ]);
    expect(responder).toEqual({ kind: "handshake-failed", ok: false });
    expect(initiator.ok).toBe(false);
  });

  it("fails when a handshake message is altered in transit", async () => {
    const flip: Interference = (data) => {
      data[40] = (data[40] ?? 0) ^ 1;
      return [data];
    };
    const host = generateKeyPair();
    const [first, second] = fakeCarrierPair({ fromFirst: flip });
    const [initiator, responder] = await Promise.all([
      openInitiator(first, host.publicKey, prologue),
      openResponder(second, host, prologue),
    ]);
    expect(responder).toEqual({ kind: "handshake-failed", ok: false });
    expect(initiator.ok).toBe(false);

    const [third, fourth] = fakeCarrierPair({ fromSecond: flip });
    const [initiator2, responder2] = await Promise.all([
      openInitiator(third, host.publicKey, prologue),
      openResponder(fourth, host, prologue),
    ]);
    expect(initiator2).toEqual({ kind: "handshake-failed", ok: false });
    expect(responder2.ok).toBe(true);
  });

  it("gives up with handshake-timeout when the carrier stays silent, and closes it", async () => {
    const carrier = silentCarrier();
    const result = await openInitiator(carrier, generateKeyPair().publicKey, prologue, { handshakeTimeoutMs: 20 });
    expect(result).toEqual({ kind: "handshake-timeout", ok: false });
    expect(carrier.isClosed()).toBe(true);

    const waiting = silentCarrier();
    const responder = await openResponder(waiting, generateKeyPair(), prologue, { handshakeTimeoutMs: 20 });
    expect(responder).toEqual({ kind: "handshake-timeout", ok: false });
    expect(waiting.isClosed()).toBe(true);
  });

  it("waits 15 seconds by default", async () => {
    vi.useFakeTimers();
    expect(defaultHandshakeTimeoutMs).toBe(15_000);
    let result: Awaited<ReturnType<typeof openInitiator>> | null = null;
    const pending = openInitiator(silentCarrier(), generateKeyPair().publicKey, prologue).then((value) => {
      result = value;
    });
    await vi.advanceTimersByTimeAsync(14_999);
    expect(result).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(result).toEqual({ kind: "handshake-timeout", ok: false });
  });

  it("reports carrier-closed when the carrier closes during the handshake", async () => {
    const [first, second] = fakeCarrierPair();
    const pending = openInitiator(first, generateKeyPair().publicKey, prologue);
    second.close();
    expect(await pending).toEqual({ kind: "carrier-closed", ok: false });
  });

  it("reports carrier-closed when the carrier cannot send the first message", async () => {
    const [first] = fakeCarrierPair();
    first.close();
    expect(await openInitiator(first, generateKeyPair().publicKey, prologue)).toEqual({
      kind: "carrier-closed",
      ok: false,
    });
  });

  it("reports handshake-failed for a host key of the wrong length", async () => {
    expect(await openInitiator(silentCarrier(), new Uint8Array(5), prologue)).toEqual({
      kind: "handshake-failed",
      ok: false,
    });
  });
});

describe("closing a secure channel", () => {
  it("tells the peer's listeners when the carrier closes", async () => {
    const { first, initiator, responder } = await connect();
    const atInitiator = watch(initiator);
    const atResponder = watch(responder);
    first.close();
    await settle();
    expect(atInitiator.closes).toBe(1);
    expect(atResponder.closes).toBe(1);
  });

  it("closes the carrier and tells the peer when close is called", async () => {
    const { first, initiator, responder, second } = await connect();
    const atInitiator = watch(initiator);
    const atResponder = watch(responder);
    initiator.close();
    initiator.close();
    await settle();
    expect(first.isClosed()).toBe(true);
    expect(second.isClosed()).toBe(true);
    expect(atInitiator.closes).toBe(1);
    expect(atResponder.closes).toBe(1);
  });

  it("drops a send after the channel has closed, and runs a late close listener at once", async () => {
    const { first, initiator } = await connect();
    initiator.close();
    const before = first.sent.length;
    initiator.sendText("too late");
    expect(first.sent.length).toBe(before);
    let isCalled = false;
    initiator.onClose(() => {
      isCalled = true;
    });
    expect(isCalled).toBe(true);
  });

  it("closes when a record is altered, after delivering the records before it", async () => {
    const flip: Interference = (data, index) => {
      if (index === 2) data[3] = (data[3] ?? 0) ^ 1;
      return [data];
    };
    const { initiator, responder } = await connect({ fromFirst: flip });
    const seen = watchText(responder);
    initiator.sendText("one");
    initiator.sendText("two");
    initiator.sendText("three");
    await settle();
    expect(seen.texts).toEqual(["one"]);
    expect(seen.closes).toBe(1);
  });

  it("delivers every record when nothing is altered", async () => {
    const { initiator, responder } = await connect();
    const seen = watchText(responder);
    initiator.sendText("one");
    initiator.sendText("two");
    initiator.sendText("three");
    await settle();
    expect(seen.texts).toEqual(["one", "two", "three"]);
    expect(seen.closes).toBe(0);
  });

  it("closes when a record is replayed", async () => {
    const duplicate: Interference = (data, index) => (index === 1 ? [data, data] : [data]);
    const { initiator, responder } = await connect({ fromFirst: duplicate });
    const seen = watchText(responder);
    initiator.sendText("once");
    initiator.sendText("twice");
    await settle();
    expect(seen.texts).toEqual(["once"]);
    expect(seen.closes).toBe(1);
  });

  it("closes when two records arrive in the wrong order", async () => {
    let held: Uint8Array | null = null;
    const swap: Interference = (data, index) => {
      if (index === 1) {
        held = data;
        return [];
      }
      return index === 2 && held !== null ? [data, held] : [data];
    };
    const { initiator, responder } = await connect({ fromFirst: swap });
    const seen = watchText(responder);
    initiator.sendText("first");
    initiator.sendText("second");
    await settle();
    expect(seen.texts).toEqual([]);
    expect(seen.closes).toBe(1);
  });

  it("closes when a record is dropped in the middle", async () => {
    const drop: Interference = (data, index) => (index === 2 ? [] : [data]);
    const { initiator, responder } = await connect({ fromFirst: drop });
    const seen = watchText(responder);
    initiator.sendText("one");
    initiator.sendText("two");
    initiator.sendText("three");
    await settle();
    expect(seen.texts).toEqual(["one"]);
    expect(seen.closes).toBe(1);
  });

  it("closes when a record is reflected back to its sender", async () => {
    const captured: Uint8Array[] = [];
    const capture: Interference = (data) => {
      captured.push(data);
      return [data];
    };
    const { initiator, second } = await connect({ fromFirst: capture });
    const atInitiator = watchText(initiator);
    initiator.sendText("mine");
    await settle();
    expect(atInitiator.closes).toBe(0);
    // Hand the initiator its own record as if the host had sent it.
    const own = captured[1];
    if (own === void 0) throw new Error("no record captured");
    second.send(own);
    await settle();
    expect(atInitiator.closes).toBe(1);
  });

  it("closes when a message that is not UTF-8 reaches an onText listener", async () => {
    const { initiator, responder } = await connect();
    const seen = watchText(responder);
    initiator.send(new Uint8Array([0xff, 0xfe, 0xfd]));
    await settle();
    expect(seen.texts).toEqual([]);
    expect(seen.closes).toBe(1);
  });

  it("closes when a record carries a flag other than 0 or 1", async () => {
    const { responder, sendRecord } = await connectRaw();
    const seen = watch(responder);
    sendRecord(2, new Uint8Array([1]));
    await settle();
    expect(seen.closes).toBe(1);
    expect(seen.messages).toEqual([]);
  });

  it("closes when a record is empty, and accepts a last fragment with no bytes as an empty message", async () => {
    const { first, responder, sendRecord } = await connectRaw();
    const seen = watch(responder);
    sendRecord(0, empty);
    await settle();
    expect(seen.closes).toBe(0);
    expect(seen.messages.map((data) => data.length)).toEqual([0]);
    // A record with no flag byte at all is not a valid record.
    first.send(new Uint8Array(16));
    await settle();
    expect(seen.closes).toBe(1);
  });

  it("closes when a record is too short to hold a flag and a tag", async () => {
    const { first, responder } = await connectRaw();
    const seen = watch(responder);
    first.send(new Uint8Array(10));
    await settle();
    expect(seen.closes).toBe(1);
  });
});

describe("fragmenting a large message", () => {
  it("sends and reassembles 5 MiB in records of at most 65,535 bytes", async () => {
    const { first, initiator, responder } = await connect();
    const seen = watch(responder);
    const message = pattern(5 * 1024 * 1024);
    initiator.send(message);
    await settle();
    expect(seen.messages.length).toBe(1);
    expect(seen.messages[0]).toEqual(message);
    const records = first.sent.slice(1);
    expect(records.length).toBe(Math.ceil(message.length / fragmentBytes));
    expect(Math.max(...records.map((record) => record.length))).toBeLessThanOrEqual(65535);
    expect(seen.closes).toBe(0);
  });

  it("keeps a large message and the messages around it apart", async () => {
    const { initiator, responder } = await connect();
    const seen = watch(responder);
    const big = pattern(fragmentBytes * 2 + 5);
    initiator.sendText("before");
    initiator.send(big);
    initiator.sendText("after");
    await settle();
    expect(seen.messages.length).toBe(3);
    expect(seen.messages[1]).toEqual(big);
    expect(new TextDecoder().decode(seen.messages[2])).toBe("after");
  });

  it("accepts a message of exactly 32 MiB", async () => {
    const { initiator, responder } = await connect();
    const seen = watch(responder);
    initiator.send(new Uint8Array(maxMessageBytes));
    await settle();
    expect(seen.messages.map((data) => data.length)).toEqual([maxMessageBytes]);
    expect(seen.closes).toBe(0);
  }, 30_000);

  it("refuses to send a message over 32 MiB", async () => {
    const { first, initiator } = await connect();
    expect(() => initiator.send(new Uint8Array(maxMessageBytes + 1))).toThrow(RangeError);
    expect(first.sent.length).toBe(1);
  });

  it("closes when a peer sends fragments past 32 MiB without a last one", async () => {
    const { responder, sendRecord } = await connectRaw();
    const seen = watch(responder);
    const fragment = new Uint8Array(fragmentBytes);
    const needed = Math.floor(maxMessageBytes / fragmentBytes) + 1;
    for (let i = 0; i < needed - 1; i += 1) sendRecord(1, fragment);
    await settle();
    // Still under the cap: the receiver keeps waiting for the last fragment.
    expect(seen.closes).toBe(0);
    sendRecord(1, fragment);
    await settle();
    expect(seen.closes).toBe(1);
    expect(seen.messages).toEqual([]);
  }, 30_000);
});
