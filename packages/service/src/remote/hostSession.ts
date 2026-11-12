import {
  decodeBase64Url,
  encodeBase64Url,
  encodeHostReply,
  type HostReply,
  openResponder,
  parseClientHello,
  type RefusalReason,
  roomPrologue,
  type SecureChannel,
} from "@iskios/channel";
import type { ServerFrame } from "@iskios/contracts";
import type { HostConnection } from "@iskios/relay";
import type { Effect } from "effect";
import type { SqlClient } from "effect/sql";
import type { RemoteConfig } from "./config.ts";
import { encodeServerFrame } from "./frames.ts";
import {
  type HostRecord,
  hostNameOf,
  isDevicePaired,
  readHostRecord,
  redeemPairingSecret,
  resumeDevice,
  touchDevice,
} from "./hostAccess.ts";
import { type ClientLink, carrierOf } from "./hostCarrier.ts";

/** How long a device has to finish the handshake and say who it is. */
const helloMillis = 15_000;
/** A device's "last active" is written at most this often. */
const touchMillis = 30_000;
/** A refusal is sent, then the channel is closed once the answer has had time to leave. */
const refusalGraceMillis = 200;

/** Storage and service work as the host runtime runs it: with the database and the settings provided. */
export type RunWork = <A, E>(effect: Effect.Effect<A, E, SqlClient.SqlClient | RemoteConfig>) => Promise<A>;

/** What serving paired devices needs from the rest of the service. */
export interface DeviceServerParts {
  /** Registers a screen for committed changes and drafts; the returned function removes it. */
  readonly addSession: (send: (frame: ServerFrame) => void) => () => void;
  /** Tells the screens that something they show changed, such as a device connecting. */
  readonly announce: () => void;
  /** Answers a request frame from a paired device through the service. */
  readonly answer: (message: string, send: (frame: ServerFrame) => void) => void;
  /** Registers a connected device so Disconnect can reach it; the returned function removes it. */
  readonly deviceConnected: (deviceId: string, close: () => void) => () => void;
  readonly run: RunWork;
  /** Runs work in one transaction, as redeeming a pairing code must. */
  readonly runInTransaction: RunWork;
}

/** What the supervisor feeds: each client of the room, and what happens when its connection ends. */
export interface DeviceServer {
  /** A frame from a client arrived. */
  readonly deliver: (clientId: string, data: Uint8Array) => void;
  /** Tells every client's carrier that the connection to the relay ended. */
  readonly endAll: () => void;
  /** A client left the room. */
  readonly left: (clientId: string) => void;
  /** A client joined the room: runs its handshake and its hello. */
  readonly serve: (connection: HostConnection, record: HostRecord, clientId: string) => void;
}

/**
 * Serves each client of the host's room through its own end-to-end encrypted channel: the handshake, then who the
 * device is (a pairing code or its token), then its requests, answered as the owner's window's are (device-pairing).
 */
export const createDeviceServer = (parts: DeviceServerParts): DeviceServer => {
  const links = new Map<string, ClientLink>();

  /** Says who a device is from its first message; returns what handles its later messages, or null if refused. */
  const authenticate = async (channel: SecureChannel, text: string): Promise<((message: string) => void) | null> => {
    let isClosed = false;
    channel.onClose(() => {
      isClosed = true;
    });
    const reply = (answer: HostReply) => channel.sendText(encodeHostReply(answer));
    const refuse = (reason: RefusalReason) => {
      reply({ reason, t: "refused" });
      setTimeout(() => channel.close(), refusalGraceMillis);
      return null;
    };
    const parsed = parseClientHello(text);
    if (!parsed.ok) {
      channel.close();
      return null;
    }
    const hello = parsed.value;
    // The switch may have gone off after this connection was made: nobody pairs or resumes while it is off.
    const record = await parts.run(readHostRecord);
    if (record === null || !record.isEnabled) return refuse("disabled");

    const now = Date.now();
    let deviceId: string;
    let newToken: Uint8Array | null = null;
    if (hello.t === "pair") {
      const secret = decodeBase64Url(hello.secret);
      if (secret === null) return refuse("code-invalid");
      const outcome = await parts.runInTransaction(
        redeemPairingSecret(secret, { kind: hello.deviceKind, name: hello.deviceName }, now),
      );
      if ("refusal" in outcome) return refuse(outcome.refusal);
      deviceId = outcome.device.deviceId;
      newToken = outcome.device.token;
    } else {
      const token = decodeBase64Url(hello.token);
      const name = token === null ? null : await parts.run(resumeDevice(hello.deviceId, token, now));
      if (name === null) return refuse("unknown-device");
      deviceId = hello.deviceId;
    }

    // Registered before the answer, then checked: a Disconnect that came in between would otherwise leave this device
    // connected with the authority of an owner it no longer has.
    const removeConnection = parts.deviceConnected(deviceId, () => channel.close());
    if (!(await parts.run(isDevicePaired(deviceId)))) {
      removeConnection();
      return refuse("disconnected");
    }
    const current = await parts.run(readHostRecord);
    if (isClosed || current === null || !current.isEnabled) {
      removeConnection();
      channel.close();
      return null;
    }
    const hostName = await parts.run(hostNameOf(current));
    reply(
      newToken === null
        ? { hostName, t: "resumed" }
        : { deviceId, hostName, t: "paired", token: encodeBase64Url(newToken) },
    );

    const send = (frame: ServerFrame) => channel.sendText(encodeServerFrame(frame));
    const removeSession = parts.addSession(send);
    channel.onClose(() => {
      removeSession();
      removeConnection();
      parts.announce();
    });
    parts.announce();

    let lastTouch = now;
    return (message) => {
      const at = Date.now();
      if (at - lastTouch > touchMillis) {
        lastTouch = at;
        void parts.run(touchDevice(deviceId, at)).catch(reportFailure);
      }
      parts.answer(message, send);
    };
  };

  const serve = (connection: HostConnection, record: HostRecord, clientId: string) => {
    const link = carrierOf(connection, clientId);
    links.set(clientId, link);
    const hello = setTimeout(() => link.carrier.close(), helloMillis);
    void openResponder(
      link.carrier,
      { publicKey: record.publicKey, secretKey: record.secretKey },
      roomPrologue(record.room),
      { handshakeTimeoutMs: helloMillis },
    )
      .then((opened) => {
        if (!opened.ok) {
          clearTimeout(hello);
          return;
        }
        const channel = opened.value;
        let handle: ((message: string) => void) | null = null;
        let isAuthenticating = false;
        channel.onText((message) => {
          if (handle !== null) {
            handle(message);
            return;
          }
          if (isAuthenticating) {
            channel.close();
            return;
          }
          isAuthenticating = true;
          void authenticate(channel, message)
            .then((session) => {
              clearTimeout(hello);
              handle = session;
            })
            .catch((reason) => {
              reportFailure(reason);
              channel.close();
            });
        });
        channel.onClose(() => clearTimeout(hello));
      })
      .catch(reportFailure);
  };

  return {
    deliver: (clientId, data) => links.get(clientId)?.deliver(data),
    endAll: () => {
      for (const link of links.values()) link.end();
      links.clear();
    },
    left: (clientId) => {
      links.get(clientId)?.end();
      links.delete(clientId);
    },
    serve,
  };
};

/** A failure of background storage work has no screen to show it on: it goes to the service's log. */
export const reportFailure = (reason: unknown) => {
  console.error("Iskios device pairing:", reason);
};
