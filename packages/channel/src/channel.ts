import type { Carrier } from "./carrier.ts";
import {
  createNoiseInitiator,
  createNoiseResponder,
  generateNoiseKeyPair,
  type NoiseHandshake,
  type NoiseKeyPair,
} from "./noise/index.ts";
import { fail, type Result, succeed } from "./result.ts";
import { type SecureChannel, Session } from "./secureChannel.ts";

/** An X25519 key pair, 32 bytes each: the host's long-term identity. */
export type KeyPair = NoiseKeyPair;

export type ChannelErrorKind = "handshake-failed" | "handshake-timeout" | "carrier-closed";

export type SecureChannelResult = Result<SecureChannel, ChannelErrorKind>;

export interface ChannelOptions {
  /** How long the handshake may take before it gives up; defaults to 15 seconds. */
  handshakeTimeoutMs?: number;
}

export const defaultHandshakeTimeoutMs = 15_000;
const emptyPayload = new Uint8Array(0);

/** Makes a fresh X25519 key pair; a host makes one once and keeps it. */
export function generateKeyPair(): KeyPair {
  return generateNoiseKeyPair();
}

/**
 * The paired device's side: opens an end-to-end encrypted channel to the host whose public key it knows from the
 * pairing code. The prologue is arbitrary bytes both sides must agree on, such as the room name.
 */
export function openInitiator(
  carrier: Carrier,
  hostPublicKey: Uint8Array,
  prologue: Uint8Array,
  options: ChannelOptions = {},
): Promise<SecureChannelResult> {
  let handshake: NoiseHandshake;
  try {
    handshake = createNoiseInitiator({ prologue, remoteStatic: hostPublicKey });
  } catch {
    return Promise.resolve(fail("handshake-failed"));
  }
  return runHandshake(carrier, handshake, true, options);
}

/** The host's side: owns the static key, waits for a device's first message, and answers it. */
export function openResponder(
  carrier: Carrier,
  hostKeyPair: KeyPair,
  prologue: Uint8Array,
  options: ChannelOptions = {},
): Promise<SecureChannelResult> {
  let handshake: NoiseHandshake;
  try {
    handshake = createNoiseResponder({ localStatic: hostKeyPair, prologue });
  } catch {
    return Promise.resolve(fail("handshake-failed"));
  }
  return runHandshake(carrier, handshake, false, options);
}

/**
 * Drives the two NK handshake messages over the carrier and then keeps feeding the same carrier to the session, so a
 * record that arrives right behind the last handshake message is not lost.
 */
function runHandshake(
  carrier: Carrier,
  handshake: NoiseHandshake,
  isInitiator: boolean,
  options: ChannelOptions,
): Promise<SecureChannelResult> {
  return new Promise((resolve) => {
    let session: Session | null = null;
    let isSettled = false;
    const settle = (result: SecureChannelResult) => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const abandon = (kind: "handshake-failed" | "handshake-timeout") => {
      settle(fail(kind));
      carrier.close();
    };
    const timer = setTimeout(
      () => abandon("handshake-timeout"),
      options.handshakeTimeoutMs ?? defaultHandshakeTimeoutMs,
    );

    carrier.onClose(() => {
      if (session === null) settle(fail("carrier-closed"));
      else session.carrierClosed();
    });
    carrier.onMessage((data) => {
      if (session !== null) {
        session.receive(data);
        return;
      }
      // After a failure the carrier is closing; whatever still arrives is ignored.
      if (isSettled) return;
      try {
        handshake.readMessage(data);
        if (!isInitiator) carrier.send(handshake.writeMessage(emptyPayload));
        session = new Session(carrier, handshake.split());
      } catch {
        abandon("handshake-failed");
        return;
      }
      settle(succeed(session));
    });

    if (isInitiator) {
      try {
        carrier.send(handshake.writeMessage(emptyPayload));
      } catch {
        settle(fail("carrier-closed"));
        carrier.close();
      }
    }
  });
}
