import {
  decodePairingCode,
  encodeBase64Url,
  encodeClientHello,
  type HostReply,
  openInitiator,
  parseHostReply,
  type RefusalReason,
  roomPrologue,
  type SecureChannel,
} from "@iskios/channel";
import { type KnownHost, maxNameLength } from "@iskios/contracts";
import { closeCodes, connectClient } from "@iskios/relay";
import { Effect } from "effect";
import { invalid, ServiceFailure } from "../core/index.ts";
import { isLocalOrigin, RemoteConfig } from "./config.ts";
import { type HostLink, readHostLink, saveHost, touchHost } from "./knownHosts.ts";

// This installation as a controller (device-pairing): it pairs with a host, keeps it, and opens a link to it for the
// app, which then talks to the host's service as it talks to its own.

/** How long pairing or opening a link may take in all. */
const linkMillis = 20_000;

const refusalText = {
  "code-expired": "That pairing code has expired. Ask the host for a new one.",
  "code-invalid": "That pairing code is not valid. Check that you copied all of it, or ask the host for a new one.",
  "code-used": "That pairing code was already used. Ask the host for a new one.",
  disabled: "The host is not accepting paired devices. Turn on Allow paired devices on the host.",
  disconnected: "The host disconnected this computer. Pair with it again.",
  "unknown-device": "The host no longer knows this computer. Pair with it again.",
} as const satisfies Record<RefusalReason, string>;

const failures = {
  hostOffline: new ServiceFailure({
    kind: "ExecutionFailure",
    message: "The host is not connected right now. Check that its Iskios is open and Allow paired devices is on.",
  }),
  timedOut: new ServiceFailure({ kind: "ExecutionFailure", message: "The host did not answer in time." }),
  unreachable: new ServiceFailure({
    kind: "ExecutionFailure",
    message: "Could not reach the relay. Check your internet connection.",
  }),
} as const;

/** What an open link to a host offers the bridge: text both ways, and notice that it ended. */
export interface HostChannel {
  close(): void;
  readonly hostName: string;
  onClose(listener: () => void): void;
  onText(listener: (text: string) => void): void;
  sendText(text: string): void;
}

/** Waits for the host's first text on a channel, or ends the wait when the channel closes or time runs out. */
const firstText = (channel: SecureChannel, millis: number) =>
  new Promise<string | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), millis);
    let isDone = false;
    const settle = (text: string | null) => {
      if (isDone) return;
      isDone = true;
      clearTimeout(timer);
      resolve(text);
    };
    channel.onText((text) => settle(text));
    channel.onClose(() => settle(null));
  });

type Opened =
  | { readonly channel: SecureChannel; readonly ok: true; readonly reply: HostReply }
  | { readonly failure: ServiceFailure; readonly ok: false };

/** Opens the secure channel to a host, saying who this installation is with `hello`, and reads its answer. */
const openToHost = (
  link: Pick<HostLink, "hostPublicKey" | "relayOrigin" | "room">,
  hello: Parameters<typeof encodeClientHello>[0],
) =>
  Effect.promise(async (): Promise<Opened> => {
    try {
      const connected = await connectClient({ relayOrigin: link.relayOrigin, room: link.room });
      if (!connected.ok) return { failure: failures.unreachable, ok: false };
      const connection = connected.value;
      const opened = await openInitiator(connection.carrier, link.hostPublicKey, roomPrologue(link.room), {
        handshakeTimeoutMs: linkMillis,
      });
      if (!opened.ok) {
        connection.carrier.close();
        // The relay says why it closed: no host in the room, or the host left it.
        const code = connection.closeCode();
        const isHostAway = code === closeCodes.hostOffline || code === closeCodes.hostLeft;
        return { failure: isHostAway ? failures.hostOffline : failures.timedOut, ok: false };
      }
      const channel = opened.value;
      channel.sendText(encodeClientHello(hello));
      const text = await firstText(channel, linkMillis);
      const reply = text === null ? null : parseHostReply(text);
      if (reply === null || !reply.ok) {
        channel.close();
        return { failure: failures.timedOut, ok: false };
      }
      return { channel, ok: true, reply: reply.value };
    } catch {
      return { failure: failures.unreachable, ok: false };
    }
  }).pipe(Effect.flatMap((outcome) => (outcome.ok ? Effect.succeed(outcome) : Effect.fail(outcome.failure))));

/** Pairs this installation with the host that made `code`; keeps the host and returns it for the host menu. */
export const pairWithHost = (code: string, deviceName: string) =>
  Effect.gen(function* () {
    const config = yield* RemoteConfig;
    const decoded = decodePairingCode(code);
    if (!decoded.ok) {
      return yield* invalid(
        decoded.kind === "unsupported-version"
          ? "This pairing code is from a newer Iskios. Update this app and try again."
          : refusalText["code-invalid"],
      );
    }
    const pairing = decoded.value;
    // Only a test or a development run names a relay on this computer; a pasted code must not point the app at one.
    if (isLocalOrigin(pairing.relayOrigin) && !isLocalOrigin(config.relayOrigin)) {
      return yield* invalid("This pairing code names a relay on this computer, which is not accepted.");
    }
    const name = deviceName.trim();
    if (name === "" || name.length > maxNameLength) {
      return yield* invalid(`Name this computer in 1 to ${maxNameLength} characters.`);
    }
    const opened = yield* openToHost(pairing, {
      deviceKind: "desktop",
      deviceName: name,
      secret: encodeBase64Url(pairing.secret),
      t: "pair",
    });
    // The host is told everything it needs; the channel closes once the answer is read.
    opened.channel.close();
    if (opened.reply.t === "refused") return yield* invalid(refusalText[opened.reply.reason]);
    if (opened.reply.t !== "paired") return yield* failures.timedOut;
    const reply = opened.reply;
    const host: KnownHost = yield* saveHost(
      {
        deviceId: reply.deviceId,
        deviceToken: reply.token,
        hostName: reply.hostName,
        hostPublicKey: pairing.hostPublicKey,
        relayOrigin: pairing.relayOrigin,
        room: pairing.room,
      },
      Date.now(),
    );
    return host;
  });

/** Opens a link to a saved host: the secure channel, with the host's answer to "resume" already read. */
export const openHostChannel = (hostId: string) =>
  Effect.gen(function* () {
    const link = yield* readHostLink(hostId);
    if (link === null) {
      return yield* new ServiceFailure({ kind: "NotFound", message: "This installation has no such host." });
    }
    const opened = yield* openToHost(link, { deviceId: link.deviceId, t: "resume", token: link.deviceToken });
    if (opened.reply.t === "refused") {
      opened.channel.close();
      return yield* new ServiceFailure({ kind: "AccessRefused", message: refusalText[opened.reply.reason] });
    }
    if (opened.reply.t !== "resumed") {
      opened.channel.close();
      return yield* failures.timedOut;
    }
    const hostName = opened.reply.hostName;
    yield* touchHost(hostId, hostName, Date.now());
    const channel = opened.channel;
    return {
      close: () => channel.close(),
      hostName,
      onClose: (listener) => channel.onClose(listener),
      onText: (listener) => channel.onText(listener),
      sendText: (text) => channel.sendText(text),
    } satisfies HostChannel;
  });
