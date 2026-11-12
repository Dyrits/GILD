import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { ServerFrame } from "@iskios/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { WebSocket, WebSocketServer } from "ws";
import { Sessions } from "./core/index.ts";
import { answerText, encodeServerFrame, type HostChannel, openHostChannel } from "./remote/index.ts";
import { Service } from "./service.ts";

const sameToken = (given: string | null, expected: string) => {
  if (given === null) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

const tokenOf = (request: IncomingMessage) => new URL(request.url ?? "/", "http://127.0.0.1").searchParams.get("token");

/**
 * Serves the owner on one loopback WebSocket. The per-launch token in the
 * connection URL is the owner's credential; any other connection is refused.
 */
export const serveLoopback = (options: { readonly port: number; readonly token: string }) =>
  Effect.gen(function* () {
    const service = yield* Service;
    const sessions = yield* Sessions;
    const sql = yield* SqlClient.SqlClient;
    const context = yield* Effect.context<never>();
    const run = Effect.runPromiseWith(context);

    const wss = yield* Effect.acquireRelease(
      Effect.callback<WebSocketServer, Error>((resume) => {
        const server = new WebSocketServer({
          host: "127.0.0.1",
          port: options.port,
          verifyClient: ({ req }: { req: IncomingMessage }) => sameToken(tokenOf(req), options.token),
        });
        server.once("listening", () => resume(Effect.succeed(server)));
        server.once("error", (error) => resume(Effect.fail(error)));
      }),
      (server) =>
        Effect.callback<void>((resume) => {
          for (const client of server.clients) client.terminate();
          server.close(() => resume(Effect.void));
        }),
    );

    const sendTo = (socket: WebSocket) => (frame: ServerFrame) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(encodeServerFrame(frame));
    };

    /**
     * Joins the app to a paired host: the service opens an encrypted link to it and passes each frame both ways, so the
     * app speaks to the host's service as to its own. A link that cannot open closes the socket with code 4000 and the
     * reason the owner reads, or 4002 when the host refuses this installation; a link that ends closes it with 4001.
     */
    const bridgeToHost = (socket: WebSocket, hostId: string) => {
      const waiting: string[] = [];
      let link: HostChannel | null = null;
      let isClosed = false;
      socket.on("message", (data) => {
        if (link === null) waiting.push(data.toString());
        else link.sendText(data.toString());
      });
      socket.on("close", () => {
        isClosed = true;
        link?.close();
      });
      const opening = openHostChannel(hostId).pipe(
        Effect.provideService(SqlClient.SqlClient, sql),
        Effect.map((channel) => ({ channel, isFinal: false, message: "" })),
        // A host that refuses this installation will keep refusing: say so with a code that ends the app's retries.
        Effect.catch((failure) =>
          Effect.succeed({
            channel: null,
            isFinal: "kind" in failure && (failure.kind === "AccessRefused" || failure.kind === "NotFound"),
            message: failure.message,
          }),
        ),
      );
      void run(opening).then((outcome) => {
        if (outcome.channel === null) {
          socket.close(outcome.isFinal ? 4002 : 4000, outcome.message.slice(0, 120));
          return;
        }
        const channel = outcome.channel;
        if (isClosed) {
          channel.close();
          return;
        }
        link = channel;
        channel.onText((text) => {
          if (socket.readyState === WebSocket.OPEN) socket.send(text);
        });
        channel.onClose(() => socket.close(4001, "The host disconnected."));
        for (const text of waiting.splice(0)) channel.sendText(text);
      });
    };

    wss.on("connection", (socket, request) => {
      const hostId = /^\/host\/([A-Za-z0-9-]+)$/.exec(new URL(request.url ?? "/", "http://127.0.0.1").pathname)?.[1];
      if (hostId !== undefined) {
        bridgeToHost(socket, hostId);
        return;
      }
      const send = sendTo(socket);
      const remove = sessions.add(send);
      socket.on("close", remove);
      socket.on("message", (data) => {
        void run(answerText(service.handle, data.toString(), send, { isPairedDevice: false }));
      });
    });

    const address = wss.address();
    return { port: typeof address === "object" && address !== null ? address.port : options.port };
  });
