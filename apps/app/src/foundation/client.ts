import {
  type Request,
  type RequestTag,
  type ResultOf,
  Results,
  ServerFrameJson,
  type ServiceError,
} from "@iskios/contracts";
import { Schema } from "effect";
import type { DesktopBridge } from "./desktopBridge";
import { hostEndpointOf, isFinalLinkClose, linkFailureOf, retryDelayOf } from "./hosts";

declare global {
  interface Window {
    iskios?: DesktopBridge;
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

/** One connection to the local service, or through it to a paired host: requests with replies, and change announcements. */
export class ServiceClient {
  private socket: WebSocket | null = null;
  /** The socket still connecting, so that closing the client can end it. */
  private attempt: WebSocket | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private nextId = 0;
  private failures = 0;
  private isEnded = false;
  private lastFailure: string | null = null;
  private readonly pending = new Map<string, Pending>();
  private readonly listeners = new Set<() => void>();
  private readonly draftListeners = new Set<(threadId: string, text: string) => void>();
  private readonly failureListeners = new Set<() => void>();

  private constructor(
    private readonly endpoint: string,
    /** The paired host this connection leads to; null for the local service. */
    readonly hostId: string | null,
  ) {}

  /** Connects to the local service, or to a paired host's service through it. */
  static async connect(hostId: string | null = null): Promise<ServiceClient> {
    if (window.iskios === undefined) return Promise.reject(new Error("Open Iskios through the desktop app."));
    const endpoint = await window.iskios.endpoint();
    const client = new ServiceClient(hostId === null ? endpoint : hostEndpointOf(endpoint, hostId), hostId);
    await client.open();
    return client;
  }

  /** Why the link to the host is down, in the words the owner reads; null while it works or on the local service. */
  get failure() {
    return this.lastFailure;
  }

  /** Whether the link stopped trying for good: the host refused this installation, so only pairing again helps. */
  get hasGivenUp() {
    return this.isEnded;
  }

  /** Calls the listener when the link's failure appears or clears. */
  subscribeFailure(listener: () => void) {
    this.failureListeners.add(listener);
    return () => this.failureListeners.delete(listener);
  }

  private setFailure(next: string | null) {
    if (next === this.lastFailure) return;
    this.lastFailure = next;
    for (const listener of this.failureListeners) listener();
  }

  /** Ends the connection for good, as when the window shows another host. */
  close() {
    this.isEnded = true;
    if (this.retryTimer !== null) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.attempt?.close();
    this.socket?.close();
  }

  /** Opens a socket; a failed first attempt is reported to the caller, while a failed reconnection is retried. */
  private open(isReconnection = false) {
    return new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(this.endpoint);
      this.attempt = socket;
      let hasOpened = false;
      socket.onopen = () => {
        hasOpened = true;
        if (this.attempt === socket) this.attempt = null;
        if (this.isEnded) return socket.close();
        this.socket = socket;
        resolve();
        this.notify();
      };
      socket.onerror = () => reject(new Error("Could not reach the local service."));
      socket.onmessage = (event) => {
        this.failures = 0;
        this.setFailure(null);
        this.receive(event.data);
      };
      socket.onclose = (event) => {
        if (this.attempt === socket) this.attempt = null;
        const failure = linkFailureOf(event.code, event.reason);
        if (isFinalLinkClose(event.code)) this.isEnded = true;
        if (failure !== null) this.setFailure(failure);
        for (const request of this.pending.values()) {
          request.reject(new Error(failure ?? "The connection to the service closed."));
        }
        this.pending.clear();
        if (this.isEnded || !(hasOpened || isReconnection)) return;
        if (this.socket === socket) this.socket = null;
        this.failures += 1;
        this.retryTimer = setTimeout(
          () => {
            this.retryTimer = null;
            if (!this.isEnded) this.open(true).catch(() => void 0);
          },
          retryDelayOf(this.failures, this.hostId !== null),
        );
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

/** The words to show for a failure caught from a request: an error's message, or whatever was thrown, as text. */
export const messageOf = (reason: unknown) => (reason instanceof Error ? reason.message : String(reason));
