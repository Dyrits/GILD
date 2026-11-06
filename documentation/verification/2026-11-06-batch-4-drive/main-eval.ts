// Evaluates an expression in Electron's main process through the Node inspector.
const [port, expression] = [process.argv[2], process.argv[3]];
const targets = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as {
  webSocketDebuggerUrl: string;
}[];
const socket = new WebSocket(targets[0].webSocketDebuggerUrl);
await new Promise((resolve) => socket.addEventListener("open", resolve));
socket.send(
  JSON.stringify({
    id: 1,
    method: "Runtime.evaluate",
    params: { awaitPromise: true, expression, includeCommandLineAPI: true, returnByValue: true },
  }),
);
const reply = await new Promise<string>((resolve) =>
  socket.addEventListener("message", (event) => resolve(String(event.data))),
);
console.log(reply);
socket.close();
