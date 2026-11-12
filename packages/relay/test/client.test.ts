import { afterEach, describe, expect, it } from "vitest";
import { WebSocketServer } from "ws";
import { connectClient, connectHost } from "../src/client.ts";
import { closingFrame } from "../src/roomCore.ts";
import { room } from "./fixtures/wsClient.ts";

// A relay that says why it closes a connection, then keeps the connection open: a client that waits for the close
// would learn nothing (Node's own WebSocket waits about ten seconds for the connection to end), so it must act on the
// frame. This server never closes anything.
let server: WebSocketServer | null = null;
const sockets: import("ws").WebSocket[] = [];

const serve = async (onConnection: (socket: import("ws").WebSocket) => void) => {
  const created = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  server = created;
  created.on("connection", (socket) => {
    sockets.push(socket);
    socket.on("error", () => null);
    onConnection(socket);
  });
  await new Promise<void>((resolve) => created.once("listening", resolve));
  return `http://127.0.0.1:${(created.address() as { port: number }).port}`;
};

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.terminate();
  const closing = server;
  server = null;
  if (closing !== null) await new Promise<void>((resolve) => closing.close(() => resolve()));
});

const within = <A>(millis: number, work: Promise<A>) =>
  Promise.race([work, new Promise<"too slow">((resolve) => setTimeout(() => resolve("too slow"), millis))]);

describe("a client of the relay", () => {
  it("learns why the relay closed it from the frame, while the connection is still open", async () => {
    const relayOrigin = await serve((socket) => socket.send(closingFrame(1013, "host offline")));
    const connected = await connectClient({ relayOrigin, room });
    if (!connected.ok) throw new Error("not connected");
    const ended = new Promise<void>((resolve) => connected.value.carrier.onClose(resolve));
    expect(await within(1500, ended)).toBeUndefined();
    expect(connected.value.closeCode()).toBe(1013);
  });

  it("reads the frame even when it arrives before anyone is listening", async () => {
    const relayOrigin = await serve((socket) => socket.send(closingFrame(1001, "host left")));
    const connected = await connectClient({ relayOrigin, room });
    if (!connected.ok) throw new Error("not connected");
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(connected.value.closeCode()).toBe(1001);
    let told = 0;
    connected.value.carrier.onClose(() => {
      told += 1;
    });
    expect(told).toBe(1);
  });

  it("tells its listeners once when the frame and the close both arrive", async () => {
    const relayOrigin = await serve((socket) => {
      socket.send(closingFrame(1001, "host left"));
      setTimeout(() => socket.close(1001, "host left"), 200);
    });
    const connected = await connectClient({ relayOrigin, room });
    if (!connected.ok) throw new Error("not connected");
    let told = 0;
    connected.value.carrier.onClose(() => {
      told += 1;
    });
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(told).toBe(1);
    expect(connected.value.closeCode()).toBe(1001);
  });

  it("does not take a pong, a stray text, or a frame that is not a closing for the end", async () => {
    const relayOrigin = await serve((socket) => {
      socket.send("pong");
      socket.send("hello");
      socket.send('{"closing":7}');
    });
    const connected = await connectClient({ relayOrigin, room });
    if (!connected.ok) throw new Error("not connected");
    let told = 0;
    connected.value.carrier.onClose(() => {
      told += 1;
    });
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(told).toBe(0);
    expect(connected.value.closeCode()).toBeNull();
  });
});

describe("a host of the relay", () => {
  it("learns why the relay closed it from the frame, while the connection is still open", async () => {
    const relayOrigin = await serve((socket) => socket.send(closingFrame(1008, "claim mismatch")));
    const connected = await connectHost({ claim: new Uint8Array(32).fill(7), relayOrigin, room });
    if (!connected.ok) throw new Error("not connected");
    const ended = new Promise<{ code: number; reason: string }>((resolve) =>
      connected.value.onClose((code, reason) => resolve({ code, reason })),
    );
    expect(await within(1500, ended)).toEqual({ code: 1008, reason: "claim mismatch" });
  });

  it("tells its listener once when the frame and the close both arrive", async () => {
    const relayOrigin = await serve((socket) => {
      socket.send(closingFrame(1012, "replaced"));
      setTimeout(() => socket.close(1012, "replaced"), 200);
    });
    const connected = await connectHost({ claim: new Uint8Array(32).fill(7), relayOrigin, room });
    if (!connected.ok) throw new Error("not connected");
    const seen: number[] = [];
    connected.value.onClose((code) => seen.push(code));
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(seen).toEqual([1012]);
  });
});
