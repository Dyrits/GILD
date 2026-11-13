// Minimal CDP driver: bun /tmp/iskios-verify/cdp.ts <port> <script-file>
const port = process.argv[2];
const targets = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()) as Array<{ type: string; webSocketDebuggerUrl: string; url: string }>;
const page = targets.find((t) => t.type === "page" && !t.url.startsWith("devtools"));
if (!page) throw new Error("no page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map<number, (v: any) => void>();
const logs: string[] = [];
ws.onmessage = (e) => {
  const m = JSON.parse(String(e.data));
  if (m.id && pending.has(m.id)) pending.get(m.id)!(m);
  if (m.method === "Runtime.consoleAPICalled") logs.push(`${m.params.type}: ${m.params.args.map((a: any) => a.value ?? a.description ?? "").join(" ").slice(0, 300)}`);
  if (m.method === "Runtime.exceptionThrown") logs.push(`exception: ${m.params.exceptionDetails.text} ${m.params.exceptionDetails.exception?.description?.slice(0, 300) ?? ""}`);
};
const send = (method: string, params: object = {}) =>
  new Promise<any>((resolve) => {
    const i = ++id;
    pending.set(i, resolve);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
await send("Runtime.enable");
await send("Page.enable");
const evaluate = async (expression: string) => {
  const r = await send("Runtime.evaluate", { awaitPromise: true, expression, returnByValue: true });
  return r.result?.result?.value ?? r.result?.exceptionDetails?.text;
};
const shot = async (name: string) => {
  const r = await send("Page.captureScreenshot", { format: "png" });
  await Bun.write(`/tmp/iskios-verify/shots/${name}.png`, Buffer.from(r.result.data, "base64"));
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const script = (await import(process.argv[3]!)).default;
await script({ evaluate, logs, shot, sleep, send });
ws.close();
