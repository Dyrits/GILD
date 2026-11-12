import { DurableObject } from "cloudflare:workers";
import { closeWithReason, type Member, RoomCore, type RoomPorts } from "./roomCore.ts";
import { parseConnect } from "./route.ts";

/** The Worker's bindings. */
export type Env = {
  readonly ROOM: DurableObjectNamespace<Room>;
};

// What a connection carries in its attachment, which survives hibernation; a connection without one is not a member.
type Attachment = { readonly id: Uint8Array; readonly role: "client" } | { readonly role: "host" };

const claimKey = "claim";

const memberOf = (peer: WebSocket): Member<WebSocket> | null => {
  const attachment: Attachment | null = peer.deserializeAttachment();
  if (attachment === null) return null;
  return attachment.role === "host" ? { peer, role: "host" } : { id: attachment.id, peer, role: "client" };
};

/**
 * One room: a host and its paired devices, held on hibernating WebSockets. Everything about who is connected is read
 * from the sockets, so the object can leave memory between messages; the only thing it stores is the host's claim hash.
 */
export class Room extends DurableObject<Env> {
  readonly #core: RoomCore<WebSocket>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Answered by the runtime without waking the object.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    const ports: RoomPorts<WebSocket> = {
      enroll: (member) =>
        member.peer.serializeAttachment(
          member.role === "host"
            ? ({ role: "host" } satisfies Attachment)
            : ({ id: member.id, role: "client" } satisfies Attachment),
        ),
      memberOf,
      members: () => ctx.getWebSockets().flatMap((peer) => memberOf(peer) ?? []),
      readClaim: async () => {
        const stored = await ctx.storage.get<Uint8Array>(claimKey);
        return stored === void 0 ? null : new Uint8Array(stored);
      },
      retire: (peer) => peer.serializeAttachment(null),
      writeClaim: (hash) => ctx.storage.put(claimKey, hash),
    };
    this.#core = new RoomCore(ports);
  }

  override async fetch(request: Request): Promise<Response> {
    const connect = parseConnect(request.url);
    if (connect === null || request.headers.get("Upgrade") !== "websocket") return new Response(null, { status: 404 });
    const rejection = await this.#core.screen(connect.role, connect.claim);
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    if (rejection === null) {
      this.ctx.acceptWebSocket(server, [connect.role]);
      this.#core.open(server, connect.role);
    } else {
      this.ctx.acceptWebSocket(server);
      closeWithReason(server, rejection.code, rejection.reason);
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  override webSocketMessage(peer: WebSocket, message: string | ArrayBuffer): void {
    this.#core.receive(peer, typeof message === "string" ? message : new Uint8Array(message));
  }

  override webSocketClose(peer: WebSocket, code: number): void {
    this.#core.close(peer);
    // Completes the close handshake; 1005 and 1006 only report a missing code and cannot be sent.
    try {
      peer.close(code === 1005 || code === 1006 ? 1000 : code);
    } catch {
      // already closed
    }
  }

  override webSocketError(peer: WebSocket): void {
    this.#core.close(peer);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const connect = parseConnect(request.url);
    if (connect === null || request.method !== "GET") return new Response(null, { status: 404 });
    if (request.headers.get("Upgrade") !== "websocket") return new Response(null, { status: 426 });
    return env.ROOM.get(env.ROOM.idFromName(connect.room)).fetch(request);
  },
} satisfies ExportedHandler<Env>;
