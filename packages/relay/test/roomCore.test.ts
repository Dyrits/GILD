import { describe, expect, it } from "vitest";
import { closingFrame, hostFrame, readClosingFrame, relayFrame } from "../src/roomCore.ts";
import { createFakeRoom, type FakePeer, hostFrameOf, idOf } from "./fixtures/fakeRoom.ts";

const bytes = (...values: number[]) => Uint8Array.from(values);

describe("claiming a room", () => {
  it("keeps the room for the first host and stores only a hash of its claim", async () => {
    const { connect, storage } = createFakeRoom();
    const host = await connect("host", "first");
    expect(host.closed).toBeNull();
    expect(storage.claim?.length).toBe(32);
    expect(storage.writes).toBe(1);
  });

  it("closes a host with another claim as a claim mismatch", async () => {
    const { connect } = createFakeRoom();
    await connect("host", "first");
    const other = await connect("host", "second");
    expect(other.closed).toEqual({ code: 1008, reason: "claim mismatch" });
  });

  it("leaves the current host connected when another claim is refused", async () => {
    const { connect } = createFakeRoom();
    const host = await connect("host", "first");
    await connect("host", "second");
    expect(host.closed).toBeNull();
  });

  it("lets only one of two first hosts arriving together take the room", async () => {
    const { connect } = createFakeRoom();
    const [a, b] = await Promise.all([connect("host", "alpha"), connect("host", "bravo")]);
    expect([a.closed, b.closed].filter((closed) => closed !== null)).toEqual([
      { code: 1008, reason: "claim mismatch" },
    ]);
  });

  it("closes a host that presents no claim", async () => {
    const { connect } = createFakeRoom();
    const host = await connect("host");
    expect(host.closed?.code).toBe(1008);
  });

  it("replaces the old host when a host with the same claim connects", async () => {
    const { connect } = createFakeRoom();
    const old = await connect("host", "first");
    const next = await connect("host", "first");
    expect(old.closed).toEqual({ code: 1012, reason: "replaced" });
    expect(next.closed).toBeNull();
  });

  it("ends the clients of a replaced host", async () => {
    const { connect } = createFakeRoom();
    await connect("host", "first");
    const client = await connect("client");
    await connect("host", "first");
    expect(client.closed).toEqual({ code: 1001, reason: "host left" });
  });

  it("keeps the claim after its host has left", async () => {
    const { connect, core } = createFakeRoom();
    const host = await connect("host", "first");
    core.close(host);
    const other = await connect("host", "second");
    expect(other.closed?.code).toBe(1008);
    const same = await connect("host", "first");
    expect(same.closed).toBeNull();
  });
});

describe("joining a room", () => {
  it("closes a client at once when no host is connected", async () => {
    const { connect } = createFakeRoom();
    const client = await connect("client");
    expect(client.closed).toEqual({ code: 1013, reason: "host offline" });
  });

  it("tells the host when a client joins, with an 8 byte id", async () => {
    const { connect } = createFakeRoom();
    const host = await connect("host", "first");
    await connect("client");
    const [notice] = host.frames();
    expect(notice?.length).toBe(9);
    expect(notice?.[0]).toBe(relayFrame.joined);
  });

  it("gives each client its own id", async () => {
    const { connect } = createFakeRoom();
    const host = await connect("host", "first");
    await connect("client");
    await connect("client");
    const [a, b] = host.frames();
    expect(idOf(a ?? bytes())).not.toEqual(idOf(b ?? bytes()));
  });

  it("tells the host when a client leaves", async () => {
    const { connect, core } = createFakeRoom();
    const host = await connect("host", "first");
    const client = await connect("client");
    core.close(client);
    const [joined, left] = host.frames();
    expect(left?.[0]).toBe(relayFrame.left);
    expect(idOf(left ?? bytes())).toEqual(idOf(joined ?? bytes()));
  });

  it("closes every client with host left when the host leaves", async () => {
    const { connect, core } = createFakeRoom();
    const host = await connect("host", "first");
    const a = await connect("client");
    const b = await connect("client");
    core.close(host);
    expect(a.closed).toEqual({ code: 1001, reason: "host left" });
    expect(b.closed).toEqual({ code: 1001, reason: "host left" });
  });

  it("closes a client at once once the host has left", async () => {
    const { connect, core } = createFakeRoom();
    const host = await connect("host", "first");
    core.close(host);
    const client = await connect("client");
    expect(client.closed).toEqual({ code: 1013, reason: "host offline" });
  });

  it("closes the ninth client as room full", async () => {
    const { connect } = createFakeRoom();
    await connect("host", "first");
    const clients = [];
    for (let count = 0; count < 9; count += 1) clients.push(await connect("client"));
    expect(clients.slice(0, 8).every((client) => client.closed === null)).toBe(true);
    expect(clients[8]?.closed).toEqual({ code: 1013, reason: "room full" });
  });

  it("holds as many clients as configured", async () => {
    const { connect } = createFakeRoom({ maxClients: 2 });
    await connect("host", "first");
    await connect("client");
    await connect("client");
    const third = await connect("client");
    expect(third.closed?.reason).toBe("room full");
  });

  it("admits a client again once a place is free", async () => {
    const { connect, core } = createFakeRoom({ maxClients: 1 });
    await connect("host", "first");
    const first = await connect("client");
    core.close(first);
    const second = await connect("client");
    expect(second.closed).toBeNull();
  });
});

