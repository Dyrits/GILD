// Run against throwaway fake-harness data:
// bun documentation/verification/2026-11-13-computer-name-and-companions/scripts/cdp.ts <port> <absolute-path-to-this-file> [screens-directory]
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

interface Driver {
  evaluate: (expression: string) => Promise<unknown>;
  logs: string[];
  send: (method: string, parameters: object) => Promise<unknown>;
}

/** Checks panel ownership through the rendered controls, without reading React state. */
export default async function drive({ evaluate, logs, send }: Driver) {
  const capture = async (name: string) => {
    const output = process.argv[4];
    if (output === undefined) return;
    const reply = await send("Page.captureScreenshot", { format: "png" });
    assert(reply !== null && typeof reply === "object" && "result" in reply);
    const result = reply.result;
    assert(result !== null && typeof result === "object" && "data" in result && typeof result.data === "string");
    await mkdir(output, { recursive: true });
    await Bun.write(join(output, `${name}.png`), Buffer.from(result.data, "base64"));
  };
  const labelOf = (label: string) =>
    label === "Default Companion" ? "Change this Companion in the Companions tab"
      : label === "Choose Iskios's Companion" ? "Companion (model)" : label;
  const until = async (expression: string) => {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      if ((await evaluate(expression)) === true) return;
      await Bun.sleep(50);
    }
    console.log(logs);
    assert.fail(`Condition did not become true: ${expression}`);
  };
  const click = async (label: string) => {
    const result = await evaluate(`(async () => {
      const item = [...document.querySelectorAll('[role="button"],[role="tab"]')]
        .find(element => element.getAttribute('aria-label') === ${JSON.stringify(labelOf(label))}
          || element.textContent.trim() === ${JSON.stringify(label)});
      if (!item) return false;
      item.click();
      await new Promise(resolve => setTimeout(resolve, 0));
      return true;
    })()`);
    assert.equal(result, true, `Missing control: ${label}`);
  };
  const has = (label: string) =>
    `document.querySelector(${JSON.stringify(`[aria-label="${labelOf(label)}"]`)}) !== null`;
  const hasTabs = `document.querySelector('[role="tab"]') !== null`;
  const iskiosTab = `([...document.querySelectorAll('[role="tab"]')]
    .some(element => element.textContent.includes('✦'))
    && document.querySelector('[aria-label="Companion"]') !== null)`;
  const openQuestPicker = async () => {
    // The destination's composer loads separately; until then only Iskios's button is mounted.
    await until(`document.querySelectorAll('[aria-label="Companion (model)"]').length === 2`);
    await click("Companion (model)");
    await until(`!(${iskiosTab}) && ${hasTabs}`);
  };
  const rpc = async (request: Record<string, unknown>) => {
    const result = await evaluate(`(async () => {
      const endpoint = await window.iskios.endpoint();
      return new Promise((resolve) => {
        const socket = new WebSocket(endpoint);
        const timer = setTimeout(() => { socket.close(); resolve(null); }, 10000);
        socket.onopen = () => socket.send(JSON.stringify({ id: 'panel-proof', request: ${JSON.stringify(request)} }));
        socket.onmessage = ({data}) => {
          const frame = JSON.parse(data);
          if (frame.id !== 'panel-proof') return;
          clearTimeout(timer);
          socket.close();
          resolve({ ok: frame._tag !== 'Failure', value: frame.value });
        };
      });
    })()`);
    assert(result !== null && typeof result === "object" && "ok" in result && result.ok && "value" in result,
      `Service request failed: ${request._tag}`);
    return result.value;
  };

  await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  await until(has("Workshop"));
  if ((await evaluate(has("Ask Iskios"))) === true) await click("Ask Iskios");
  await until(has("Choose Iskios's Companion"));
  await click("Workshop");
  await until(`document.body.innerText.includes('Configure your guild')`);
  await click("Companions");
  await until(has("Default Companion"));
  await click("Default Companion");
  await until(hasTabs);
  await click("Permissions");
  await until(`!${has("Default Companion")}`);
  assert.equal(await evaluate(hasTabs), false, "Workshop picker carries into Permissions while Iskios is open");
  await capture("workshop-permissions-closed");
  console.log("PASS: the Workshop picker closes when its section changes");

  await click("Choose Iskios's Companion");
  await until(iskiosTab);
  await click("Companions");
  await until(has("Default Companion"));
  assert.equal(await evaluate(iskiosTab), true, "Iskios keeps its picker when the Workshop offers another");
  await click("Guild Hall");
  await until(`document.body.innerText.includes('RECENT QUESTS')`);
  assert.equal(await evaluate(iskiosTab), true, "Iskios keeps its picker on another page");
  await click("Workshop");
  await until(`document.body.innerText.includes('Configure your guild')`);
  assert.equal(await evaluate(iskiosTab), true, "Iskios keeps its picker when returning");
  await click("Companions");
  await until(has("Default Companion"));
  await click("Default Companion");
  await until(`!(${iskiosTab}) && ${hasTabs}`);
  await click("Permissions");
  await until(`!${has("Default Companion")}`);
  assert.equal(await evaluate(hasTabs), false, "Choosing a page picker ends the Iskios carry-over");
  await click("Companions");
  await until(has("Default Companion"));
  assert.equal(await evaluate(hasTabs), false, "Returning to the section starts closed");
  await click("Choose Iskios's Companion");
  await until(iskiosTab);
  await click("Fold Iskios");
  await until(`!(${hasTabs})`);
  await click("Ask Iskios");
  await until(has("Choose Iskios's Companion"));
  assert.equal(await evaluate(hasTabs), false, "Reopening Iskios does not revive a closed picker");
  await click("Choose Iskios's Companion");
  await until(iskiosTab);
  await click("Hide quest panel");
  await until(`!(${hasTabs})`);
  await click("Guild Hall");
  await until(`document.body.innerText.includes('RECENT QUESTS')`);
  assert.equal(await evaluate(hasTabs), false, "Closing the picker stops carry-over without folding Iskios");
  console.log("PASS: only the explicitly opened Iskios picker carries; replacing or closing it clears it");

  const suffix = Date.now();
  const create = async (title: string) => {
    const result = await rpc({ _tag: "StartEmptyQuest", realmId: null, requestId: crypto.randomUUID() });
    assert(result !== null && typeof result === "object" && "missionId" in result && "threadId" in result);
    await rpc({ _tag: "RenameMission", missionId: result.missionId, title });
    return result;
  };
  const firstTitle = `Panel quest one ${suffix}`;
  const secondTitle = `Panel quest two ${suffix}`;
  const first = await create(firstTitle);
  await create(secondTitle);
  await until(has(firstTitle));
  await click(firstTitle);
  await until(has("Open side-quest"));
  assert.equal(await evaluate(hasTabs), false, "A quest starts with details closed on a 1600px window");
  await click("Show quest panel");
  await until(hasTabs);
  await click(secondTitle);
  await until(has("Show quest panel"));
  assert.equal(await evaluate(hasTabs), false, "Another quest does not inherit open details");
  await openQuestPicker();
  await click(firstTitle);
  await until(has("Show quest panel"));
  assert.equal(await evaluate(hasTabs), false, "Returning to a quest does not inherit the other quest's picker");

  const child = await rpc({
    _tag: "OpenThread", attachmentIds: [], effort: "default", model: "claude-haiku-5-5",
    parentThreadId: first.threadId, requestId: crypto.randomUUID(), shouldStartAnyway: true,
    text: `Panel side quest ${suffix}`,
  });
  assert(child !== null && typeof child === "object" && "threadId" in child);
  const tree = await rpc({ _tag: "ReadThreadTree", missionId: first.missionId });
  assert(Array.isArray(tree));
  const side = tree.find((candidate: unknown): candidate is { id: unknown; title: string } =>
    candidate !== null && typeof candidate === "object" && "id" in candidate
    && candidate.id === child.threadId && "title" in candidate && typeof candidate.title === "string");
  assert(side);
  await until(has(side.title));
  await click("Show quest panel");
  await until(hasTabs);
  await click(side.title);
  await until(has("Show quest panel"));
  assert.equal(await evaluate(hasTabs), false, "A side-quest does not inherit the parent's details");
  await openQuestPicker();
  await click("Guild Hall");
  await until(`document.body.innerText.includes('RECENT QUESTS')`);
  assert.equal(await evaluate(hasTabs), false, "A side-quest's picker closes on leaving");
  console.log("PASS: quests and side-quests start closed and never inherit details or pickers");

  const realmOne = `Panel realm one ${suffix}`;
  const realmTwo = `Panel realm two ${suffix}`;
  await rpc({ _tag: "CreateRealm", crest: null, name: realmOne, path: null });
  await rpc({ _tag: "CreateRealm", crest: null, name: realmTwo, path: null });
  await until(has(`Open ${realmOne} overview`));
  await click(`Open ${realmOne} overview`);
  await until(has("Show quest panel"));
  assert.equal(await evaluate(hasTabs), false, "A realm starts closed");
  await click("Show quest panel");
  await until(hasTabs);
  await click(`Open ${realmTwo} overview`);
  await until(has("Show quest panel"));
  assert.equal(await evaluate(hasTabs), false, "Another realm starts closed");
  await click("Companion (model)");
  await until(iskiosTab);
  await click(firstTitle);
  await until(has("Open side-quest"));
  assert.equal(await evaluate(iskiosTab), true, "Iskios's picker survives entering a quest");
  await capture("quest-with-iskios-picker");
  await click(`Open ${realmOne} overview`);
  await until(has(`Open ${realmTwo} overview`));
  assert.equal(await evaluate(iskiosTab), true, "Iskios's picker survives entering a realm");
  await click("Realm");
  await until(`!(${iskiosTab}) && ${hasTabs}`);
  await click(`Open ${realmTwo} overview`);
  await until(has("Show quest panel"));
  assert.equal(await evaluate(hasTabs), false, "Selecting details ends Iskios's carry-over");
  await capture("realm-details-closed");
  console.log("PASS: realms start closed; Iskios's picker alone carries into quests and realms");
}
