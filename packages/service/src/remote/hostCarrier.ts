import type { Carrier } from "@iskios/channel";
import type { HostConnection } from "@iskios/relay";

/** One client's connection through the relay, as the secure channel's carrier, with the two ends the runtime feeds. */
export interface ClientLink {
  readonly carrier: Carrier;
  /** Hands the carrier a frame that arrived from the client. */
  readonly deliver: (data: Uint8Array) => void;
  /** Tells the carrier its client is gone. */
  readonly end: () => void;
}

/** A client of the host's room, seen through the host's one connection to the relay. */
export const carrierOf = (connection: HostConnection, clientId: string): ClientLink => {
  const messages: Array<(data: Uint8Array) => void> = [];
  const closes: Array<() => void> = [];
  let isEnded = false;
  return {
    carrier: {
      close: () => connection.closeClient(clientId),
      onClose: (listener) => {
        if (isEnded) listener();
        else closes.push(listener);
      },
      onMessage: (listener) => void messages.push(listener),
      send: (data) => connection.sendToClient(clientId, data),
    },
    deliver: (data) => {
      for (const listener of messages) listener(data);
    },
    end: () => {
      isEnded = true;
      for (const listener of closes) listener();
    },
  };
};
