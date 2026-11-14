// Disposable fake-harness data only:
// bun documentation/verification/2026-11-13-computer-name-and-companions/scripts/cdp.ts <port> <absolute-drive-path> <screens-directory> <realm-folder>
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { MissionDetail, MissionList, RealmArchivePreview, StartEmptyQuestResult, OpenThreadResult } from "../../../packages/contracts/src/index.ts";
import { Schema } from "../../../packages/service/node_modules/effect/dist/index.js";

type Driver = {
  evaluate: (expression: string) => Promise<unknown>;
  logs: string[];
  send: (method: string, parameters: object) => Promise<unknown>;
};

/** Exercises realm archive, return navigation, restoration, and fresh folder recovery through the rendered app. */
export default async function drive({ evaluate, logs, send }: Driver) {
  const folder = process.argv[5];
  const output = process.argv[4];
  assert(folder && output, "Pass a disposable realm folder and a screenshot directory");
  const until = async (expression: string) => {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      if (await evaluate(expression) === true) return;
      await Bun.sleep(50);
    }
    console.log(logs);
    console.log(await evaluate("document.body.innerText"));
    assert.fail(`Condition did not become true: ${expression}`);
  };
  const has = (label: string) => `(document.querySelector(${JSON.stringify(`[aria-label="${label}"]`)}) !== null)`;
  const click = async (label: string) => {
    const expression = `(() => {
      const item = [...document.querySelectorAll('[role="button"],[role="radio"],[role="checkbox"]')]
        .find(element => element.getAttribute('aria-label') === ${JSON.stringify(label)}
          || element.textContent.trim() === ${JSON.stringify(label)});
      if (!item || item.getAttribute('aria-disabled') === 'true') return false;
      item.click(); return true;
    })()`;
    await until(expression);
  };
  const fill = async (label: string, value: string) => {
    assert.equal(await evaluate(`(() => {
      const input = document.querySelector(${JSON.stringify(`input[aria-label="${label}"]`)});
      if (!input) return false;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event('input', {bubbles: true})); return true;
    })()`), true, `Missing input ${label}`);
  };
  const rpc = async <Value>(request: object, schema: Schema.Schema<Value>): Promise<Value> => {
    const result = await evaluate(`(async () => {
      const socket = new WebSocket(await window.iskios.endpoint());
      return new Promise(resolve => {
        const timer = setTimeout(() => { socket.close(); resolve({ok:false, value:'timeout'}); }, 10000);
        socket.onopen = () => socket.send(JSON.stringify({id:'realm-proof', request:${JSON.stringify(request)}}));
        socket.onmessage = ({data}) => {
          const frame = JSON.parse(data);
          if (frame.id !== 'realm-proof') return;
          clearTimeout(timer); socket.close();
          resolve({ok: frame._tag !== 'Failure', value: frame._tag === 'Failure' ? frame.error : frame.value});
        };
      });
    })()`);
    const reply = Schema.decodeUnknownSync(Schema.Struct({ ok: Schema.Boolean, value: Schema.Unknown }))(result);
    assert(reply.ok, `Service request failed: ${JSON.stringify(reply.value)}`);
    return Schema.decodeUnknownSync(schema)(reply.value);
  };
  const listed = () => rpc({ _tag: "ListMissions", isArchived: false, search: null, state: null, workspaceId: null }, MissionList);
  const capture = async (name: string) => {
    await evaluate(`(async () => {
      await new Promise(requestAnimationFrame);
      await Promise.all(document.getAnimations().filter(animation =>
        animation.effect?.getComputedTiming().iterations !== Infinity
      ).map(animation => animation.finished.catch(() => {})));
      return true;
    })()`);
    const result = Schema.decodeUnknownSync(Schema.Struct({ result: Schema.Struct({ data: Schema.String }) }))(
      await send("Page.captureScreenshot", { format: "png" }),
    );
    await mkdir(output, { recursive: true });
    await Bun.write(join(output, `${name}.png`), Buffer.from(result.result.data, "base64"));
  };
  await mkdir(folder, { recursive: true });
  await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  await until(has("Workshop"));
  if (process.env.ISKIOS_PROOF_LOOK === "light") {
    await click("Workshop");
    await click("Look and feel");
    await click("Light");
    await until(`document.documentElement.style.colorScheme === 'light' && ${has("Workshop")}`);
  }
  await rpc({ _tag: "CreateRealm", crest: null, name: "Proof garden", path: folder }, Schema.Null);
  await rpc({ _tag: "CreateRealm", crest: null, name: "Empty proof realm", path: null }, Schema.Null);
  const realm = (await listed()).workspaces.find((candidate) => candidate.name === "Proof garden");
  assert(realm);
  const quest = await rpc({ _tag: "StartEmptyQuest", realmId: realm.id, requestId: crypto.randomUUID() }, StartEmptyQuestResult);
  await rpc({ _tag: "RenameMission", missionId: quest.missionId, title: "Garden quest" }, Schema.Null);
  await rpc({
    _tag: "SendMessage", delivery: null, requestId: crypto.randomUUID(), threadId: quest.threadId,
    text: 'call save_intel {"kind":"fact","scope":"workspace","text":"The realm has a garden."}',
  }, Schema.Unknown);
  for (let attempt = 0; attempt < 300; attempt++) {
    const detail = await rpc({ _tag: "ReadMission", missionId: quest.missionId, threadId: null }, MissionDetail);
    if (detail.thread.state === "Idle") break;
    assert(attempt < 299, "The lore turn did not become idle");
    await Bun.sleep(20);
  }
  const border = await rpc({ _tag: "StartEmptyQuest", realmId: null, requestId: crypto.randomUUID() }, StartEmptyQuestResult);
  await rpc({ _tag: "RenameMission", missionId: border.missionId, title: "Border quest" }, Schema.Null);
  await click("Open Realms overview");
  await until(has("Realms overview"));
  assert.equal(await evaluate(`document.querySelector('[aria-label="Realms overview"]').textContent.includes('Border quest')`), false);
  await until(`document.querySelector('[aria-label="Realms overview"]').textContent.includes('Garden quest')`);
  await capture("realms-grouped");
  await click("Garden quest");
  await until(has("Archive quest"));
  await click("Archive quest");
  await until(`${has("Archive realm")} && !${has("Archive quest")}`);
  assert.equal((await listed()).missions.some((mission) => mission.id === quest.missionId), false);
  await capture("quest-returned-to-realm");
  await click("Border quest");
  await until(has("Archive quest"));
  await click("Archive quest");
  await until(`document.body.innerText.includes('No quest in the Borderlands yet.') && !${has("Archive quest")}`);
  console.log("PASS: quest archive returns to its realm or the Borderlands");

  const working = await rpc({ _tag: "StartEmptyQuest", realmId: realm.id, requestId: crypto.randomUUID() }, StartEmptyQuestResult);
  await rpc({
    _tag: "OpenThread", effort: "default", model: "default", parentThreadId: working.threadId,
    requestId: crypto.randomUUID(), shouldStartAnyway: false, text: "wait 60000",
  }, OpenThreadResult);
  await click("Open Proof garden overview");
  await until(has("Archive realm"));
  await click("Archive realm");
  await until(`document.body.innerText.includes('threads are still running')`);
  await capture("archive-confirmation");
  await click("Cancel");
  assert((await listed()).workspaces.some((candidate) => candidate.id === realm.id));
  await click("Archive realm");
  await click("Stop and archive realm");
  await until(has("Realms overview"));
  assert.equal((await listed()).workspaces.some((candidate) => candidate.id === realm.id), false);
  console.log("PASS: realm archive confirms, cancels unchanged, stops work, and returns to Realms");

  await click("Archive");
  await until(`document.body.innerText.includes('Proof garden') && document.body.innerText.includes('Restore')`);
  await capture("archive-with-realm");
  await click("Restore");
  await click("Restore realm");
  await until(`!document.body.innerText.includes('Restore realm')`);
  const restored = await listed();
  assert(restored.missions.some((mission) => mission.id === working.missionId));
  assert(!restored.missions.some((mission) => mission.id === quest.missionId));
  console.log("PASS: restoring a realm does not reopen previously archived quests");

  const again = await rpc({ _tag: "PreviewRealmArchive", workspaceId: realm.id }, RealmArchivePreview);
  await rpc({ _tag: "ArchiveRealm", workspaceId: realm.id, snapshot: again.snapshot }, Schema.Null);
  await click("New realm");
  await until(has("Realm name"));
  await fill("Realm name", "Fresh proof garden");
  await click("Choose folder…");
  await until(has("Search folders"));
  await fill("Search folders", folder);
  await click(`Use ${folder.split("/").at(-1)}`);
  await click("Create the realm");
  await until(`document.body.innerText.includes('This realm is archived')`);
  await click("Start afresh");
  await until(`document.body.innerText.includes("Choose the realm's name and crest")`);
  await capture("recovery-comparison");
  await click("Keep name: Proof garden");
  await click("Use proposed crest");
  await click("Continue");
  await until(`document.body.innerText.includes('Delete 1 realm-level lore entries')`);
  await capture("fresh-confirmation");
  await click("Cancel");
  assert((await rpc({ _tag: "ListArchivedRealms" }, Schema.Array(RealmArchivePreview))).some((candidate) => candidate.realm.id === realm.id));
  await click("Create the realm");
  await click("Start afresh");
  await click("Keep name: Proof garden");
  await click("Use proposed crest");
  await click("Continue");
  await click("Wipe lore and start afresh");
  await until(`!${has("Realm name")}`);
  const fresh = await listed();
  assert.equal(fresh.workspaces.find((candidate) => candidate.id === realm.id)?.name, "Proof garden");
  assert.equal(fresh.missions.filter((mission) => mission.workspaceId === realm.id).length, 0);
  assert.equal((await rpc({ _tag: "PreviewRealmArchive", workspaceId: realm.id }, RealmArchivePreview)).loreCount, 0);
  await capture("fresh-realm");
  console.log("PASS: same-folder recovery keeps the id, permits mixed appearance choices, and wipes only realm lore after confirmation");

  // The archive asks what happens to quests and Rituals (CHG-0270): one quest is moved out, the other archived with the realm.
  const keep = await rpc({ _tag: "StartEmptyQuest", realmId: realm.id, requestId: crypto.randomUUID() }, StartEmptyQuestResult);
  await rpc({ _tag: "RenameMission", missionId: keep.missionId, title: "Keep me" }, Schema.Null);
  const leave = await rpc({ _tag: "StartEmptyQuest", realmId: realm.id, requestId: crypto.randomUUID() }, StartEmptyQuestResult);
  await rpc({ _tag: "RenameMission", missionId: leave.missionId, title: "Archive me" }, Schema.Null);
  const ritual = await rpc({
    _tag: "CreateRitual", fallbacks: [], instruction: "Hello", requestId: crypto.randomUUID(),
    primary: { accountId: null, effort: "default", harness: "claude", model: "claude-sonnet-5-5" },
    schedule: { _tag: "Daily", time: "07:00" }, title: "Garden digest", workspacePath: folder,
  }, Schema.Struct({ missionId: Schema.String, ritualId: Schema.String }));
  await click("Open Realms overview");
  await click("Open Proof garden overview");
  await until(has("Archive realm"));
  await click("Archive realm");
  await until(`document.body.innerText.includes('Garden digest') && ${has("Move Keep me to the Borderlands")}`);
  assert.equal(await evaluate(`document.body.innerText.includes('Moves to the Borderlands')`), false, "Nothing starts checked");
  await click("Move Keep me to the Borderlands");
  await until(`document.body.innerText.includes('Moves to the Borderlands') && document.body.innerText.includes('Archive realm, move 1')`);
  await capture("archive-choices");
  await click("Cancel");
  assert((await listed()).workspaces.some((candidate) => candidate.id === realm.id), "Cancel keeps the realm");
  await click("Archive realm");
  await click("Move Keep me to the Borderlands");
  await click("Archive realm, move 1");
  await until(has("Realms overview"));
  const after = await listed();
  assert.equal(after.workspaces.some((candidate) => candidate.id === realm.id), false);
  assert.equal(after.missions.find((mission) => mission.id === keep.missionId)?.workspaceId, null);
  assert.equal(after.missions.some((mission) => mission.id === leave.missionId), false);
  const read = await rpc({ _tag: "ReadRitual", missionId: ritual.missionId }, Schema.Unknown) as { isOn: boolean; isRealmArchived: boolean };
  assert.deepEqual([read.isOn, read.isRealmArchived], [false, true]);
  await click("Rituals");
  await until(`document.body.innerText.includes('Realm archived')`);
  await capture("ritual-realm-archived");
  console.log("PASS: realm archive moves the chosen quest to the Borderlands, archives the rest, and switches the Ritual off");
  assert.equal(logs.some((line) => line.startsWith("exception:")), false, logs.join("\n"));
}
