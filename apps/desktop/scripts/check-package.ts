// Exercises a packaged desktop app on isolated data: bun apps/desktop/scripts/check-package.ts /path/to/Iskios.app.
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const evaluate = (url: string, expression: string) =>
  new Promise<unknown>((resolve, reject) => {
    const socket = new WebSocket(url);
    const finish = (error: Error | null, value: unknown = null) => {
      clearTimeout(timer);
      socket.close();
      if (error !== null) reject(error);
      else resolve(value);
    };
    const timer = setTimeout(() => finish(new Error("The packaged renderer did not answer.")), 5000);
    socket.onopen = () =>
      socket.send(
        JSON.stringify({
          id: 1,
          method: "Runtime.evaluate",
          params: { awaitPromise: true, expression, returnByValue: true },
        }),
      );
    socket.onerror = () => finish(new Error("Cannot connect to the packaged renderer."));
    socket.onmessage = (event) => {
      const message: unknown = JSON.parse(String(event.data));
      if (!isRecord(message) || message.id !== 1) return;
      const result = message.result;
      if (!isRecord(result) || result.exceptionDetails !== undefined || !isRecord(result.result)) {
        const details = isRecord(result) && isRecord(result.exceptionDetails) ? result.exceptionDetails : null;
        const exception = details !== null && isRecord(details.exception) ? details.exception : null;
        const description =
          exception !== null && typeof exception.description === "string"
            ? exception.description
            : "No renderer error details.";
        finish(new Error(`The packaged renderer failed its startup check: ${description}`));
        return;
      }
      finish(null, result.result.value);
    };
  });

// The endpoint itself contains an owner token, so only the success verdict leaves the renderer.
const expression = `(async () => {
  if (!document.body.innerText.includes("Guildmaster") || typeof window.iskios?.endpoint !== "function") return "waiting";
  await window.iskios.endpoint();
  const session = await window.iskios.terminalOpen("package-check", null);
  await window.iskios.terminalClose("package-check");
  return session.isRunning ? "ready" : "terminal-failed";
})()`;

const check = async () => {
  const argument = process.argv[2];
  if (argument === undefined) throw new Error("Pass the packaged app bundle or executable path.");
  const target = resolve(argument);
  const executable = target.endsWith(".app") ? join(target, "Contents", "MacOS", "Iskios") : target;
  const folder = await mkdtemp(join(tmpdir(), "iskios-package-check-"));
  const child = spawn(executable, ["--remote-debugging-port=0"], {
    env: { ...process.env, ISKIOS_DATA_DIR: folder, ISKIOS_HARNESS: "fake" },
    stdio: "ignore",
  });
  let failure: Error | null = null;
  child.on("error", (error) => {
    failure = error;
  });
  const exited = new Promise<void>((resolve) => child.once("close", () => resolve()));
  try {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      if (failure !== null) throw failure;
      if (child.exitCode !== null || child.signalCode !== null)
        throw new Error(`The packaged app exited before it was ready (${child.exitCode ?? child.signalCode}).`);
      const active = await readFile(join(folder, "profile", "DevToolsActivePort"), "utf8").catch(() => null);
      const port = active?.split("\n")[0];
      if (port !== undefined && /^\d+$/.test(port)) {
        const response = await fetch(`http://127.0.0.1:${port}/json/list`).catch(() => null);
        const pages: unknown = response?.ok ? await response.json() : null;
        if (Array.isArray(pages)) {
          for (const page of pages) {
            if (!isRecord(page) || page.url !== "iskios-app://app/" || typeof page.webSocketDebuggerUrl !== "string")
              continue;
            const result = await evaluate(page.webSocketDebuggerUrl, expression);
            if (result === "ready") {
              console.log("PASS: packaged Guildmaster screen, service bridge, and native terminal are ready.");
              return;
            }
            if (result !== "waiting") throw new Error("The packaged terminal did not start.");
          }
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error("The packaged app did not render its screen and start its terminal within 30 seconds.");
  } finally {
    if (child.pid !== undefined && child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
      const timeout = setTimeout(() => child.kill("SIGKILL"), 5000);
      await exited;
      clearTimeout(timeout);
    }
    await rm(folder, { force: true, recursive: true });
  }
};

check().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
