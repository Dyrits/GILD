import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Effect, Exit, Layer, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { Approvals } from "./approvals.ts";
import { Changes } from "./changes.ts";
import { Endpoints } from "./endpoints.ts";
import { Suggestions } from "./suggestions.ts";
import { Threads } from "./threads.ts";
import { makeToolHandlers } from "./threadToolHandlers.ts";
import { answerToolCall, isThreadToolName, toolListing, unaskedToolNamesOf } from "./threadTools.ts";

/** The server name Claude Code prefixes to tool names (`mcp__canopy__…`). */
export const toolServerName = "canopy";
/** The tool name Claude Code's `--permission-prompt-tool` takes. */
export const promptToolName = `mcp__${toolServerName}__answer_prompt`;
export const approvalToolName = `mcp__${toolServerName}__request_approval`;
/** The thread tools a thread uses without asking (thread-tree, thread-messaging, mission-journal; CHG-0037, CHG-0039, CHG-0043). */
export const threadToolNames = unaskedToolNamesOf(toolServerName);

const RpcMessage = Schema.Struct({
  id: Schema.optional(Schema.Union([Schema.String, Schema.Number])),
  method: Schema.String,
  params: Schema.optional(Schema.Unknown),
});

const CallParams = Schema.Struct({ arguments: Schema.optional(Schema.Unknown), name: Schema.String });
const InitializeParams = Schema.Struct({ protocolVersion: Schema.optional(Schema.String) });

const decodeMessage = Schema.decodeUnknownExit(Schema.fromJsonString(RpcMessage));
const decodeCall = Schema.decodeUnknownExit(CallParams);
const decodeInitialize = Schema.decodeUnknownExit(InitializeParams);
const textResult = (text: string, isError = false) => ({ content: [{ text, type: "text" }], isError });

// SSE comments keep a long-held call alive through client body timeouts while
// the owner takes their time (action-approval, Waiting: no time limit).
const keepAliveMillis = 20_000;

const readBody = (request: IncomingMessage) =>
  new Promise<string>((resolve, reject) => {
    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });

/**
 * Serves the thread tools over MCP on loopback (ADR 0005), at the endpoints `Endpoints` issues; no tool
 * argument can name another thread. Built after Threads, which it calls directly.
 */
export const toolServerLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const approvals = yield* Approvals;
    const suggestions = yield* Suggestions;
    const sql = yield* SqlClient.SqlClient;
    const changes = yield* Changes;
    const threads = yield* Threads;
    const endpoints = yield* Endpoints;
    const context = yield* Effect.context<never>();

    /** Runs a tree change in one transaction and announces it once committed. */
    const handlers = makeToolHandlers({ approvals, changes, sql, suggestions, threads });
    const run = Effect.runPromiseWith(context);

    const dispatchTool = (threadId: string, name: string, args: unknown) =>
      isThreadToolName(name)
        ? answerToolCall(handlers, name, threadId, args).pipe(
            Effect.map(({ isError, text }) => textResult(text, isError)),
          )
        : Effect.succeed(textResult(`Unknown tool: ${name}`, true));

    const callTool = (threadId: string, name: string, args: unknown) =>
      Effect.gen(function* () {
        const [caller] = yield* sql<{
          blocker: string | null;
        }>`SELECT blocker FROM threads WHERE id = ${threadId} AND is_deleting = 0`;
        if (caller === undefined) return textResult("Unknown thread.", true);
        if (caller.blocker === "Chatter" && name !== "send_thread_message" && name !== "report_result")
          return textResult("Paused by the chatter guard. Wait for the owner.", true);
        return yield* dispatchTool(threadId, name, args);
      }).pipe(Effect.orDie);

    const respondJson = (response: ServerResponse, body: unknown) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
    };

    const handle = async (request: IncomingMessage, response: ServerResponse) => {
      const token = (request.url ?? "").replace(/^\/mcp\//, "");
      const threadId = endpoints.threadOf(token);
      if (threadId === null || !(request.url ?? "").startsWith("/mcp/")) {
        response.writeHead(404).end();
        return;
      }
      if (request.method !== "POST") {
        response.writeHead(405, { allow: "POST" }).end();
        return;
      }
      const decoded = decodeMessage(await readBody(request));
      if (Exit.isFailure(decoded)) {
        respondJson(response, { error: { code: -32700, message: "Parse error" }, id: null, jsonrpc: "2.0" });
        return;
      }
      const message = decoded.value;
      if (message.id === undefined) {
        response.writeHead(202).end();
        return;
      }
      const reply = (result: unknown) => ({ id: message.id, jsonrpc: "2.0", result });
      if (message.method === "initialize") {
        const params = decodeInitialize(message.params ?? {});
        const version = Exit.isSuccess(params) ? params.value.protocolVersion : void 0;
        respondJson(
          response,
          reply({
            capabilities: { tools: {} },
            protocolVersion: version ?? "2025-06-18",
            serverInfo: { name: toolServerName, version: "0.1.0" },
          }),
        );
        return;
      }
      if (message.method === "tools/list") {
        respondJson(response, reply({ tools: toolListing }));
        return;
      }
      if (message.method !== "tools/call") {
        respondJson(response, reply({}));
        return;
      }
      const call = decodeCall(message.params);
      if (Exit.isFailure(call)) {
        respondJson(response, { error: { code: -32602, message: "Invalid params" }, id: message.id, jsonrpc: "2.0" });
        return;
      }
      response.writeHead(200, { "cache-control": "no-cache", "content-type": "text/event-stream" });
      const timer = setInterval(() => response.write(": waiting\n\n"), keepAliveMillis);
      // A caller that closes the connection has given up; its open question is withdrawn.
      const abandoned = new AbortController();
      response.on("close", () => {
        if (!response.writableFinished) abandoned.abort();
      });
      try {
        const result = await run(callTool(threadId, call.value.name, call.value.arguments), {
          signal: abandoned.signal,
        });
        response.end(`event: message\ndata: ${JSON.stringify(reply(result))}\n\n`);
      } finally {
        clearInterval(timer);
      }
    };

    const server = yield* Effect.acquireRelease(
      Effect.callback<ReturnType<typeof createServer>, Error>((resume) => {
        const created = createServer((request, response) => {
          handle(request, response).catch(() => {
            if (!response.headersSent) response.writeHead(500);
            response.end();
          });
        });
        created.once("error", (error) => resume(Effect.fail(error)));
        created.listen(0, "127.0.0.1", () => resume(Effect.succeed(created)));
      }),
      (created) =>
        Effect.callback<void>((resume) => {
          created.closeAllConnections();
          created.close(() => resume(Effect.void));
        }),
    ).pipe(Effect.orDie);
    const address = server.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;

    yield* endpoints.open(port);
  }),
);
