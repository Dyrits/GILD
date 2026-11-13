// Drive a throwaway fake-harness Electron window, never the owner's ordinary profile.
// Usage: bun drive.ts <debug-port> <output-directory> [inspect]
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const [port, output, mode] = process.argv.slice(2);
if (!port || !output) throw new Error("Give a debug port and output directory");
await mkdir(output, { recursive: true });
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const target = targets.find((candidate: { type: string }) => candidate.type === "page");
assert(target, "No Electron page");
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));
let sequence = 0;
type Reply = { id?: number; method?: string; params?: unknown; result?: { exceptionDetails?: unknown; result?: { data?: string; value?: unknown } } };
const pending = new Map<number, (reply: Reply) => void>();
const errors: string[] = [];
socket.onmessage = ({ data }) => {
  const reply = JSON.parse(String(data));
  if (reply.id) {
    pending.get(reply.id)?.(reply);
    pending.delete(reply.id);
  }
  if (reply.method === "Runtime.exceptionThrown") errors.push(JSON.stringify(reply.params));
};
const send = (method: string, params: object = {}) => new Promise<Reply>((resolve, reject) => {
  const id = ++sequence;
  const timer = setTimeout(() => reject(new Error(`Timed out: ${method}`)), 15000);
  pending.set(id, (reply) => { clearTimeout(timer); resolve(reply); });
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression: string) => {
  const reply = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
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
const text = () => evaluate("document.body.innerText");
const click = (label: string) => evaluate(`(async () => {
  const item = [...document.querySelectorAll('[role="button"],[role="tab"],[role="menuitem"],[role="radio"]')]
    .find(element => element.getAttribute('aria-label') === ${JSON.stringify(label)} || element.textContent.trim() === ${JSON.stringify(label)});
  if (!item) throw new Error('Missing control: ' + ${JSON.stringify(label)});
  item.click();
  await new Promise(resolve => setTimeout(resolve, 0));
})()`);
const shot = async (name: string) => {
  const result = await send("Page.captureScreenshot", { format: "png" });
  await Bun.write(join(output, `${name}.png`), Buffer.from(result.result.data, "base64"));
};
const rpc = (request: object) => evaluate(`(async () => {
  const endpoint = await window.iskios.endpoint();
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(endpoint);
    const timer = setTimeout(() => { ws.close(); reject(new Error('Service timeout')); }, 10000);
    ws.onopen = () => ws.send(JSON.stringify({ id: 'proof', request: ${JSON.stringify(request)} }));
    ws.onmessage = ({data}) => {
      const frame = JSON.parse(data);
      if (frame.id !== 'proof') return;
      clearTimeout(timer); ws.close();
      if (frame._tag === 'Failure') reject(new Error(frame.error.message));
      else resolve(frame.value);
    };
  });
})()`);
// The service's answers, as far as this proof reads them; anything else fails loudly.
type Panel = { backups: ReadonlyArray<unknown> };
type Settings = { tiers: { Heavy: Panel | null } };
type Detail = { thread: { id: string; model: string }; threads: ReadonlyArray<{ id: string }> };
type Listing = { missions: ReadonlyArray<{ id: string }> };
const isObject = (value: unknown): value is object => typeof value === "object" && value !== null;
const isPanel = (value: unknown): value is Panel =>
  isObject(value) && "backups" in value && Array.isArray(value.backups);
const isSettings = (value: unknown): value is Settings =>
  isObject(value) && "tiers" in value && isObject(value.tiers) && "Heavy" in value.tiers;
const isDetail = (value: unknown): value is Detail =>
  isObject(value) && "thread" in value && "threads" in value && Array.isArray(value.threads);
const isListing = (value: unknown): value is Listing =>
  isObject(value) && "missions" in value && Array.isArray(value.missions);
const expect = <Shape>(value: unknown, isShape: (candidate: unknown) => candidate is Shape): Shape => {
  if (!isShape(value)) throw new Error(`Unexpected service answer: ${JSON.stringify(value)}`);
  return value;
};
const readSettings = async () => expect(await rpc({ _tag: "ReadSettings" }), isSettings);
const readPanel = async (threadId: string) => expect(await rpc({ _tag: "ReadThreadPanel", threadId }), isPanel);
const readMission = async (missionId: string, threadId: string | null) =>
  expect(await rpc({ _tag: "ReadMission", missionId, threadId }), isDetail);
const until = async <Value>(read: () => Promise<Value>, predicate: (value: Value) => boolean) => {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const value = await read();
    if (predicate(value)) return value;
    await Bun.sleep(100);
  }
  throw new Error(`Service condition failed: ${read}`);
};

try {
  await send("Runtime.enable");
  await send("Page.enable");
  if (mode !== "inspect") await send("Page.reload");
  await waitFor("document.querySelector('[role=\"button\"]') !== null");
  if (mode === "inspect" && process.argv[5]) console.log(await evaluate(process.argv[5]));
  console.log(await text());
  console.log(await evaluate(`JSON.stringify([...document.querySelectorAll('[role="button"],[role="tab"],[role="menuitem"]')]
    .map(element=>({label:element.getAttribute('aria-label'),text:element.textContent.trim()})))`));
  if (mode === "inspect") console.log(await evaluate(`document.querySelector('[aria-label="Preset Heavy"]')?.outerHTML`));
  if (mode !== "inspect") {
    const codex = { accountId: null, effort: "default", harness: "codex", model: "gpt-6.1-terra" };
    const opencode = { accountId: null, effort: "default", harness: "opencode", model: "opencode/big-pickle" };
    const light = { accountId: null, backups: [], effort: "default", harness: "claude", model: "claude-haiku-5-5" };
    const heavy = { accountId: null, backups: [codex, opencode], effort: "high", harness: "claude", model: "claude-opus-5-5" };
    await rpc({ _tag: "ChangeSettings", change: { tiers: { Light: light, Balanced: null, Heavy: heavy } } });
    await click("Workshop");
    await waitFor("document.body.innerText.includes('Permissions')");
    await click("Companions");
    await waitFor("document.body.innerText.includes('2 backups')");
    await evaluate(`(() => {
      if (!document.querySelector('[aria-label="Backup 2"]'))
        document.querySelectorAll('[aria-label="Change this Companion in the Companions tab"]')[3].click();
    })()`);
    await waitFor("document.querySelector('[aria-label=\"Backup 2\"]') !== null");
    await shot("workshop-preset-backups");
    await click("+ Add a backup Companion");
    await until(readSettings, (settings) => settings.tiers.Heavy?.backups.length === 3);
    await waitFor("document.body.innerText.includes('3 backups')");
    console.log("Workshop: a preset's third backup is persisted and counted in its table");

    await click("New quest in borderlands");
    await waitFor("document.querySelector('[aria-label=\"Companion (model)\"]') !== null");
    const listing = expect(await rpc({ _tag: "ListMissions", isArchived: false, search: null, state: null, workspaceId: null }), isListing);
    const quest = listing.missions[0];
    assert(quest, "Quest created from sidebar");
    const detail = await readMission(quest.id, null);
    const threadId = detail.thread.id;
    await click("Companion (model)");
    await waitFor("document.querySelector('[aria-label=\"Preset Heavy\"]') !== null");
    assert.equal(await evaluate("document.querySelector('[aria-label=\"Preset Balanced\"]') === null"), true);
    await click("Preset Heavy");
    await until(() => readPanel(threadId), (panel) => panel.backups.length === 3);
    await waitFor("document.querySelectorAll('[aria-label=\"Backup 3\"]').length > 0");
    assert.equal((await readMission(quest.id, threadId)).thread.model, heavy.model);
    await waitFor("document.querySelector('[aria-label=\"Preset Heavy\"]').getAttribute('aria-checked') === 'true'");
    await shot("quest-whole-stack");
    console.log("Quest: choosing Heavy copies primary and all three backups");

    await click("Preset Light");
    await until(() => readPanel(threadId), (panel) => panel.backups.length === 0);
    await waitFor("document.querySelector('[aria-label=\"Backup 1\"]') === null");
    await shot("quest-empty-stack");
    console.log("Quest: choosing Light clears Heavy's backups");

    await click("Preset Heavy");
    await until(() => readPanel(threadId), (panel) => panel.backups.length === 3);
    const settings = await readSettings();
    await rpc({ _tag: "ChangeSettings", change: { tiers: { ...settings.tiers, Heavy: { ...heavy, backups: [codex] } } } });
    await waitFor("document.querySelector('[aria-label=\"Preset Heavy\"]').textContent.includes('1 backup')");
    assert.equal((await readPanel(threadId)).backups.length, 3);
    assert.notEqual(await evaluate("document.querySelector('[aria-label=\"Preset Heavy\"]').getAttribute('aria-checked')"), "true");
    await shot("quest-copied-not-linked");
    console.log("Preset edits update the chooser but do not change the quest; a different stack is not marked selected");

    await click("Open side-quest");
    await waitFor("document.body.innerText.includes('New side-quest beneath')");
    // The draft reads settings asynchronously, and an open column may briefly show its by-hand picker before presets arrive, so pressing its Companion button then would close that column.
    await waitFor("document.querySelector('[aria-label=\"Show quest panel\"], [aria-label=\"Hide quest panel\"]') !== null");
    if (await evaluate("document.querySelector('[aria-label=\"Show quest panel\"]') !== null"))
      await click("Companion (model)");
    await waitFor("document.querySelector('[aria-label=\"Preset Heavy\"]') !== null");
    await click("Preset Heavy");
    await waitFor("document.querySelector('[aria-label=\"Backup 1\"]') !== null && document.querySelector('[aria-label=\"Backup 2\"]') === null");
    await evaluate(`document.querySelector('[contenteditable="true"]').focus()`);
    await send("Input.insertText", { text: "Hello preset draft" });
    await click("Send");
    const child = await until(() => readMission(quest.id, null), (value) => value.threads.length === 2);
    const side = child.threads.find((thread) => thread.id !== threadId);
    assert(side, "Side-quest created");
    assert.deepEqual((await readPanel(side.id)).backups, [codex]);
    assert.equal((await readPanel(threadId)).backups.length, 3);
    await shot("side-quest-preset");
    console.log("Draft side-quest: saves the chosen whole stack, leaving the parent's backups untouched");
  }
  assert.equal(errors.length, 0, errors.join("\n"));
} finally {
  socket.close();
}
