import type { Carrier } from "../../src/index.ts";

/** What a fake link does with the messages one side sends: returns the messages to deliver, in order. */
export type Interference = (data: Uint8Array, index: number) => Uint8Array[];

export interface FakeCarrier extends Carrier {
  isClosed(): boolean;
  readonly sent: Uint8Array[];
}

/** Two stand-in carriers joined end to end; delivery is asynchronous, in order, and can be interfered with. */
export function fakeCarrierPair(
  options: { fromFirst?: Interference; fromSecond?: Interference } = {},
): [FakeCarrier, FakeCarrier] {
  const first = new Side(options.fromFirst ?? null);
  const second = new Side(options.fromSecond ?? null);
  first.peer = second;
  second.peer = first;
  return [first, second];
}

/** A stand-in carrier whose peer never says anything. */
export function silentCarrier(): FakeCarrier {
  return new Side(null);
}

/** Waits until everything already scheduled by the fake carriers has run. */
export function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 5));
}

class Side implements FakeCarrier {
  readonly sent: Uint8Array[] = [];
  peer: Side | null = null;
  private readonly messageListeners: Array<(data: Uint8Array) => void> = [];
  private readonly closeListeners: Array<() => void> = [];
  private closed = false;

  constructor(private readonly interference: Interference | null) {}

  send(data: Uint8Array): void {
    if (this.closed) throw new Error("fake carrier is closed");
    const index = this.sent.length;
    this.sent.push(data.slice());
    const delivered = this.interference === null ? [data] : this.interference(data.slice(), index);
    for (const message of delivered) {
      queueMicrotask(() => this.peer?.receive(message.slice()));
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const listener of this.closeListeners) listener();
    // The peer learns of the close after everything already sent.
    queueMicrotask(() => this.peer?.closeFromPeer());
  }

  isClosed(): boolean {
    return this.closed;
  }

  onMessage(listener: (data: Uint8Array) => void): void {
    this.messageListeners.push(listener);
  }

  onClose(listener: () => void): void {
    this.closeListeners.push(listener);
  }

  private receive(data: Uint8Array): void {
    if (this.closed) return;
    for (const listener of this.messageListeners) listener(data);
  }

  private closeFromPeer(): void {
    if (this.closed) return;
    this.closed = true;
    for (const listener of this.closeListeners) listener();
  }
}
