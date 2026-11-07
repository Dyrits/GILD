// A scripted stand-in for `claude -p` in stream-json mode, shaped after
// transcripts captured from Claude Code 2.1.302. Behavior is set by environment:
// STAND_IN_LOG: file that receives one JSON line per process start ({ pid, args, cwd, env }).
// STAND_IN_INPUT: file that receives each line written to the stand-in's stdin.
// STAND_IN_MODE: "ok" (default), "fail-start" (exit 1 before answering), "error-result".
// A message "slow <millis>" keeps its turn running that long. A message written during a turn joins it
// and is echoed with its uuid (--replay-user-messages), unless its text contains "unseen": that one is
// held, as when it arrives just after the turn ends, and runs as a turn of its own 200 ms after the
// result, as Claude Code does. An `interrupt` control request ends the running turn.
import { appendFileSync } from "node:fs";
import { createInterface } from "node:readline";

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};
const sessionId = option("--session-id") ?? option("--resume");
const mode = process.env.STAND_IN_MODE ?? "ok";
if (process.env.STAND_IN_LOG) {
  const env = Object.keys(process.env).filter((key) => key.startsWith("CANOPY_"));
  const home = process.env.CLAUDE_CONFIG_DIR ?? null;
  appendFileSync(
    process.env.STAND_IN_LOG,
    `${JSON.stringify({ args, cwd: process.cwd(), env, home, pid: process.pid })}\n`,
  );
}
if (mode === "fail-start") {
  process.stderr.write("stand-in: cannot start\n");
  process.exit(1);
}

const emit = (event) => process.stdout.write(`${JSON.stringify({ ...event, session_id: sessionId })}\n`);
emit({ model: option("--model") ?? "default", subtype: "init", tools: [], type: "system" });

let turn = 0;
/** The running turn: its first message, messages joined to it, held messages, and its timer. */
let current = null;

const reply = (text) => {
  emit({ event: { type: "message_start" }, type: "stream_event" });
  for (const word of text.split(" ")) {
    emit({
      event: { delta: { text: `${word} `, type: "text_delta" }, type: "content_block_delta" },
      type: "stream_event",
    });
  }
  emit({ message: { content: [{ text, type: "text" }], role: "assistant" }, type: "assistant" });
  emit({
    is_error: false,
    result: text,
    subtype: "success",
    type: "result",
    usage: { cache_creation_input_tokens: 50, cache_read_input_tokens: 100, input_tokens: 2, output_tokens: 10 },
  });
};

const finish = (isInterrupted) => {
  const ended = current;
  current = null;
  clearTimeout(ended.timer);
  if (isInterrupted) {
    emit({
      message: { content: [{ text: "[Request interrupted by user]", type: "text" }], role: "user" },
      type: "user",
    });
    emit({ is_error: true, subtype: "error_during_execution", type: "result" });
  } else {
    const joined = ended.joined.length === 0 ? "" : ` + ${ended.joined.join(" + ")}`;
    reply(`Reply ${ended.turn} (pid ${process.pid}) to: ${ended.text}${joined}`);
  }
  if (ended.held.length > 0) setTimeout(() => ended.held.forEach(startTurn), 200);
};

const startTurn = (input) => {
  const text = input.message.content;
  turn += 1;
  emit({ message: input.message, type: "user", uuid: input.uuid ?? "stand-in" });
  if (mode === "error-result") {
    emit({
      error: "model_not_found",
      message: { content: [{ text: "There's an issue with the selected model.", type: "text" }], role: "assistant" },
      type: "assistant",
    });
    emit({ is_error: true, result: "There's an issue with the selected model.", subtype: "success", type: "result" });
    return;
  }
  const slow = /^slow (\d+)$/.exec(text);
  current = { held: [], joined: [], text, timer: null, turn };
  if (slow === null) finish(false);
  else current.timer = setTimeout(() => finish(false), Number(slow[1]));
};

createInterface({ input: process.stdin }).on("line", (line) => {
  if (process.env.STAND_IN_INPUT) appendFileSync(process.env.STAND_IN_INPUT, `${line}\n`);
  const input = JSON.parse(line);
  if (input.type === "control_request") {
    const stillQueued = current === null ? [] : current.held.map((held) => held.uuid);
    emit({
      response: { request_id: input.request_id, response: { still_queued: stillQueued }, subtype: "success" },
      type: "control_response",
    });
    if (input.request?.subtype === "interrupt" && current !== null) finish(true);
    return;
  }
  if (current === null) return startTurn(input);
  if (input.message.content.includes("unseen")) return current.held.push(input);
  emit({ message: input.message, type: "user", uuid: input.uuid });
  current.joined.push(input.message.content);
});
