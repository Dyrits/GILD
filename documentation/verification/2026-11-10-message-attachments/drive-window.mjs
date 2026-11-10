// Drives the running Gild window over the DevTools protocol: a 17,000-line paste, then a pasted image sent with a message.
const targets = await (await fetch("http://127.0.0.1:9333/json")).json();
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  pending.get(d.id)?.(d);
};
const run = (expression) =>
  new Promise((resolve) => {
    const n = ++id;
    pending.set(n, resolve);
    ws.send(
      JSON.stringify({
        id: n,
        method: "Runtime.evaluate",
        params: { awaitPromise: true, expression, returnByValue: true },
      }),
    );
  }).then((d) =>
    d.result?.exceptionDetails
      ? { error: d.result.exceptionDetails.exception?.description ?? "exception" }
      : d.result?.result?.value,
  );
const until = async (expression, label, ms = 20000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await run(expression)) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log("TIMEOUT waiting for", label);
  return false;
};
const out = {};
await until(`!!document.querySelector('[role=textbox]')`, "textbox");

// 1. The 17,000-line paste.
if (!process.env.SKIP_BIG)
  out.bigPaste = await run(`(async () => {
  const box = document.querySelector('[role=textbox]'); box.focus();
  const text = Array.from({ length: 17000 }, (_, i) => "line " + i + " " + "x".repeat(40)).join("\\n");
  const dt = new DataTransfer(); dt.setData("text/plain", text);
  const t = performance.now();
  box.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 50));
  const sendEnabled = !document.querySelector('[aria-label=Send]').hasAttribute('disabled') && document.querySelector('[aria-label=Send]').getAttribute('aria-disabled') !== 'true';
  return { ms: Math.round(performance.now() - t), chars: box.textContent.length, expected: text.length, sendEnabled };
})()`);
// Clear it again.
await run(
  `(() => { const b = document.querySelector('[role=textbox]'); b.focus(); document.execCommand('selectAll'); document.execCommand('delete'); })()`,
);

// 2. A 2000x1000 PNG pasted with no text.
out.imagePaste = await run(`(async () => {
  const c = document.createElement('canvas'); c.width = 2000; c.height = 1000;
  const g = c.getContext('2d'); g.fillStyle = '#c03030'; g.fillRect(0, 0, 2000, 1000);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const dt = new DataTransfer(); dt.items.add(new File([blob], 'shot.png', { type: 'image/png' }));
  const box = document.querySelector('[role=textbox]'); box.focus();
  box.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  return { bytes: blob.size };
})()`);
out.thumbnail = await until(
  `!!document.querySelector('[aria-label="shot.png"]') && !!document.querySelector('[aria-label="Remove shot.png"]')`,
  "thumbnail",
);
await new Promise((r) => setTimeout(r, 1500)); // upload settles
out.sendEnabledWithImageOnly = await run(
  `(() => { const s = document.querySelector('[aria-label=Send]'); return s.getAttribute('aria-disabled') !== 'true' && !s.hasAttribute('disabled'); })()`,
);

// 3. Type a message and send it.
await run(
  `(() => { const b = document.querySelector('[role=textbox]'); b.focus(); document.execCommand('insertText', false, 'look at this'); })()`,
);
await run(`document.querySelector('[aria-label=Send]').click()`);
out.echoed = await until(`document.body.innerText.includes('[images: shot.png]')`, "echo with images", 30000);
out.sentThumbnail = await until(
  `(() => [...document.querySelectorAll('[aria-label="shot.png"]')].some((x) => /url(/.test(x.innerHTML) || /url(/.test(getComputedStyle(x).backgroundImage) || x.querySelector('img')))()`,
  "sent thumbnail",
);
out.stripClearedAfterSend = await run(`!document.querySelector('[aria-label="Remove shot.png"]')`);
console.log(JSON.stringify(out, null, 1));
ws.close();
