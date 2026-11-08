// A scripted stand-in for `opencode acp`, shaped after the Agent Client Protocol as OpenCode 2.2.0 spoke it
// on 2026-11-07. STAND_IN_LOG receives one JSON line per process start ({ args, cwd, env, home, config }) and
// one per request it receives ({ method, params }).
// A prompt's text decides what it does: "run <command>" or "edit <path>" asks permission for that command or
// file change first and says which option was chosen; "slow <millis>" keeps the turn running; anything else
// is echoed. "fragile run <command>" asks the same way, then hangs on the next prompt and exits when cancelled,
// as a process that dies during an interrupt.
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";

const log = (entry) => {
  if (process.env.STAND_IN_LOG) appendFileSync(process.env.STAND_IN_LOG, `${JSON.stringify(entry)}\n`);
};
log({
  args: process.argv.slice(2),
  config: JSON.parse(process.env.OPENCODE_CONFIG_CONTENT ?? "null"),
  cwd: process.cwd(),
  env: Object.keys(process.env).filter((key) => key.startsWith("CANOPY_")),
  home: process.env.XDG_DATA_HOME ?? null,
  pid: process.pid,
});

const send = (message) => process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
let nextServerId = 1000;
const waiting = new Map();
/** The running prompt: its request id, session, and timer. */
let current = null;
/** Whether the next prompt hangs and a cancel ends the process ("fragile run"). */
let isFragile = false;

const ask = (method, params) =>
  new Promise((resolve) => {
    const id = nextServerId++;
    waiting.set(id, resolve);
    send({ id, method, params });
  });

const update = (sessionId, body) => send({ method: "session/update", params: { sessionId, update: body } });

const finish = (stopReason, text) => {
  const prompt = current;
  if (prompt === null) return;
  current = null;
  clearTimeout(prompt.timer);
  if (text !== null)
    for (const word of text.split(" "))
      update(prompt.sessionId, { content: { text: `${word} `, type: "text" }, sessionUpdate: "agent_message_chunk" });
  send({
    id: prompt.id,
    result: { stopReason, usage: { cachedReadTokens: 40, inputTokens: 90, outputTokens: 6, thoughtTokens: 2 } },
  });
};

/**
 * Asks permission for one tool call and ends the turn saying which option was chosen; a rejection cancels the
 * whole prompt with no reply, as OpenCode 2.2.0 did live on 2026-11-08.
 */
const askPermission = async (prompt, subject, toolCall) => {
  update(prompt.sessionId, {
    kind: toolCall.kind,
    sessionUpdate: "tool_call",
    status: "pending",
    toolCallId: "call-1",
  });
  const answer = await ask("session/request_permission", {
    options: [
      { kind: "allow_once", name: "Allow once", optionId: "once" },
      { kind: "allow_always", name: "Always allow", optionId: "always" },
      { kind: "reject_once", name: "Reject", optionId: "reject" },
    ],
    sessionId: prompt.sessionId,
    toolCall: { ...toolCall, title: subject, toolCallId: "call-1" },
  });
  if (answer.outcome.optionId === "reject") {
    update(prompt.sessionId, { sessionUpdate: "tool_call_update", status: "failed", toolCallId: "call-1" });
    return finish("cancelled", null);
  }
  return finish("end_turn", `${subject}: ${answer.outcome.optionId ?? answer.outcome.outcome}`);
};

const runPrompt = async (prompt, text) => {
  if (isFragile) return;
  const fragile = /^fragile run (.+)$/.exec(text);
  if (fragile !== null) {
    isFragile = true;
    return askPermission(prompt, fragile[1], { kind: "execute", rawInput: { command: fragile[1] } });
  }
  const run = /^run (.+)$/.exec(text);
  if (run !== null) return askPermission(prompt, run[1], { kind: "execute", rawInput: { command: run[1] } });
  // "edit <path>" asks to change that file as OpenCode's edit tool did live on 2026-11-08: the input keeps the
  // path as the model wrote it, and the locations and diff carry it resolved against the folder.
  const edit = /^edit (.+)$/.exec(text);
  if (edit !== null) {
    const resolved = resolve(process.cwd(), edit[1]);
    return askPermission(prompt, edit[1], {
      content: [{ newText: "new", oldText: "old", path: resolved, type: "diff" }],
      kind: "edit",
      locations: [{ path: resolved }],
      name: "edit",
      rawInput: { newString: "new", oldString: "old", path: edit[1] },
    });
  }
  // The turn's note, when there is one, precedes the messages after a "---" line.
  const slow = /(?:^|\n---\n\n)slow (\d+)$/.exec(text);
  prompt.timer = setTimeout(() => finish("end_turn", `Echo: ${text}`), slow === null ? 10 : Number(slow[1]));
};

createInterface({ input: process.stdin }).on("line", (line) => {
  const message = JSON.parse(line);
  if (message.method === undefined) {
    waiting.get(message.id)?.(message.result);
    waiting.delete(message.id);
    return;
  }
  log({ method: message.method, params: message.params });
  const { id, method, params } = message;
  if (method === "initialize")
    return send({ id, result: { agentCapabilities: { loadSession: true }, protocolVersion: 1 } });
  if (method === "session/new") return send({ id, result: { sessionId: `ses-${process.pid}` } });
  if (method === "session/load") {
    // Loading replays the conversation before answering, as OpenCode does.
    update(params.sessionId, { content: { text: "old reply", type: "text" }, sessionUpdate: "agent_message_chunk" });
    return send({ id, result: {} });
  }
  if (method === "session/set_config_option") return send({ id, result: { configOptions: [] } });
  if (method === "session/prompt") {
    current = { id, sessionId: params.sessionId, timer: null };
    return void runPrompt(
      current,
      params.prompt
        .map((part) => part.text)
        .join("")
        .split("\n\n")
        .at(-1),
    );
  }
  if (method === "session/cancel") return isFragile ? process.exit(1) : finish("cancelled", null);
  if (id !== undefined) send({ error: { code: -32601, message: `unknown method ${method}` }, id });
});
