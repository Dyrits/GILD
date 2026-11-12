import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type NodeRelay, startNodeRelay } from "../src/index.ts";
import { clientPath, connect, hostPath, open, room, type Session } from "./fixtures/wsClient.ts";

let relay: NodeRelay;
const sessions: Session[] = [];

const track = async (port: number, path: string) => {
  const session = await connect(port, path);
  sessions.push(session);
  return session;
};

const start = async (options: Parameters<typeof startNodeRelay>[0] = {}) => {
  relay = await startNodeRelay(options);
  return relay;
};

beforeEach(async () => {
  await start();
});

afterEach(async () => {
  for (const session of sessions.splice(0)) session.socket.terminate();
  await relay.close();
});

const joinedId = (host: Session, index: number) => host.messages[index]?.data.subarray(1, 9) ?? Buffer.alloc(0);

describe("starting the relay", () => {
  it("picks a free port when asked for port 0", () => {
    expect(relay.port).toBeGreaterThan(0);
  });

  it("stops accepting connections after close", async () => {
    await relay.close();
    const result = await open(relay.port, hostPath());
    expect(result).toEqual({ status: 0 });
    await start();
  });
});

describe("addresses other than a room", () => {
  it.each([
    "/",
    "/status",
    "/r/",
    "/r/short?role=client",
    `/r/${room}`,
    `/r/${room}?role=other`,
    `/r/${room}/extra?role=client`,
    `/r/${room}!?role=client`,
    `/r/${room}?role=host`,
    `/r/${room}?role=host&claim=c2hvcnQ`,
    `/r/${"a".repeat(65)}?role=client`,
  ])("answers 404 for %s", async (path) => {
    const result = await open(relay.port, path);
    expect(result).toEqual({ status: 404 });
  });

  it("answers 404 with no body to a plain request", async () => {
    const response = await fetch(`http://127.0.0.1:${relay.port}/r/${room}?role=client`);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
  });
});

describe("claiming a room", () => {
  it("closes a host with another claim as a claim mismatch", async () => {
    await track(relay.port, hostPath());
    const other = await track(relay.port, hostPath(room, randomBytes(24).toString("base64url")));
    expect(await other.closed).toEqual({ code: 1008, reason: "claim mismatch" });
  });

  it("replaces the old host when the same claim connects", async () => {
    const old = await track(relay.port, hostPath());
    const next = await track(relay.port, hostPath());
    expect(await old.closed).toEqual({ code: 1012, reason: "replaced" });
    next.socket.send("ping");
    expect((await next.messagesAfter(1))[0]?.data.toString()).toBe("pong");
  });

  it("keeps the claim after the host has left", async () => {
    const first = await track(relay.port, hostPath());
    first.socket.close();
    await first.closed;
    const other = await track(relay.port, hostPath(room, randomBytes(24).toString("base64url")));
    expect((await other.closed).code).toBe(1008);
  });

  it("keeps rooms apart", async () => {
    await track(relay.port, hostPath());
    const elsewhere = await track(
      relay.port,
      hostPath("zyxwvutsrqponmlkjihgfedcba987654", randomBytes(24).toString("base64url")),
    );
    elsewhere.socket.send("ping");
    expect((await elsewhere.messagesAfter(1))[0]?.data.toString()).toBe("pong");
  });
});

describe("joining a room", () => {
  it("closes a client at once when no host is connected", async () => {
    const client = await track(relay.port, clientPath());
    expect(await client.closed).toEqual({ code: 1013, reason: "host offline" });
  });

  it("tells the host about a client joining and leaving", async () => {
    const host = await track(relay.port, hostPath());
    const client = await track(relay.port, clientPath());
    const [joined] = await host.messagesAfter(1);
    expect(joined?.isBinary).toBe(true);
    expect([...(joined?.data ?? [])].length).toBe(9);
    expect(joined?.data[0]).toBe(2);
    client.socket.close();
    const [, left] = await host.messagesAfter(2);
    expect(left?.data[0]).toBe(3);
    expect(left?.data.subarray(1)).toEqual(joined?.data.subarray(1));
  });

  it("closes the clients with host left when the host disconnects", async () => {
    const host = await track(relay.port, hostPath());
    const a = await track(relay.port, clientPath());
    const b = await track(relay.port, clientPath());
    await host.messagesAfter(2);
    host.socket.close();
    expect(await a.closed).toEqual({ code: 1001, reason: "host left" });
    expect(await b.closed).toEqual({ code: 1001, reason: "host left" });
  });

  it("closes the ninth client as room full", async () => {
    const host = await track(relay.port, hostPath());
    for (let count = 0; count < 8; count += 1) await track(relay.port, clientPath());
    await host.messagesAfter(8);
    const ninth = await track(relay.port, clientPath());
    expect(await ninth.closed).toEqual({ code: 1013, reason: "room full" });
  });

  it("holds as many clients as configured", async () => {
    await relay.close();
    await start({ maxClients: 1 });
    await track(relay.port, hostPath());
    await track(relay.port, clientPath());
    const second = await track(relay.port, clientPath());
    expect((await second.closed).reason).toBe("room full");
  });
});

