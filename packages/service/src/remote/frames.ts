import {
  type ClientFrame,
  ClientFrameJson,
  hostOnlyRequestTags,
  Results,
  type ServerFrame,
  ServerFrameJson,
} from "@iskios/contracts";
import { Effect, Exit, Schema } from "effect";
import type { ServiceFailure } from "../core/index.ts";

const decodeClientFrame = Schema.decodeUnknownExit(ClientFrameJson);
export const encodeServerFrame = Schema.encodeSync(ServerFrameJson);

/** Best effort: answers a malformed frame on its identifier when one can be read. */
const frameIdOf = (raw: string) => {
  try {
    const id = (JSON.parse(raw) as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
};

/** What serves requests: the service's `handle`. */
export type Handle = (request: ClientFrame["request"]) => Effect.Effect<unknown, ServiceFailure>;

/** Where a client text frame came from; a paired device is the owner, except for what only the host may do. */
export interface FrameSource {
  readonly isPairedDevice: boolean;
}

/** Runs one request frame and sends its answer, as a Success or a Failure carrying the frame's identifier. */
export const answerFrame = (handle: Handle, frame: ClientFrame, send: (frame: ServerFrame) => void) =>
  handle(frame.request).pipe(
    Effect.map((value) =>
      Schema.encodeUnknownSync(Results[frame.request._tag] as unknown as Schema.Codec<unknown>)(value),
    ),
    Effect.exit,
    Effect.map((exit) =>
      Exit.isSuccess(exit)
        ? send({ _tag: "Success", id: frame.id, value: exit.value })
        : send({
            _tag: "Failure",
            error:
              exit.cause.reasons[0]?._tag === "Fail"
                ? { kind: exit.cause.reasons[0].error.kind, message: exit.cause.reasons[0].error.message }
                : { kind: "ExecutionFailure", message: "The service failed unexpectedly." },
            id: frame.id,
          }),
    ),
  );

/**
 * Decodes one client text frame and answers it through `send`. A malformed frame is answered as InvalidInput when
 * its identifier can be read; a request only the host may make is refused when it comes from a paired device.
 */
export const answerText = (
  handle: Handle,
  raw: string,
  send: (frame: ServerFrame) => void,
  source: FrameSource,
): Effect.Effect<void> => {
  const decoded = decodeClientFrame(raw);
  if (Exit.isSuccess(decoded)) {
    const frame = decoded.value;
    if (source.isPairedDevice && (hostOnlyRequestTags as ReadonlyArray<string>).includes(frame.request._tag)) {
      return Effect.sync(() =>
        send({
          _tag: "Failure",
          error: { kind: "AccessRefused", message: "Only the host itself can do this." },
          id: frame.id,
        }),
      );
    }
    return answerFrame(handle, frame, send);
  }
  const id = frameIdOf(raw);
  return Effect.sync(() => {
    if (id !== null) send({ _tag: "Failure", error: { kind: "InvalidInput", message: "Invalid request." }, id });
  });
};
