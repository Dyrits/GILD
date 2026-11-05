// A scripted stand-in for `claude -p` in stream-json mode, shaped after
// transcripts captured from Claude Code 2.1.302. Behavior is set by environment:
// STAND_IN_LOG: file that receives one JSON line per process start ({ pid, args, cwd, env }).
// STAND_IN_MODE: "ok" (default), "fail-start" (exit 1 before answering), "error-result".
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
  const env = Object.keys(process.env).filter((key) => key.startsWith("OPENMISSION_"));
  appendFileSync(process.env.STAND_IN_LOG, `${JSON.stringify({ args, cwd: process.cwd(), env, pid: process.pid })}\n`);
}
if (mode === "fail-start") {
  process.stderr.write("stand-in: cannot start\n");
  process.exit(1);
}

const emit = (event) => process.stdout.write(`${JSON.stringify({ ...event, session_id: sessionId })}\n`);
emit({ model: option("--model") ?? "default", subtype: "init", tools: [], type: "system" });

let turn = 0;
for await (const line of createInterface({ input: process.stdin })) {
  const text = JSON.parse(line).message.content;
  turn += 1;
  if (mode === "error-result") {
    emit({
      error: "model_not_found",
      message: { content: [{ text: "There's an issue with the selected model.", type: "text" }], role: "assistant" },
      type: "assistant",
    });
    emit({ is_error: true, result: "There's an issue with the selected model.", subtype: "success", type: "result" });
    continue;
  }
  const reply = `Reply ${turn} (pid ${process.pid}) to: ${text}`;
  emit({ event: { type: "message_start" }, type: "stream_event" });
  for (const word of reply.split(" ")) {
    emit({
      event: { delta: { text: `${word} `, type: "text_delta" }, type: "content_block_delta" },
      type: "stream_event",
    });
  }
  emit({ message: { content: [{ text: reply, type: "text" }], role: "assistant" }, type: "assistant" });
  emit({
    is_error: false,
    result: reply,
    subtype: "success",
    type: "result",
    usage: { cache_creation_input_tokens: 50, cache_read_input_tokens: 100, input_tokens: 2, output_tokens: 10 },
  });
}
