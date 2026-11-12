/**
 * Adapted from Paseo (https://github.com/getpaseo/paseo), Apache-2.0, Copyright (c) Mohamed Boudra; modified for Iskios.
 */
import { x25519 } from "@noble/curves/ed25519.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { describe, expect, it } from "vitest";
import {
  CipherState,
  createNoiseInitiator,
  createNoiseResponder,
  generateNoiseKeyPair,
  NOISE_NK_PROTOCOL_NAME,
  NoiseProtocolError,
} from "../../src/noise/index.ts";
import { nkVectors } from "../fixtures/nkVectors.ts";

const empty = new Uint8Array(0);
const prologue = new TextEncoder().encode("test");

const keyPairFromSecret = (secretHex: string) => {
  const secretKey = hexToBytes(secretHex);
  return { publicKey: x25519.getPublicKey(secretKey), secretKey };
};

/** Runs a full handshake between fresh keys and returns both sides' transport keys. */
const handshakeKeys = () => {
  const host = generateNoiseKeyPair();
  const initiator = createNoiseInitiator({ prologue, remoteStatic: host.publicKey });
  const responder = createNoiseResponder({ localStatic: host, prologue });
  responder.readMessage(initiator.writeMessage(empty));
  initiator.readMessage(responder.writeMessage(empty));
  return { client: initiator.split(), server: responder.split() };
};

