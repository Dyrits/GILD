import { randomBytes } from "node:crypto";
import { Context, Deferred, Effect, Layer } from "effect";

/**
 * Issues each thread its own secret MCP endpoint (ADR 0005), so the caller of a thread tool is the thread
 * the URL was issued to. Threads need their URL to run a turn and the tool server needs Threads to answer,
 * so the endpoints sit between them: the tool server opens its port here once it listens, and an endpoint
 * asked for before then waits for it rather than failing.
 */
export class Endpoints extends Context.Service<
  Endpoints,
  {
    /** The thread's endpoint, stable for the service's lifetime. */
    readonly urlFor: (threadId: string) => Effect.Effect<string>;
    /** The thread an endpoint's token was issued to, or null. */
    readonly threadOf: (token: string) => string | null;
    /** Called once by the tool server when it listens. */
    readonly open: (port: number) => Effect.Effect<void>;
  }
>()("iskios/Endpoints") {}

/** Issues endpoints for the service's lifetime; the tool server opens them once it listens. */
export const endpointsLayer = Layer.effect(
  Endpoints,
  Effect.gen(function* () {
    const port = yield* Deferred.make<number>();
    const tokens = new Map<string, string>();
    const threads = new Map<string, string>();
    const tokenOf = (threadId: string) => {
      const issued = tokens.get(threadId);
      if (issued !== undefined) return issued;
      const token = randomBytes(24).toString("hex");
      tokens.set(threadId, token);
      threads.set(token, threadId);
      return token;
    };
    return {
      open: (listening) => Deferred.succeed(port, listening).pipe(Effect.asVoid),
      threadOf: (token) => threads.get(token) ?? null,
      urlFor: (threadId) =>
        Deferred.await(port).pipe(Effect.map((listening) => `http://127.0.0.1:${listening}/mcp/${tokenOf(threadId)}`)),
    };
  }),
);