describe("forwarding", () => {
  it("passes a client's frame to the host behind its type and id, unchanged", async () => {
    const { connect, core } = createFakeRoom();
    const host = await connect("host", "first");
    const client = await connect("client");
    const [joined] = host.frames();
    core.receive(client, bytes(9, 8, 7, 0, 255));
    const forwarded = host.frames()[1];
    expect(forwarded).toEqual(hostFrameOf(relayFrame.forward, idOf(joined ?? bytes()), [9, 8, 7, 0, 255]));
  });

  it("passes a frame from the host to the addressed client only, without a prefix", async () => {
    const { connect, core } = createFakeRoom();
    const host = await connect("host", "first");
    const a = await connect("client");
    const b = await connect("client");
    const [joinedA] = host.frames();
    core.receive(host, hostFrameOf(hostFrame.forward, idOf(joinedA ?? bytes()), [1, 2, 3]));
    expect(a.frames()).toEqual([bytes(1, 2, 3)]);
    expect(b.frames()).toEqual([]);
  });

  it("keeps clients from seeing each other", async () => {
    const { connect, core } = createFakeRoom();
    await connect("host", "first");
    const a = await connect("client");
    const b = await connect("client");
    core.receive(a, bytes(1, 2, 3));
    expect(a.sent).toEqual([]);
    expect(b.sent).toEqual([]);
  });

  it("tells clients apart by id when two send", async () => {
    const { connect, core } = createFakeRoom();
    const host = await connect("host", "first");
    const a = await connect("client");
    const b = await connect("client");
    core.receive(a, bytes(1));
    core.receive(b, bytes(2));
    const [joinedA, joinedB, fromA, fromB] = host.frames();
    expect(idOf(fromA ?? bytes())).toEqual(idOf(joinedA ?? bytes()));
    expect(idOf(fromB ?? bytes())).toEqual(idOf(joinedB ?? bytes()));
  });

  it("passes an empty client frame on as a bare prefix", async () => {
    const { connect, core } = createFakeRoom();
    const host = await connect("host", "first");
    const client = await connect("client");
    core.receive(client, bytes());
    expect(host.frames()[1]?.length).toBe(9);
  });

  it("ignores a frame for an unknown client id", async () => {
    const { connect, core } = createFakeRoom();
    const host = await connect("host", "first");
    const client = await connect("client");
    core.receive(host, hostFrameOf(hostFrame.forward, new Uint8Array(8), [1]));
    expect(client.sent).toEqual([]);
    expect(host.closed).toBeNull();
  });

  it("closes a client with disconnected when the host asks", async () => {
    const { connect, core } = createFakeRoom();
    const host = await connect("host", "first");
    const a = await connect("client");
    const b = await connect("client");
    const [joinedA] = host.frames();
    core.receive(host, hostFrameOf(hostFrame.disconnect, idOf(joinedA ?? bytes())));
    expect(a.closed).toEqual({ code: 1000, reason: "disconnected" });
    expect(b.closed).toBeNull();
  });

  it("ignores a disconnect for an unknown client id", async () => {
    const { connect, core } = createFakeRoom();
    const host = await connect("host", "first");
    const client = await connect("client");
    core.receive(host, hostFrameOf(hostFrame.disconnect, new Uint8Array(8)));
    expect(client.closed).toBeNull();
  });

  it("forwards nothing from a client that has been closed", async () => {
    const { connect, core } = createFakeRoom();
    const host = await connect("host", "first");
    const client = await connect("client");
    core.close(client);
    core.receive(client, bytes(1));
    expect(host.frames().map((frame) => frame[0])).toEqual([relayFrame.joined, relayFrame.left]);
  });

  it("counts the frames it passes on", async () => {
    const { connect, core } = createFakeRoom();
    const host = await connect("host", "first");
    const client = await connect("client");
    core.receive(client, bytes(1));
    core.receive(host, hostFrameOf(hostFrame.forward, idOf(host.frames()[0] ?? bytes()), [2]));
    expect(core.framesForwarded).toBe(2);
  });
});

