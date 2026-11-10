const { app, BrowserWindow } = require("electron");
const mode = process.env.MODE ?? "insertText";
const lines = Number(process.env.LINES ?? 17000);
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  await win.loadURL(
    "data:text/html,<div id=e contenteditable style='white-space:pre-wrap;max-height:200px;overflow-y:auto;width:600px'></div>",
  );
  const result = await Promise.race([
    win.webContents.executeJavaScript(`(() => {
      const text = Array.from({ length: ${lines} }, (_, i) => "line " + i + " " + "x".repeat(40)).join("\\n");
      const e = document.getElementById("e"); e.focus();
      const t = performance.now();
      if ("${mode}" === "insertText") document.execCommand("insertText", false, text);
      else { e.appendChild(document.createTextNode(text)); }
      return { ms: Math.round(performance.now() - t), chars: text.length };
    })()`),
    new Promise((r) => setTimeout(() => r("TIMEOUT 60s"), 60000)),
  ]);
  console.log(JSON.stringify({ lines, mode, result }));
  app.exit(0);
});
