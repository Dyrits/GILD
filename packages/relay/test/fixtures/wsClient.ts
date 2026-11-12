import { WebSocket } from "ws";

/** A real `ws` client that records everything it receives and how it was closed. */
export type Session = {
  readonly closed: Promise<{ code: number; reason: string }>;
  readonly messages: { data: Buffer; isBinary: boolean }[];
  readonly socket: WebSocket;
  /** Waits until at least `count` messages have arrived, then returns them all. */
  messagesAfter(count: number): Promise<{ data: Buffer; isBinary: boolean }[]>;
};

export const room = "abcdefghijklmnopqrstuvwxyz012345";
export const secret = Buffer.from("a-sixteen-plus-byte-secret").toString("base64url");

/** Opens a client; the promise ends when the upgrade is accepted, or with the HTTP status when it is refused. */
export const open = (port: number, path: string): Promise<Session | { status: number }> =>
  new Promise((resolve) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}${path}`);
    const messages: Session["messages"] = [];
    const waiting: (() => void)[] = [];
    const closed = new Promise<{ code: number; reason: string }>((done) => {
      socket.on("close", (code, reason) => done({ code, reason: reason.toString() }));
    });
    socket.on("message", (data, isBinary) => {
      messages.push({ data: Buffer.from(data as Buffer), isBinary });
      for (const wake of waiting.splice(0)) wake();
    });
    socket.on("unexpected-response", (_request, response) => {
      response.resume();
      resolve({ status: response.statusCode ?? 0 });
    });
    socket.on("error", () => resolve({ status: 0 }));
    socket.on("open", () =>
      resolve({
        closed,
        messages,
        messagesAfter: async (count) => {
          while (messages.length < count) await new Promise<void>((wake) => waiting.push(wake));
          return messages;
        },
        socket,
      }),
    );
  });

/** Opens a client and fails the test if the upgrade was refused. */
export const connect = async (port: number, path: string): Promise<Session> => {
  const session = await open(port, path);
  if ("status" in session) throw new Error(`upgrade refused with ${session.status}`);
  return session;
};

export const hostPath = (name = room, claim = secret) => `/r/${name}?role=host&claim=${claim}`;
export const clientPath = (name = room) => `/r/${name}?role=client`;
