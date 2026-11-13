import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceClient } from "../../src/foundation/client";

class FakeSocket {
  static readonly OPEN = 1;
  static all: FakeSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  constructor(readonly url: string) {
    FakeSocket.all.push(this);
  }
  open() {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }
  fail() {
    this.readyState = 3;
    this.onerror?.();
    this.onclose?.({ code: 1006, reason: "" });
  }
  close() {
    this.readyState = 3;
    this.onclose?.({ code: 1000, reason: "" });
  }
  send() {}
}

const connect = async () => {
  const connecting = ServiceClient.connect();
  await vi.waitFor(() => expect(FakeSocket.all).toHaveLength(1));
  FakeSocket.all[0]?.open();
  return connecting;
};

describe("the service client's reconnection", () => {
  beforeEach(() => {
    FakeSocket.all = [];
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", FakeSocket);
    vi.stubGlobal("window", { iskios: { endpoint: async () => "ws://service" } });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps retrying when a reconnection fails before it opens", async () => {
    const client = await connect();
    FakeSocket.all[0]?.fail();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeSocket.all).toHaveLength(2);
    FakeSocket.all[1]?.fail();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeSocket.all).toHaveLength(3);
    client.close();
  });

  it("stops retrying once closed, even with a connection attempt pending", async () => {
    const client = await connect();
    FakeSocket.all[0]?.fail();
    await vi.advanceTimersByTimeAsync(60_000);
    client.close();
    await vi.advanceTimersByTimeAsync(600_000);
    expect(FakeSocket.all).toHaveLength(2);
    expect(FakeSocket.all[1]?.readyState).toBe(3);
  });
});
