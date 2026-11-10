const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const lines = Number(process.env.LINES ?? 17000);
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  await win.loadURL(
    "data:text/html,<div id=e contenteditable style='white-space:pre-wrap;max-height:200px;overflow-y:auto;width:600px'>typed </div>",
  );
  await win.webContents.executeJavaScript(fs.readFileSync("/tmp/gild-debug/probe/bulk.js", "utf8"));
  const result = await win.webContents.executeJavaScript(`(() => {
    const text = Array.from({ length: ${lines} }, (_, i) => "line " + i + " " + "x".repeat(40)).join("\\n");
    const e = document.getElementById("e"); e.focus();
    const r = document.createRange(); r.selectNodeContents(e); r.collapse(false);
    getSelection().removeAllRanges(); getSelection().addRange(r);
    const t = performance.now();
    Bulk.insertBulkText(e, text);
    void e.offsetHeight; // forces layout
    const ms = Math.round(performance.now() - t);
    const back = e.textContent;
    const caretAtEnd = getSelection().anchorNode === e && getSelection().anchorOffset === e.childNodes.length;
    return { ms, kept: back === "typed " + text, caretAtEnd, chars: text.length };
  })()`);
  console.log(JSON.stringify({ lines, result }));
  app.exit(0);
});