describe("limits and malformed frames", () => {
  it("closes a host frame that is too short with 1002", async () => {
    const { connect, core } = createFakeRoom();
    const host = await connect("host", "first");
    core.receive(host, bytes(1, 2, 3));
    expect(host.closed?.code).toBe(1002);
  });

  it("closes an empty host frame with 1002", async () => {
    const { connect, core } = createFakeRoom();
    const host = await connect("host", "first");
    core.receive(host, bytes());
    expect(host.closed?.code).toBe(1002);
  });

  it("closes a host frame of an unknown type with 1002", async () => {
    const { connect, core } = createFakeRoom();
    const host = await connect("host", "first");
    core.receive(host, hostFrameOf(7, new Uint8Array(8)));
    expect(host.closed?.code).toBe(1002);
  });

  it("closes the clients when the host is closed for a malformed frame", async () => {
    const { connect, core } = createFakeRoom();
    const host = await connect("host", "first");
    const client = await connect("client");
    core.receive(host, bytes(1));
    expect(client.closed?.reason).toBe("host left");
  });

  it("closes a client frame over the limit with 1009 and tells the host it left", async () => {
    const { connect, core } = createFakeRoom({ maxFrameBytes: 100 });
    const host = await connect("host", "first");
    const client = await connect("client");
    core.receive(client, new Uint8Array(101));
    expect(client.closed?.code).toBe(1009);
    expect(host.frames().map((frame) => frame[0])).toEqual([relayFrame.joined, relayFrame.left]);
  });

  it("counts the prefix a client frame gets towards the limit", async () => {
    const { connect, core } = createFakeRoom({ maxFrameBytes: 100 });
    const host = await connect("host", "first");
    const client = await connect("client");
    core.receive(client, new Uint8Array(92));
    expect(client.closed?.code).toBe(1009);
    expect(host.frames()).toHaveLength(2);
  });

  it("accepts a client frame that fits the limit with its prefix", async () => {
    const { connect, core } = createFakeRoom({ maxFrameBytes: 100 });
    const host = await connect("host", "first");
    const client = await connect("client");
    core.receive(client, new Uint8Array(91));
    expect(client.closed).toBeNull();
    expect(host.frames()[1]?.length).toBe(100);
  });

  it("closes a host frame over the limit with 1009", async () => {
    const { connect, core } = createFakeRoom({ maxFrameBytes: 100 });
    const host = await connect("host", "first");
    core.receive(host, new Uint8Array(101));
    expect(host.closed?.code).toBe(1009);
  });

  it("limits frames to 1 MiB by default", async () => {
    const { connect, core } = createFakeRoom();
    const host = await connect("host", "first");
    const client = await connect("client");
    core.receive(client, new Uint8Array(1024 * 1024 - 9));
    expect(client.closed).toBeNull();
    core.receive(host, new Uint8Array(1024 * 1024 + 1));
    expect(host.closed?.code).toBe(1009);
  });
});

describe("keepalive", () => {
  it("answers a ping text frame with pong", async () => {
    const { connect, core } = createFakeRoom();
    const host = await connect("host", "first");
    const client = await connect("client");
    core.receive(host, "ping");
    core.receive(client, "ping");
    expect(host.sent.filter((data) => typeof data === "string")).toEqual(["pong"]);
    expect(client.sent).toEqual(["pong"]);
  });

  it("closes a sender of any other text frame with 1003", async () => {
    const { connect, core } = createFakeRoom();
    await connect("host", "first");
    const client = await connect("client");
    core.receive(client, "hello");
    expect(client.closed?.code).toBe(1003);
  });
});

