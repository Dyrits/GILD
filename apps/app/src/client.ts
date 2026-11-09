import {
  type Request,
  type RequestTag,
  type ResultOf,
  Results,
  ServerFrameJson,
  type ServiceError,
} from "@gild/contracts";
import { Schema } from "effect";

declare global {
  interface Window {
    gild?: { chooseFolder(): Promise<string | null>; endpoint(): Promise<string>; hasOwnTitleBar: boolean };
  }
}

const decodeFrame = Schema.decodeUnknownSync(ServerFrameJson);

/** A request the service refused or failed, carrying its error. */
export class RequestFailed extends Error {
  constructor(readonly error: ServiceError) {
    super(error.message);
  }
}

type Pending = { tag: RequestTag; resolve: (value: unknown) => void; reject: (error: Error) => void };

/** One connection to the local service: requests with replies, and change announcements. */
export class ServiceClient {
  private socket: WebSocket | null = null;
  private nextId = 0;
  private readonly pending = new Map<string, Pending>();
  private readonly listeners = new Set<() => void>();
  private readonly draftListeners = new Set<(threadId: string, text: string) => void>();

  private constructor(private readonly endpoint: string) {}

  static async connect(): Promise<ServiceClient> {
    if (window.gild === undefined) return Promise.reject(new Error("Open Gild through the desktop app."));
    const client = new ServiceClient(await window.gild.endpoint());
    await client.open();
    return client;
  }

  private open() {
    return new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(this.endpoint);
      socket.onopen = () => {
        this.socket = socket;
        resolve();
        this.notify();
      };
      socket.onerror = () => reject(new Error("Could not reach the local service."));
      socket.onmessage = (event) => this.receive(event.data);
      socket.onclose = () => {
        for (const request of this.pending.values()) request.reject(new Error("The connection to the service closed."));
        this.pending.clear();
        if (this.socket === socket) setTimeout(() => this.open().catch(() => void 0), 1000);
      };
    });
  }

  private receive(data: unknown) {
    const frame = decodeFrame(data);
    if (frame._tag === "Changed") return this.notify();
    if (frame._tag === "Draft") {
      for (const listener of this.draftListeners) listener(frame.threadId, frame.text);
      return;
    }
    const request = this.pending.get(frame.id);
    if (request === undefined) return;
    this.pending.delete(frame.id);
    if (frame._tag === "Failure") return request.reject(new RequestFailed(frame.error));
    try {
      request.resolve(Schema.decodeUnknownSync(Results[request.tag] as unknown as Schema.Codec<unknown>)(frame.value));
    } catch (error) {
      request.reject(error as Error);
    }
  }

  private notify() {
    for (const listener of this.listeners) listener();
  }

  /** Calls the listener after every committed change and after reconnecting. */
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Calls the listener with each thread's reply in progress; empty text ends it. */
  subscribeDrafts(listener: (threadId: string, text: string) => void) {
    this.draftListeners.add(listener);
    return () => this.draftListeners.delete(listener);
  }

  request<R extends Request>(request: R): Promise<ResultOf<R["_tag"]>> {
    const socket = this.socket;
    if (socket === null || socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("Not connected to the local service."));
    }
    const id = String(++this.nextId);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { reject, resolve: resolve as (value: unknown) => void, tag: request._tag });
      socket.send(JSON.stringify({ id, request }));
    });
  }
}

/** A fresh request identifier; repeating a command with it returns the original outcome. */
export const newRequestId = () => crypto.randomUUID();
