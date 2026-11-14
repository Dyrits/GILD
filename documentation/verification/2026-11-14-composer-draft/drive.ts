// Drives a throwaway fake-harness Electron window (never the owner's profile) to reproduce: type an unsent message in a
// quest, leave for the Workshop, come back, and read the box. Exit code 1 means the text was lost (the bug).
// Usage: bun drive.ts <debug-port> [inspect]
import assert from "node:assert/strict";

const [port, mode] = process.argv.slice(2);
if (!port) throw new Error("Give a debug port");
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const target = targets.find((candidate: { type: string }) => candidate.type === "page");
assert(target, "No Electron page");
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));
let sequence = 0;
type Reply = { id?: number; result?: { exceptionDetails?: unknown; result?: { value?: unknown } } };
const pending = new Map<number, (reply: Reply) => void>();
socket.onmessage = ({ data }) => {
  const reply = JSON.parse(String(data));
  if (reply.id) {
    pending.get(reply.id)?.(reply);
    pending.delete(reply.id);
  }
};
const send = (method: string, params: object = {}) =>
  new Promise<Reply>((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => reject(new Error(`Timed out: ${method}`)), 15000);
    pending.set(id, (reply) => {
      clearTimeout(timer);
      resolve(reply);
    });
    socket.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression: string) => {
  const reply = await send("Runtime.evaluate", { awaitPromise: true, expression, returnByValue: true });
  if (reply.result?.exceptionDetails) throw new Error(JSON.stringify(reply.result.exceptionDetails));
  return reply.result?.result?.value;
};
const waitFor = async (expression: string) => {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await Bun.sleep(100);
  }
  throw new Error(`Condition did not become true: ${expression}`);
};
const buttons = () =>
  evaluate(`JSON.stringify([...document.querySelectorAll('[role="button"],[role="tab"],[role="link"],a')].map(e=>e.getAttribute('aria-label')||e.textContent.trim()))`);
const click = (label: string) =>
  evaluate(`(() => {
    const item = [...document.querySelectorAll('[role="button"],[role="tab"],[role="link"],a')]
      .find(e => e.getAttribute('aria-label') === ${JSON.stringify(label)} || e.textContent.trim() === ${JSON.stringify(label)});
    if (!item) throw new Error('Missing control: ' + ${JSON.stringify(label)});
    item.click();
  })()`);
const box = () => evaluate(`document.querySelector('[role="textbox"]')?.innerText ?? null`);

await send("Runtime.enable");
await send("Page.enable");
await send("Page.reload");
await Bun.sleep(1500);
await waitFor(`document.querySelector('[role="button"]') !== null`);
if (mode === "inspect") {
  console.log(await buttons());
  process.exit(0);
}
const message = "An unsent message about the build";
await click("New quest in borderlands");
await waitFor(`document.querySelector('[role="textbox"]') !== null`);
await evaluate(`document.querySelector('[role="textbox"]').focus()`);
await send("Input.insertText", { text: message });
await waitFor(`document.querySelector('[role="textbox"]').innerText.includes('unsent')`);
console.log("typed:", await box());
// Earlier runs leave quests named "New quest" behind; the open one is the row with a highlight.
const rows = `[...document.querySelectorAll('button[aria-label="New quest"]')]`;
const open = await evaluate(`${rows}.findIndex(e => /backgroundColor/.test(e.className))`);
assert((open as number) >= 0, "No highlighted quest row");
await click("Workshop");
await waitFor(`document.querySelector('[role="textbox"]') === null`);
await evaluate(`${rows}[${open}].click()`);
console.log("row", open, "highlighted after:", await evaluate(`${rows}.findIndex(e => /backgroundColor/.test(e.className))`));
await waitFor(`document.querySelector('[role="textbox"]') !== null`);
await Bun.sleep(500);
const after = await box();
console.log("after returning:", JSON.stringify(after));
process.exit(after === message ? 0 : 1);
