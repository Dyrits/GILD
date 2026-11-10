// Drives the web message box alone in Chrome and asserts what it reads back; see reproduce.sh.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { height: 200, width: 700 } });
await page.goto(`file://${process.argv[2]}/index.html`);
const out = () => page.evaluate(() => window.__out);
await page.locator("[role=textbox]").click();
await page.keyboard.type("Use the /arch");
assert.deepEqual((await out()).trigger, { character: "/", query: "arch" });
await page.keyboard.press("Tab");
await page.keyboard.type("skill. See @sr");
assert.deepEqual((await out()).trigger, { character: "@", query: "sr" });
await page.keyboard.press("Tab");
await page.keyboard.type("ok");
assert.equal((await out()).text, "Use the /architect skill. See @src/ ok");
assert.equal(await page.locator("[data-token]").count(), 2);
await page.screenshot({ path: `${process.argv[3]}/chips-in-text.png` });
await page.keyboard.press("Backspace");
await page.keyboard.press("Backspace");
await page.keyboard.press("Backspace");
await page.keyboard.press("Backspace");
assert.equal(await page.locator("[data-token]").count(), 1, "Backspace removes the chip whole");
await page.keyboard.press("Shift+Enter");
await page.keyboard.type("y");
assert.match((await out()).text, /\ny$/);
console.log("editor check passed");
await browser.close();
