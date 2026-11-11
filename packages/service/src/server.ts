import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import {
  type ClientFrame,
  ClientFrameJson,
  Results,
  type ServerFrame,
  ServerFrameJson,
  type ThreadId,
} from "@iskios/contracts";
import { Effect, Exit, PubSub, Schema } from "effect";
import { WebSocket, WebSocketServer } from "ws";
import { Changes } from "./core/index.ts";
import { Service } from "./service.ts";

const decodeClientFrame = Schema.decodeUnknownExit(ClientFrameJson);
const encodeServerFrame = Schema.encodeSync(ServerFrameJson);

const sameToken = (given: string | null, expected: string) => {
  if (given === null) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

const tokenOf = (request: IncomingMessage) => new URL(request.url ?? "/", "http://127.0.0.1").searchParams.get("token");

/** Best effort: answers a malformed frame on its identifier when one can be read. */
const frameIdOf = (raw: string) => {
  try {
    const id = (JSON.parse(raw) as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
};

/**
 * Serves the owner on one loopback WebSocket. The per-launch token in the
 * connection URL is the owner's credential; any other connection is refused.
 */
export const serveLoopback = (options: { readonly port: number; readonly token: string }) =>
  Effect.gen(function* () {
    const service = yield* Service;
    const changes = yield* Changes;
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

    const send = (socket: WebSocket, frame: ServerFrame) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(encodeServerFrame(frame));
    };

    const answer = (socket: WebSocket, frame: ClientFrame) =>
      service.handle(frame.request).pipe(
        Effect.map((value) =>
          Schema.encodeUnknownSync(Results[frame.request._tag] as unknown as Schema.Codec<unknown>)(value),
        ),
        Effect.exit,
        Effect.map((exit) =>
          Exit.isSuccess(exit)
            ? send(socket, { _tag: "Success", id: frame.id, value: exit.value })
            : send(socket, {
                _tag: "Failure",
                error:
                  exit.cause.reasons[0]?._tag === "Fail"
                    ? { kind: exit.cause.reasons[0].error.kind, message: exit.cause.reasons[0].error.message }
                    : { kind: "ExecutionFailure", message: "The service failed unexpectedly." },
                id: frame.id,
              }),
        ),
      );

    wss.on("connection", (socket) => {
      socket.on("message", (data) => {
        const raw = data.toString();
        const decoded = decodeClientFrame(raw);
        if (Exit.isSuccess(decoded)) {
          void run(answer(socket, decoded.value));
          return;
        }
        const id = frameIdOf(raw);
        if (id !== null)
          send(socket, { _tag: "Failure", error: { kind: "InvalidInput", message: "Invalid request." }, id });
      });
    });

    const subscription = yield* PubSub.subscribe(changes.pubsub);
    yield* PubSub.take(subscription).pipe(
      Effect.tap((sequence) =>
        Effect.sync(() => {
          for (const client of wss.clients) send(client, { _tag: "Changed", sequence });
        }),
      ),
      Effect.forever,
      Effect.forkScoped,
    );

    const drafts = yield* PubSub.subscribe(changes.drafts);
    yield* PubSub.take(drafts).pipe(
      Effect.tap(({ threadId, text }) =>
        Effect.sync(() => {
          for (const client of wss.clients) send(client, { _tag: "Draft", text, threadId: threadId as ThreadId });
        }),
      ),
      Effect.forever,
      Effect.forkScoped,
    );

    const address = wss.address();
    return { port: typeof address === "object" && address !== null ? address.port : options.port };
  });
