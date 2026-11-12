/**
 * Anything that moves whole messages between two peers, in order: a WebSocket through the relay today, a WebRTC data
 * channel later. The secure channel adds no framing of its own around the messages it hands to a carrier.
 */
export interface Carrier {
  close(): void;
  onClose(listener: () => void): void;
  onMessage(listener: (data: Uint8Array) => void): void;
  send(data: Uint8Array): void;
}
