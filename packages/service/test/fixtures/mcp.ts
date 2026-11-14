import { Effect, Schema } from "effect";
import { Endpoints } from "../../src/core/index.ts";

const decodeToolResponse = Schema.decodeUnknownSync(
  Schema.Struct({
    result: Schema.Struct({
      content: Schema.Array(Schema.Struct({ text: Schema.String })),
      isError: Schema.optional(Schema.Boolean),
    }),
  }),
);

/** Calls a thread's authenticated MCP endpoint and decodes its server-sent tool response. */
export const callTool = Effect.fnUntraced(function* (threadId: string, name: string, args: object) {
  const url = yield* (yield* Endpoints).urlFor(threadId);
  return yield* Effect.promise(async () => {
    const response = await fetch(url, {
      body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "tools/call", params: { arguments: args, name } }),
      headers: { accept: "application/json, text/event-stream", "content-type": "application/json" },
      method: "POST",
    });
    const data = (await response.text()).split("\n").find((line) => line.startsWith("data: "));
    return decodeToolResponse(JSON.parse(data?.slice(6) ?? "{}"));
  });
});
