import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Context, Effect, Exit, Layer, Schema } from "effect";
import { Approvals } from "./approvals.ts";

/**
 * Serves the thread tools over MCP on loopback (ADR 0005). Each thread gets its
 * own secret URL, so the caller is the thread the URL was issued to and no tool
 * argument can name another thread.
 */
export class ToolServer extends Context.Service<
  ToolServer,
  {
    /** The thread's endpoint, stable for the service's lifetime. */
    readonly urlFor: (threadId: string) => Effect.Effect<string>;
  }
>()("openmission/ToolServer") {}

/** The server name Claude Code prefixes to tool names (`mcp__openmission__…`). */
export const toolServerName = "openmission";
/** The tool name Claude Code's `--permission-prompt-tool` takes. */
export const promptToolName = `mcp__${toolServerName}__answer_prompt`;
export const approvalToolName = `mcp__${toolServerName}__request_approval`;

const RequestApprovalArguments = Schema.Struct({
  action: Schema.String,
  command: Schema.String,
  pattern: Schema.optional(Schema.String),
  permission: Schema.optional(Schema.String),
  quote: Schema.optional(Schema.String),
});

const AnswerPromptArguments = Schema.Struct({
  input: Schema.Unknown,
  tool_name: Schema.String,
});

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
const decodeApproval = Schema.decodeUnknownExit(RequestApprovalArguments);
const decodePrompt = Schema.decodeUnknownExit(AnswerPromptArguments);

const tools = [
  {
    description:
      "Ask the owner before one risky action (see your instructions). One call per action. Wait for the answer; do the action only if it is Allowed.",
    inputSchema: {
      properties: {
        action: {
          description:
            "One plain sentence: what you want to do and why, e.g. 'Push today's 3 commits to GitHub so the release can start'.",
          type: "string",
        },
        command: { description: "The exact command, file path, or recipient and text.", type: "string" },
        pattern: {
          description: "A command pattern covering this kind of action, with * for any text, e.g. 'git push *'.",
          type: "string",
        },
        permission: {
          description: "A short sentence naming this kind of action, e.g. 'Push code to GitHub'.",
          type: "string",
        },
        quote: {
          description:
            "Only when the owner's latest message already names this action: the owner's exact words naming it, copied verbatim.",
          type: "string",
        },
      },
      required: ["action", "command"],
      type: "object",
    },
    name: "request_approval",
  },
  {
    description: "Used by Claude Code itself to answer permission prompts. Never call it yourself.",
    inputSchema: {
      properties: { input: { type: "object" }, tool_name: { type: "string" }, tool_use_id: { type: "string" } },
      required: ["tool_name", "input"],
      type: "object",
    },
    name: "answer_prompt",
  },
];

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

export const toolServerLayer = Layer.effect(
  ToolServer,
  Effect.gen(function* () {
    const approvals = yield* Approvals;
    const context = yield* Effect.context<never>();
    const run = Effect.runPromiseWith(context);
    const tokens = new Map<string, string>();
    const threads = new Map<string, string>();

    const callTool = (threadId: string, name: string, args: unknown) => {
      if (name === "request_approval") {
        const decoded = decodeApproval(args);
        if (Exit.isFailure(decoded))
          return Effect.succeed(textResult("Invalid arguments: give action and command.", true));
        const given = decoded.value;
        return approvals
          .requestApproval(threadId, {
            action: given.action,
            command: given.command,
            pattern: given.pattern ?? null,
            permission: given.permission ?? null,
            quote: given.quote ?? null,
          })
          .pipe(Effect.map((decision) => textResult(decision.text, !decision.isAllowed)));
      }
      if (name === "answer_prompt") {
        const decoded = decodePrompt(args);
        if (Exit.isFailure(decoded)) {
          return Effect.succeed(
            textResult(JSON.stringify({ behavior: "deny", message: "Invalid permission prompt." })),
          );
        }
        const { input, tool_name } = decoded.value;
        return approvals
          .answerPrompt(threadId, tool_name, input)
          .pipe(
            Effect.map((decision) =>
              textResult(
                JSON.stringify(
                  decision.isAllowed
                    ? { behavior: "allow", updatedInput: input }
                    : { behavior: "deny", message: decision.text },
                ),
              ),
            ),
          );
      }
      return Effect.succeed(textResult(`Unknown tool: ${name}`, true));
    };

    const respondJson = (response: ServerResponse, body: unknown) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
    };

    const handle = async (request: IncomingMessage, response: ServerResponse) => {
      const token = (request.url ?? "").replace(/^\/mcp\//, "");
      const threadId = threads.get(token);
      if (threadId === undefined || !(request.url ?? "").startsWith("/mcp/")) {
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
        respondJson(response, reply({ tools }));
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

    const urlFor = (threadId: string) =>
      Effect.sync(() => {
        let token = tokens.get(threadId);
        if (token === undefined) {
          token = randomBytes(24).toString("hex");
          tokens.set(threadId, token);
          threads.set(token, threadId);
        }
        return `http://127.0.0.1:${port}/mcp/${token}`;
      });

    return { urlFor };
  }),
);