describe("forwarding", () => {
  it("delivers a client's bytes to the host identically, behind type and id", async () => {
    const host = await track(relay.port, hostPath());
    const client = await track(relay.port, clientPath());
    await host.messagesAfter(1);
    const payload = randomBytes(1000);
    client.socket.send(payload);
    const forwarded = (await host.messagesAfter(2))[1]?.data;
    expect(forwarded?.[0]).toBe(1);
    expect(forwarded?.subarray(1, 9)).toEqual(joinedId(host, 0));
    expect(forwarded?.subarray(9)).toEqual(payload);
  });

  it("delivers the host's bytes to the addressed client only, identically and without prefix", async () => {
    const host = await track(relay.port, hostPath());
    const a = await track(relay.port, clientPath());
    const b = await track(relay.port, clientPath());
    await host.messagesAfter(2);
    const payload = randomBytes(500);
    host.socket.send(Buffer.concat([Buffer.from([1]), joinedId(host, 1), payload]));
    expect((await b.messagesAfter(1))[0]?.data).toEqual(payload);
    host.socket.send(Buffer.concat([Buffer.from([1]), joinedId(host, 0), Buffer.from("for a")]));
    expect((await a.messagesAfter(1))[0]?.data.toString()).toBe("for a");
    expect(b.messages).toHaveLength(1);
  });

  it("keeps clients from seeing each other", async () => {
    const host = await track(relay.port, hostPath());
    const a = await track(relay.port, clientPath());
    const b = await track(relay.port, clientPath());
    await host.messagesAfter(2);
    a.socket.send(Buffer.from("secret"));
    await host.messagesAfter(3);
    b.socket.send("ping");
    await b.messagesAfter(1);
    expect(a.messages).toHaveLength(0);
    expect(b.messages.map((message) => message.data.toString())).toEqual(["pong"]);
  });

  it("carries a 300 KiB frame in both directions", async () => {
    const host = await track(relay.port, hostPath());
    const client = await track(relay.port, clientPath());
    await host.messagesAfter(1);
    const payload = randomBytes(300 * 1024);
    client.socket.send(payload);
    expect((await host.messagesAfter(2))[1]?.data.subarray(9)).toEqual(payload);
    host.socket.send(Buffer.concat([Buffer.from([1]), joinedId(host, 0), payload]));
    expect((await client.messagesAfter(1))[0]?.data).toEqual(payload);
  });

  it("closes a client when the host asks to disconnect it", async () => {
    const host = await track(relay.port, hostPath());
    const client = await track(relay.port, clientPath());
    await host.messagesAfter(1);
    host.socket.send(Buffer.concat([Buffer.from([2]), joinedId(host, 0)]));
    expect(await client.closed).toEqual({ code: 1000, reason: "disconnected" });
  });

  it("ignores a frame for an unknown client id", async () => {
    const host = await track(relay.port, hostPath());
    const client = await track(relay.port, clientPath());
    await host.messagesAfter(1);
    host.socket.send(Buffer.concat([Buffer.from([1]), Buffer.alloc(8, 7), Buffer.from("lost")]));
    host.socket.send(Buffer.concat([Buffer.from([1]), joinedId(host, 0), Buffer.from("kept")]));
    expect((await client.messagesAfter(1))[0]?.data.toString()).toBe("kept");
  });
});

describe("rules on frames", () => {
  it("closes a host that sends a frame too short with 1002", async () => {
    const host = await track(relay.port, hostPath());
    host.socket.send(Buffer.from([1, 2, 3]));
    expect((await host.closed).code).toBe(1002);
  });

  it("closes a host that sends an unknown type with 1002", async () => {
    const host = await track(relay.port, hostPath());
    host.socket.send(Buffer.alloc(9, 9));
    expect((await host.closed).code).toBe(1002);
  });

  it("closes a sender of a text frame other than ping with 1003", async () => {
    await track(relay.port, hostPath());
    const client = await track(relay.port, clientPath());
    client.socket.send("hello");
    expect((await client.closed).code).toBe(1003);
  });

  it("answers ping with pong", async () => {
    const host = await track(relay.port, hostPath());
    host.socket.send("ping");
    const [reply] = await host.messagesAfter(1);
    expect(reply).toEqual({ data: Buffer.from("pong"), isBinary: false });
  });

  it("closes a client sending a frame over the limit with 1009", async () => {
    await relay.close();
    await start({ maxFrameBytes: 1000 });
    const host = await track(relay.port, hostPath());
    const client = await track(relay.port, clientPath());
    await host.messagesAfter(1);
    client.socket.send(Buffer.alloc(1001));
    expect((await client.closed).code).toBe(1009);
  });

  it("closes a client whose frame with the prefix goes over the limit with 1009", async () => {
    await relay.close();
    await start({ maxFrameBytes: 1000 });
    await track(relay.port, hostPath());
    const client = await track(relay.port, clientPath());
    client.socket.send(Buffer.alloc(992));
    expect((await client.closed).code).toBe(1009);
  });

  it("lets a host keep its clients when a client breaks a rule", async () => {
    const host = await track(relay.port, hostPath());
    const bad = await track(relay.port, clientPath());
    const good = await track(relay.port, clientPath());
    await host.messagesAfter(2);
    bad.socket.send("hello");
    await bad.closed;
    host.socket.send(Buffer.concat([Buffer.from([1]), joinedId(host, 1), Buffer.from("still here")]));
    expect((await good.messagesAfter(1))[0]?.data.toString()).toBe("still here");
  });
});
