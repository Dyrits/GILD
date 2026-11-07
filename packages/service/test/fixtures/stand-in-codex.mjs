// A scripted stand-in for `codex app-server`, shaped after the protocol of codex-cli 0.160.1 as probed on
// 2026-11-07. STAND_IN_LOG receives one JSON line per process start ({ args, cwd, env, pid }) and one per
// request it receives ({ method, params }).
// A turn's text decides what it does: "run <command>" asks approval for that command first and says
// whether it was accepted; "slow <millis>" keeps the turn running; "fail" ends the turn failed; anything
// else is echoed. Steered messages join the running turn and are echoed after it.
import { appendFileSync } from "node:fs";
import { createInterface } from "node:readline";

const log = (entry) => {
  if (process.env.STAND_IN_LOG) appendFileSync(process.env.STAND_IN_LOG, `${JSON.stringify(entry)}\n`);
};
const accountKeys = ["CODEX_HOME", "CLAUDE_CONFIG_DIR", "XDG_DATA_HOME"];
log({
  args: process.argv.slice(2),
  cwd: process.cwd(),
  env: Object.keys(process.env).filter((key) => key.startsWith("CANOPY_")),
  home: Object.fromEntries(accountKeys.filter((key) => process.env[key]).map((key) => [key, process.env[key]])),
  pid: process.pid,
});

const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);
const note = (method, params) => send({ method, params });
let threadId = null;
let mcpUrl = null;
let nextServerId = 1000;
const waiting = new Map();
/** The running turn: its id, steered texts, and how it ends. */
let current = null;

const ask = (method, params) =>
  new Promise((resolve) => {
    const id = nextServerId++;
    waiting.set(id, resolve);
    send({ id, method, params });
  });

const finish = (status, text) => {
  const turn = current;
  if (turn === null) return;
  current = null;
  clearTimeout(turn.timer);
  if (text !== null) {
    const itemId = `msg-${turn.id}`;
    note("item/started", { item: { id: itemId, text: "", type: "agentMessage" }, threadId, turnId: turn.id });
    for (const word of text.split(" "))
      note("item/agentMessage/delta", { delta: `${word} `, itemId, threadId, turnId: turn.id });
    note("item/completed", { item: { id: itemId, text, type: "agentMessage" }, threadId, turnId: turn.id });
  }
  const last = { cachedInputTokens: 30, cacheWriteInputTokens: 1, inputTokens: 100, outputTokens: 7, totalTokens: 107 };
  note("thread/tokenUsage/updated", { threadId, tokenUsage: { last, total: last }, turnId: turn.id });
  note("turn/completed", {
    threadId,
    turn: { error: status === "failed" ? { message: "stand-in: the turn failed" } : null, id: turn.id, status },
  });
};

/** Calls one thread tool on the thread's MCP endpoint, as Codex would, and returns its text. */
const callTool = async (name, args) => {
  const response = await fetch(mcpUrl, {
    body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "tools/call", params: { arguments: args, name } }),
    headers: { accept: "application/json, text/event-stream", "content-type": "application/json" },
    method: "POST",
  });
  const data = (await response.text())
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => line.slice(6))
    .join("");
  return JSON.parse(data)
    .result.content.map((block) => block.text)
    .join("");
};

const runTurn = async (turn, text) => {
  const tool = /^call (\S+) (.*)$/.exec(text);
  if (tool !== null) return finish("completed", await callTool(tool[1], JSON.parse(tool[2])));
  const run = /^run (.+)$/.exec(text);
  if (run !== null) {
    const answer = await ask("item/commandExecution/requestApproval", {
      command: run[1],
      itemId: "exec-1",
      reason: "stand-in needs it",
      threadId,
      turnId: turn.id,
    });
    return finish("completed", `${run[1]}: ${answer.decision}`);
  }
  if (text === "fail") return finish("failed", null);
  // The turn's note, when there is one, precedes the messages after a "---" line.
  const slow = /(?:^|\n---\n\n)slow (\d+)$/.exec(text);
  const delay = slow === null ? 10 : Number(slow[1]);
  turn.timer = setTimeout(
    () => finish("completed", [`Echo: ${text}`, ...turn.steered.map((steered) => `+ ${steered}`)].join(" ")),
    delay,
  );
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
  if (method === "initialize") return send({ id, result: { userAgent: "stand-in" } });
  if (method === "initialized") return;
  if (method === "thread/start" || method === "thread/resume") mcpUrl = params.config["mcp_servers.canopy.url"];
  if (method === "thread/start") {
    threadId = `codex-thread-${process.pid}`;
    return send({ id, result: { thread: { id: threadId } } });
  }
  if (method === "thread/resume") {
    threadId = params.threadId;
    return send({ id, result: { thread: { id: threadId } } });
  }
  if (method === "turn/start") {
    const turn = { id: `turn-${Date.now()}-${Math.random()}`, steered: [], timer: null };
    current = turn;
    send({ id, result: { turn: { id: turn.id, status: "inProgress" } } });
    note("turn/started", { threadId, turn: { id: turn.id } });
    const text = params.input.map((input) => input.text).join("");
    note("item/started", { item: { clientId: null, id: "user-1", type: "userMessage" }, threadId, turnId: turn.id });
    return void runTurn(turn, text.split("\n\n").at(-1));
  }
  if (method === "turn/steer") {
    if (current === null || current.id !== params.expectedTurnId)
      return send({ error: { code: -32600, message: "no active turn" }, id });
    current.steered.push(params.input.map((input) => input.text).join(""));
    send({ id, result: { turnId: current.id } });
    return note("item/started", {
      item: { clientId: params.clientUserMessageId, id: `user-${Date.now()}`, type: "userMessage" },
      threadId,
      turnId: current.id,
    });
  }
  if (method === "turn/interrupt") {
    send({ id, result: {} });
    return finish("interrupted", null);
  }
  send({ error: { code: -32601, message: `unknown method ${method}` }, id });
});