// A client of a relay in front of a proxy may learn of a close late (Node's own WebSocket waits about ten seconds for
// the connection to end), so the relay says why in a text frame sent just before it closes: the reason is read at once.
describe("saying why a connection is closed", () => {
  /** The closing frames a peer was sent before it was closed, and nothing sent after. */
  const closingsOf = (peer: FakePeer) => {
    const texts = peer.sent.filter((data): data is string => typeof data === "string");
    const closings = texts.map(readClosingFrame);
    expect(closings.every((closing) => closing !== null)).toBe(true);
    // Sent before the close, so the peer reads it first.
    expect(peer.sentWhenClosed).toBe(peer.sent.length);
    return closings;
  };

  it("builds a frame that reads back, and reads nothing else as one", () => {
    expect(readClosingFrame(closingFrame(1013, "host offline"))).toEqual({ code: 1013, reason: "host offline" });
    for (const text of [
      "pong",
      "ping",
      "",
      "{}",
      "[]",
      "null",
      '{"closing":1}',
      '{"closing":{"code":"1013","reason":"x"}}',
      '{"closing":{"code":1013}}',
      '{"closing":{"code":5,"reason":"x"}}',
      '{"closing":{"code":1013,"reason":7}}',
      "{not json",
    ])
      expect(readClosingFrame(text), text).toBeNull();
  });

  it("tells a client there is no host before it closes it", async () => {
    const { connect } = createFakeRoom();
    const client = await connect("client");
    expect(closingsOf(client)).toEqual([{ code: 1013, reason: "host offline" }]);
  });

  it("tells the ninth client the room is full", async () => {
    const { connect } = createFakeRoom();
    await connect("host", "first");
    const clients: FakePeer[] = [];
    for (let count = 0; count < 9; count += 1) clients.push(await connect("client"));
    expect(closingsOf(clients[8] as FakePeer)).toEqual([{ code: 1013, reason: "room full" }]);
    expect(clients[0]?.sent).toEqual([]);
  });

  it("tells every client the host left, whether it left or was replaced", async () => {
    const { connect, core } = createFakeRoom();
    const host = await connect("host", "first");
    const a = await connect("client");
    core.close(host);
    expect(closingsOf(a)).toEqual([{ code: 1001, reason: "host left" }]);
    const next = await connect("host", "first");
    const b = await connect("client");
    await connect("host", "first");
    expect(closingsOf(b)).toEqual([{ code: 1001, reason: "host left" }]);
    expect(closingsOf(next)).toEqual([{ code: 1012, reason: "replaced" }]);
  });

  it("tells a host with another claim that the claim does not match", async () => {
    const { connect } = createFakeRoom();
    await connect("host", "first");
    expect(closingsOf(await connect("host", "second"))).toEqual([{ code: 1008, reason: "claim mismatch" }]);
    expect(closingsOf(await connect("host"))).toEqual([{ code: 1008, reason: "claim mismatch" }]);
  });

  it("tells a connection it broke a rule", async () => {
    const { connect, core } = createFakeRoom();
    const host = await connect("host", "first");
    const text = await connect("client");
    core.receive(text, "hello");
    expect(closingsOf(text)).toEqual([{ code: 1003, reason: "text frames are not supported" }]);
    const big = await connect("client");
    core.receive(big, new Uint8Array(1024 * 1024 + 1));
    expect(closingsOf(big)).toEqual([{ code: 1009, reason: "frame too large" }]);
    core.receive(host, new Uint8Array(3));
    expect(closingsOf(host)).toEqual([{ code: 1002, reason: "malformed frame" }]);
  });

  it("tells a client the host disconnected it", async () => {
    const { connect, core } = createFakeRoom();
    const host = await connect("host", "first");
    const client = await connect("client");
    const id = idOf(host.frames()[0] ?? bytes());
    core.receive(host, hostFrameOf(hostFrame.disconnect, id));
    expect(closingsOf(client)).toEqual([{ code: 1000, reason: "disconnected" }]);
  });

  it("sends a connection nothing extra while it stays open", async () => {
    const { connect, core } = createFakeRoom();
    const host = await connect("host", "first");
    const client = await connect("client");
    core.receive(client, "ping");
    expect(client.sent).toEqual(["pong"]);
    expect(host.sent.filter((data) => typeof data === "string")).toEqual([]);
  });
});
