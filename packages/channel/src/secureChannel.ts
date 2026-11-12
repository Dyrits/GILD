import type { Carrier } from "./carrier.ts";
import { NOISE_MAX_MESSAGE_BYTES, NOISE_TAG_BYTES, type TransportKeys } from "./noise/index.ts";

/** Plaintext bytes in one Noise transport message; a flag byte and the 16-byte tag fit under Noise's 65,535 limit. */
export const fragmentBytes = 65000;
/** Largest application message, in bytes, that `send` accepts and a receiver reassembles. */
export const maxMessageBytes = 32 * 1024 * 1024;

const flagLast = 0;
const flagMore = 1;
const noAssociatedData = new Uint8Array(0);

/** An end-to-end encrypted, ordered message stream over a carrier. Messages are bytes; text helpers use UTF-8. */
export interface SecureChannel {
  close(): void;
  /** Runs once when the channel ends, for any reason; added after the end, it runs at once. */
  onClose(listener: () => void): void;
  /** Early messages wait for the first listener, so adding one right after the channel opens loses nothing. */
  onMessage(listener: (data: Uint8Array) => void): void;
  /** Like `onMessage`, decoding UTF-8; a message that is not valid UTF-8 closes the channel. */
  onText(listener: (text: string) => void): void;
  /**
   * Seals and sends one application message, fragmenting it as needed. A send on a closed channel is dropped; a
   * message over `maxMessageBytes` is a caller error and throws a RangeError.
   */
  send(plaintext: Uint8Array): void;
  sendText(text: string): void;
}

/** The channel plus the two entry points the handshake wires to the carrier. */
export class Session implements SecureChannel {
  private readonly messageListeners: Array<(data: Uint8Array) => void> = [];
  private readonly closeListeners: Array<() => void> = [];
  private readonly waiting: Uint8Array[] = [];
  private waitingBytes = 0;
  private fragments: Uint8Array[] = [];
  private fragmentsBytes = 0;
  private isClosed = false;

  constructor(
    private readonly carrier: Carrier,
    private readonly keys: TransportKeys,
  ) {}

  send(plaintext: Uint8Array): void {
    if (plaintext.byteLength > maxMessageBytes) {
      throw new RangeError(`message of ${plaintext.byteLength} bytes exceeds ${maxMessageBytes}`);
    }
    try {
      let offset = 0;
      do {
        // A carrier may close synchronously inside `send`, and a cleared cipher would pass plaintext through.
        if (this.isClosed) return;
        const end = Math.min(offset + fragmentBytes, plaintext.byteLength);
        const record = new Uint8Array(1 + end - offset);
        record[0] = end < plaintext.byteLength ? flagMore : flagLast;
        record.set(plaintext.subarray(offset, end), 1);
        this.carrier.send(this.keys.send.encryptWithAd(noAssociatedData, record));
        offset = end;
      } while (offset < plaintext.byteLength);
    } catch {
      // A carrier that cannot send, or an exhausted counter: the stream is no longer trustworthy or reachable.
      this.close();
    }
  }

  sendText(text: string): void {
    this.send(new TextEncoder().encode(text));
  }

  onMessage(listener: (data: Uint8Array) => void): void {
    this.messageListeners.push(listener);
    const early = this.waiting.splice(0);
    this.waitingBytes = 0;
    for (const data of early) listener(data);
  }

  onText(listener: (text: string) => void): void {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    this.onMessage((data) => {
      let text: string;
      try {
        text = decoder.decode(data);
      } catch {
        this.close();
        return;
      }
      listener(text);
    });
  }

  onClose(listener: () => void): void {
    if (this.isClosed) listener();
    else this.closeListeners.push(listener);
  }

  close(): void {
    if (this.isClosed) return;
    this.end();
    try {
      this.carrier.close();
    } catch {
      // The carrier is already gone, which is what closing wanted.
    }
  }

  /** Called by the handshake when the carrier reports it is closed. */
  carrierClosed(): void {
    this.end();
  }

  /** Called by the handshake for each carrier message after the handshake: opens one record and reassembles. */
  receive(data: Uint8Array): void {
    if (this.isClosed) return;
    const record = this.open(data);
    if (record === null) {
      this.close();
      return;
    }
    const flag = record[0];
    const chunk = record.subarray(1);
    if ((flag !== flagLast && flag !== flagMore) || this.fragmentsBytes + chunk.byteLength > maxMessageBytes) {
      this.close();
      return;
    }
    this.fragments.push(chunk);
    this.fragmentsBytes += chunk.byteLength;
    if (flag === flagMore) return;
    const message = joinFragments(this.fragments, this.fragmentsBytes);
    this.fragments = [];
    this.fragmentsBytes = 0;
    this.deliver(message);
  }

  /** The decrypted record, or null for anything a well-behaved peer would not send. */
  private open(data: Uint8Array): Uint8Array | null {
    if (data.byteLength > NOISE_MAX_MESSAGE_BYTES || data.byteLength < NOISE_TAG_BYTES + 1) return null;
    try {
      return this.keys.receive.decryptWithAd(noAssociatedData, data);
    } catch {
      return null;
    }
  }

  private deliver(message: Uint8Array): void {
    if (this.messageListeners.length > 0) {
      for (const listener of [...this.messageListeners]) listener(message);
      return;
    }
    this.waiting.push(message);
    this.waitingBytes += message.byteLength;
    if (this.waitingBytes > maxMessageBytes) this.close();
  }

  private end(): void {
    if (this.isClosed) return;
    this.isClosed = true;
    this.keys.send.clear();
    this.keys.receive.clear();
    this.fragments = [];
    this.waiting.length = 0;
    for (const listener of this.closeListeners.splice(0)) listener();
  }
}

function joinFragments(fragments: Uint8Array[], total: number): Uint8Array {
  const message = new Uint8Array(total);
  let offset = 0;
  for (const fragment of fragments) {
    message.set(fragment, offset);
    offset += fragment.byteLength;
  }
  return message;
}