describe("Noise NK handshake", () => {
  for (const vector of nkVectors) {
    it(`matches the vector from ${vector.source}`, () => {
      const responderStatic = keyPairFromSecret(vector.responderStatic);
      expect(bytesToHex(responderStatic.publicKey)).toBe(vector.responderStaticPublic);
      const initiator = createNoiseInitiator({
        ephemeral: keyPairFromSecret(vector.initiatorEphemeral),
        prologue: hexToBytes(vector.initiatorPrologue),
        remoteStatic: hexToBytes(vector.responderStaticPublic),
      });
      const responder = createNoiseResponder({
        ephemeral: keyPairFromSecret(vector.responderEphemeral),
        localStatic: responderStatic,
        prologue: hexToBytes(vector.responderPrologue),
      });

      const [first, second, ...transport] = vector.messages;
      if (first === void 0 || second === void 0) throw new Error("vector without handshake messages");
      const message1 = initiator.writeMessage(hexToBytes(first.payload));
      expect(bytesToHex(message1)).toBe(first.ciphertext);
      expect(bytesToHex(responder.readMessage(message1))).toBe(first.payload);
      const message2 = responder.writeMessage(hexToBytes(second.payload));
      expect(bytesToHex(message2)).toBe(second.ciphertext);
      expect(bytesToHex(initiator.readMessage(message2))).toBe(second.payload);
      expect(initiator.isComplete()).toBe(true);
      expect(responder.isComplete()).toBe(true);
      if (vector.handshakeHash !== null) {
        expect(bytesToHex(initiator.handshakeHash())).toBe(vector.handshakeHash);
        expect(bytesToHex(responder.handshakeHash())).toBe(vector.handshakeHash);
      }

      const initiatorKeys = initiator.split();
      const responderKeys = responder.split();
      transport.forEach((message, index) => {
        const isFromInitiator = index % 2 === 0;
        const sender = isFromInitiator ? initiatorKeys.send : responderKeys.send;
        const receiver = isFromInitiator ? responderKeys.receive : initiatorKeys.receive;
        const ciphertext = sender.encryptWithAd(empty, hexToBytes(message.payload));
        expect(bytesToHex(ciphertext)).toBe(message.ciphertext);
        expect(bytesToHex(receiver.decryptWithAd(empty, ciphertext))).toBe(message.payload);
      });
    });
  }

  it("names the protocol it implements", () => {
    expect(NOISE_NK_PROTOCOL_NAME).toBe("Noise_NK_25519_ChaChaPoly_SHA256");
  });

  it("rejects a handshake message with one flipped byte", () => {
    const host = generateNoiseKeyPair();
    for (const position of [0, 31, 32, 47]) {
      const initiator = createNoiseInitiator({ prologue, remoteStatic: host.publicKey });
      const responder = createNoiseResponder({ localStatic: host, prologue });
      const message = initiator.writeMessage(empty);
      message[position] = (message[position] ?? 0) ^ 1;
      expect(() => responder.readMessage(message), `byte ${position}`).toThrow(NoiseProtocolError);
    }
  });

  it("rejects a different prologue", () => {
    const host = generateNoiseKeyPair();
    const initiator = createNoiseInitiator({ prologue, remoteStatic: host.publicKey });
    const responder = createNoiseResponder({ localStatic: host, prologue: new TextEncoder().encode("other") });
    expect(() => responder.readMessage(initiator.writeMessage(empty))).toThrow(NoiseProtocolError);
  });

  it("rejects a replayed, reflected, or out-of-order transport message", () => {
    const { client, server } = handshakeKeys();
    const first = client.send.encryptWithAd(empty, new Uint8Array([1]));
    const second = client.send.encryptWithAd(empty, new Uint8Array([2]));
    expect(server.receive.decryptWithAd(empty, first)).toEqual(new Uint8Array([1]));
    // duplicate
    expect(() => server.receive.decryptWithAd(empty, first)).toThrow(NoiseProtocolError);
    // a failed attempt did not advance the counter: the genuine next record still decrypts
    expect(server.receive.decryptWithAd(empty, second)).toEqual(new Uint8Array([2]));
    // reflection: a record the client sent, handed back to the client
    expect(() => client.receive.decryptWithAd(empty, second)).toThrow(NoiseProtocolError);
    // out of order
    const third = client.send.encryptWithAd(empty, new Uint8Array([3]));
    const fourth = client.send.encryptWithAd(empty, new Uint8Array([4]));
    expect(() => server.receive.decryptWithAd(empty, fourth)).toThrow(NoiseProtocolError);
    expect(server.receive.decryptWithAd(empty, third)).toEqual(new Uint8Array([3]));
    expect(server.receive.decryptWithAd(empty, fourth)).toEqual(new Uint8Array([4]));
  });

  it("rejects a transport record with one flipped byte", () => {
    const { client, server } = handshakeKeys();
    const record = client.send.encryptWithAd(empty, new Uint8Array([1, 2, 3]));
    record[0] = (record[0] ?? 0) ^ 1;
    expect(() => server.receive.decryptWithAd(empty, record)).toThrow(NoiseProtocolError);
  });

  it("does not let a recorded first message derive the keys of a fresh responder", () => {
    const host = generateNoiseKeyPair();
    const initiator = createNoiseInitiator({ prologue, remoteStatic: host.publicKey });
    const message1 = initiator.writeMessage(empty);
    const original = createNoiseResponder({ localStatic: host, prologue });
    original.readMessage(message1);
    initiator.readMessage(original.writeMessage(empty));
    const record = initiator.split().send.encryptWithAd(empty, new Uint8Array([7]));

    const replayTarget = createNoiseResponder({ localStatic: host, prologue });
    replayTarget.readMessage(message1);
    replayTarget.writeMessage(empty);
    expect(() => replayTarget.split().receive.decryptWithAd(empty, record)).toThrow(NoiseProtocolError);
  });

  it("rejects a low-order remote ephemeral and a wrong responder key", () => {
    const host = generateNoiseKeyPair();
    const responder = createNoiseResponder({ localStatic: host, prologue });
    expect(() => responder.readMessage(new Uint8Array(32 + 16))).toThrow(NoiseProtocolError);

    const other = generateNoiseKeyPair();
    const initiator = createNoiseInitiator({ prologue, remoteStatic: other.publicKey });
    const victim = createNoiseResponder({ localStatic: host, prologue });
    expect(() => victim.readMessage(initiator.writeMessage(empty))).toThrow(NoiseProtocolError);
  });

  it("rejects a key of the wrong length", () => {
    expect(() => createNoiseInitiator({ prologue, remoteStatic: new Uint8Array(31) })).toThrow(NoiseProtocolError);
  });

  it("stops at the last nonce in both directions and keeps state on a failed tag", () => {
    const max = (1n << 64n) - 1n;
    const key = new Uint8Array(32).map((_, index) => index + 1);
    const sender = new CipherState();
    const receiver = new CipherState();
    sender.initializeKey(key.slice(), max - 1n);
    receiver.initializeKey(key.slice(), max - 1n);
    const last = sender.encryptWithAd(empty, new Uint8Array([1, 2, 3]));
    expect(sender.nonce()).toBe(max);
    expect(() => sender.encryptWithAd(empty, new Uint8Array([4]))).toThrow("nonce exhausted");
    expect(sender.nonce()).toBe(max);

    const tampered = last.slice();
    tampered[0] = (tampered[0] ?? 0) ^ 1;
    expect(() => receiver.decryptWithAd(empty, tampered)).toThrow("authentication failed");
    expect(receiver.nonce()).toBe(max - 1n);
    expect(Array.from(receiver.decryptWithAd(empty, last))).toEqual([1, 2, 3]);
    expect(receiver.nonce()).toBe(max);
    expect(() => receiver.decryptWithAd(empty, last)).toThrow("nonce exhausted");
  });

  it("refuses to proceed out of turn or after completion", () => {
    const host = generateNoiseKeyPair();
    const initiator = createNoiseInitiator({ prologue: empty, remoteStatic: host.publicKey });
    const responder = createNoiseResponder({ localStatic: host, prologue: empty });
    expect(() => responder.writeMessage(empty)).toThrow(NoiseProtocolError);
    expect(() => initiator.split()).toThrow(NoiseProtocolError);
    responder.readMessage(initiator.writeMessage(empty));
    expect(() => initiator.writeMessage(empty)).toThrow(NoiseProtocolError);
    initiator.readMessage(responder.writeMessage(empty));
    expect(() => initiator.readMessage(empty)).toThrow(NoiseProtocolError);
    initiator.split();
    expect(() => initiator.split()).toThrow(NoiseProtocolError);
  });
});
