import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { EffortChoice, ModelChoice } from "@openmission/contracts";
import { Context, Effect, Exit, Layer, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { Approvals } from "./approvals.ts";
import { Changes } from "./changes.ts";
import { countChatter } from "./chatter.ts";
import { nothingToRecord } from "./journal.ts";
import { journalToolDefinitions, journalToolsOf } from "./journalTools.ts";
import { insertMessage } from "./messaging.ts";
import { offTopicToolDefinitions, Suggestions } from "./suggestions.ts";
import { titleToolDefinitions, titleToolsOf } from "./titles.ts";
import { isBeneath, isWithinReach, openThreadByAgent, reportResult } from "./tree.ts";
import { Waker } from "./waker.ts";

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
/** The thread tools a thread uses without asking (thread-tree, thread-messaging, mission-journal; CHG-0037, CHG-0039, CHG-0043). */
export const threadToolNames = [
  "open_thread",
  "send_thread_message",
  "report_result",
  "interrupt_thread",
  "read_journal",
  "update_journal",
  "set_mission_title",
  "find_missions",
  "suggest_mission",
].map((name) => `mcp__${toolServerName}__${name}`);

const RequestApprovalArguments = Schema.Struct({
  action: Schema.String,
  command: Schema.String,
  pattern: Schema.optional(Schema.String),
  permission: Schema.optional(Schema.String),
  quote: Schema.optional(Schema.String),
});

const OpenThreadArguments = Schema.Struct({
  effort: Schema.optional(EffortChoice),
  model: Schema.optional(ModelChoice),
  request: Schema.String,
  title: Schema.optional(Schema.String),
});

const SendThreadMessageArguments = Schema.Struct({ text: Schema.String, to: Schema.String });

const ReportResultArguments = Schema.Struct({ journal: Schema.String, result: Schema.String });

const InterruptThreadArguments = Schema.Struct({ thread: Schema.String });

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
const decodeOpenThread = Schema.decodeUnknownExit(OpenThreadArguments);
const decodeSendThreadMessage = Schema.decodeUnknownExit(SendThreadMessageArguments);
const decodeReportResult = Schema.decodeUnknownExit(ReportResultArguments);
const decodeInterruptThread = Schema.decodeUnknownExit(InterruptThreadArguments);

const tools = [
  {
    description:
      "Ask the owner before one sensitive action (see your instructions). One call per action. Wait for the answer; do the action only if it is Allowed.",
    inputSchema: {
      properties: {
        action: {
          description:
            "One plain sentence: what you want to do and why, e.g. 'Push today's 3 commits so the release can start'.",
          type: "string",
        },
        command: { description: "The exact command, file path, or recipient and text.", type: "string" },
        pattern: {
          description: "A command pattern covering this kind of action, with * for any text, e.g. 'git push *'.",
          type: "string",
        },
        permission: {
          description: "A short sentence naming this kind of action, e.g. 'Push code'.",
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
    description:
      "Open a thread beneath you to work on one request on its own, in parallel with you. It starts with your request, in your working folder, with your model and effort unless you choose others, and reports its result to you as a message. Use it instead of subagents.",
    inputSchema: {
      properties: {
        effort: { enum: [...EffortChoice.literals], type: "string" },
        model: { enum: [...ModelChoice.literals], type: "string" },
        request: {
          description: "Everything the new thread needs to know: it sees none of your conversation.",
          type: "string",
        },
        title: { description: "A short title for the new thread, a few words, shown to the owner.", type: "string" },
      },
      required: ["request"],
      type: "object",
    },
    name: "open_thread",
  },
  {
    description:
      "Send a message to your parent thread or to a thread directly beneath you, by its id. It joins that thread's current turn if it is running, and wakes it if it is idle.",
    inputSchema: {
      properties: { text: { type: "string" }, to: { description: "The receiving thread's id.", type: "string" } },
      required: ["to", "text"],
      type: "object",
    },
    name: "send_thread_message",
  },
  {
    description:
      "When your work is done, report your result to the thread that opened you, with an entry for the mission's journal. You become Done; a later message continues you.",
    inputSchema: {
      properties: {
        journal: {
          description: `The entry for the mission's journal saying what you did or decided, or exactly "${nothingToRecord}".`,
          type: "string",
        },
        result: { description: "The result, complete enough to use without your conversation.", type: "string" },
      },
      required: ["result", "journal"],
      type: "object",
    },
    name: "report_result",
  },
  {
    description:
      "Interrupt a running thread directly beneath you, by its id: its current turn ends and it waits for a message. Use it when its work is no longer needed or must change course; then message it with what to do instead.",
    inputSchema: {
      properties: { thread: { description: "The id of the thread beneath you to interrupt.", type: "string" } },
      required: ["thread"],
      type: "object",
    },
    name: "interrupt_thread",
  },
  ...journalToolDefinitions,
  ...titleToolDefinitions,
  ...offTopicToolDefinitions,
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
    const suggestions = yield* Suggestions;
    const sql = yield* SqlClient.SqlClient;
    const changes = yield* Changes;
    const waker = yield* Waker;
    const context = yield* Effect.context<never>();

    /** Runs a tree change in one transaction and announces it once committed. */
    const commit = <A, E>(work: Effect.Effect<A, E, SqlClient.SqlClient>) =>
      sql
        .withTransaction(work.pipe(Effect.tap(() => sql.afterCommit(changes.publish))))
        .pipe(Effect.provideService(SqlClient.SqlClient, sql), Effect.orDie);

    const threadTools: Record<
      string,
      (threadId: string, args: unknown) => Effect.Effect<ReturnType<typeof textResult>>
    > = {
      interrupt_thread: (threadId, args) => {
        const decoded = decodeInterruptThread(args);
        if (Exit.isFailure(decoded)) return Effect.succeed(textResult("Invalid arguments: give thread.", true));
        const target = decoded.value.thread;
        return commit(isBeneath(threadId, target)).pipe(
          Effect.flatMap((isChild) =>
            isChild
              ? waker.interrupt(target)
              : Effect.fail("Not interrupted: you can only interrupt a thread directly beneath you, by its id."),
          ),
          Effect.flatMap((isInterrupted) =>
            isInterrupted
              ? Effect.succeed(textResult("Interrupted."))
              : Effect.fail("Not interrupted: that thread is not running."),
          ),
          Effect.catch((reason: string) => Effect.succeed(textResult(reason, true))),
        );
      },
      open_thread: (threadId, args) => {
        const decoded = decodeOpenThread(args);
        if (Exit.isFailure(decoded)) return Effect.succeed(textResult("Invalid arguments: give request.", true));
        const { effort, model, request, title } = decoded.value;
        return commit(openThreadByAgent(threadId, request, title ?? null, model ?? null, effort ?? null)).pipe(
          Effect.flatMap((outcome) =>
            outcome._tag === "Refused"
              ? Effect.succeed(textResult(outcome.reason, true))
              : waker
                  .wake(outcome.threadId)
                  .pipe(
                    Effect.as(
                      textResult(`Opened thread ${outcome.threadId}. Its result will come to you as a message.`),
                    ),
                  ),
          ),
        );
      },
      report_result: (threadId, args) => {
        const decoded = decodeReportResult(args);
        if (Exit.isFailure(decoded) || decoded.value.journal.trim() === "") {
          return Effect.succeed(
            textResult(
              `Not reported: give result, and journal: an entry for the mission's journal, or exactly "${nothingToRecord}".`,
              true,
            ),
          );
        }
        return commit(reportResult(threadId, decoded.value.result, decoded.value.journal)).pipe(
          Effect.flatMap((parentId) =>
            parentId === null
              ? Effect.succeed(textResult("Reported. You are the mission's top thread: the owner reads your replies."))
              : waker
                  .wake(parentId)
                  .pipe(Effect.as(textResult("Reported to your parent. You are Done once this turn ends."))),
          ),
        );
      },
      ...Object.fromEntries(
        Object.entries({
          ...journalToolsOf(commit),
          ...titleToolsOf(commit),
          find_missions: suggestions.findMissions,
          suggest_mission: suggestions.suggest,
        }).map(([name, answer]) => [
          name,
          (threadId: string, args: unknown) =>
            answer(threadId, args).pipe(Effect.map(({ isError, text }) => textResult(text, isError))),
        ]),
      ),
      send_thread_message: (threadId, args) => {
        const decoded = decodeSendThreadMessage(args);
        if (Exit.isFailure(decoded)) return Effect.succeed(textResult("Invalid arguments: give to and text.", true));
        const { text, to } = decoded.value;
        return commit(
          Effect.gen(function* () {
            if (!(yield* isWithinReach(threadId, to))) return null;
            yield* insertMessage({ fromThreadId: threadId, isQueued: false, isResult: false, text, threadId: to });
            return yield* countChatter(threadId, to);
          }),
        ).pipe(
          Effect.flatMap((paused) =>
            paused !== null
              ? waker
                  .cancel(paused)
                  .pipe(Effect.andThen(waker.wake(to)))
                  .pipe(Effect.as(textResult("Sent.")))
              : Effect.succeed(
                  textResult(
                    "Not sent: you can only message your parent or a thread directly beneath you, by its id.",
                    true,
                  ),
                ),
          ),
        );
      },
    };
    const run = Effect.runPromiseWith(context);
    const tokens = new Map<string, string>();
    const threads = new Map<string, string>();

    const dispatchTool = (threadId: string, name: string, args: unknown) => {
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
      const threadTool = Object.hasOwn(threadTools, name) ? threadTools[name] : void 0;
      if (threadTool !== void 0) return threadTool(threadId, args);
      return Effect.succeed(textResult(`Unknown tool: ${name}`, true));
    };

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
