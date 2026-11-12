import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import type { Duplex } from "node:stream";
import { type WebSocket, WebSocketServer } from "ws";
import { defaultRoomLimits, type Member, RoomCore, type RoomLimits } from "./roomCore.ts";
import { parseConnect } from "./route.ts";

/** What `startNodeRelay` accepts. */
export type NodeRelayOptions = Partial<RoomLimits> & {
  /** The address to listen on; defaults to 127.0.0.1. */
  readonly host?: string;
  /** The port to listen on; 0, the default, picks a free one. */
  readonly port?: number;
};

/** A running relay. */
export type NodeRelay = {
  /** Stops listening and closes every connection. */
  close(): Promise<void>;
  /** The port the relay listens on. */
  readonly port: number;
};

type Room = {
  readonly core: RoomCore<WebSocket>;
};

// A room lives as long as the relay does: its host claim is held in memory, as the Durable Object holds it in storage.
const createRoom = (limits: Partial<RoomLimits>): Room => {
  const members = new Map<WebSocket, Member<WebSocket>>();
  let claim: Uint8Array | null = null;
  const core = new RoomCore<WebSocket>(
    {
      enroll: (member) => members.set(member.peer, member),
      memberOf: (peer) => members.get(peer) ?? null,
      members: () => [...members.values()],
      readClaim: () => Promise.resolve(claim),
      retire: (peer) => members.delete(peer),
      writeClaim: (hash) => {
        claim = hash;
        return Promise.resolve();
      },
    },
    limits,
  );
  return { core };
};

const refuse = (socket: Duplex): void => {
  socket.end("HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
};

/**
 * Starts the relay on plain Node with `ws`, speaking the same wire protocol as the Worker. It holds nothing about a
 * room but its host claim, and passes frames on without reading them.
 */
export const startNodeRelay = async (options: NodeRelayOptions = {}): Promise<NodeRelay> => {
  const limits: Partial<RoomLimits> = {
    ...(options.maxClients === void 0 ? {} : { maxClients: options.maxClients }),
    ...(options.maxFrameBytes === void 0 ? {} : { maxFrameBytes: options.maxFrameBytes }),
  };
  const rooms = new Map<string, Room>();
  const maxPayload = options.maxFrameBytes ?? defaultRoomLimits.maxFrameBytes;
  const wss = new WebSocketServer({ maxPayload, noServer: true });
  const server = createServer((_request, response) => {
    response.writeHead(404, { "Content-Length": 0 }).end();
  });

  const accept = async (request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> => {
    const connect = parseConnect(request.url ?? "");
    if (connect === null) return refuse(socket);
    let room = rooms.get(connect.room);
    if (room === void 0) {
      room = createRoom(limits);
      rooms.set(connect.room, room);
    }
    const { core } = room;
    const rejection = await core.screen(connect.role, connect.claim);
    wss.handleUpgrade(request, socket, head, (peer) => {
      // ws closes an oversized frame with 1009 itself and reports it here; the close event does the rest.
      peer.on("error", () => null);
      if (rejection !== null) return peer.close(rejection.code, rejection.reason);
      peer.on("message", (data, isBinary) => {
        if (isBinary && Buffer.isBuffer(data)) core.receive(peer, data);
        else if (!isBinary) core.receive(peer, data.toString());
      });
      peer.on("close", () => core.close(peer));
      core.open(peer, connect.role);
    });
  };

  server.on("upgrade", (request, socket, head) => {
    socket.on("error", () => null);
    accept(request, socket, head).catch(() => socket.destroy());
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 0, options.host ?? "127.0.0.1", resolve);
  });

  return {
    close: () =>
      new Promise<void>((resolve) => {
        for (const peer of wss.clients) peer.terminate();
        wss.close();
        server.close(() => resolve());
        server.closeAllConnections();
      }),
    port: (server.address() as AddressInfo).port,
  };
};
