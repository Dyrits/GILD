import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain, utilityProcess } from "electron";

const here = dirname(fileURLToPath(import.meta.url));
const appUrl = process.env.OPENMISSION_APP_URL ?? "http://localhost:8081";
// Lets checks run against a throwaway folder instead of the owner's data.
const dataDirectory = () => process.env.OPENMISSION_DATA_DIR ?? app.getPath("userData");

app.setName("OpenMission");

/** Starts the local service on Electron's Node and resolves its loopback endpoint. */
const startService = (token: string) => {
  const service = utilityProcess.fork(join(here, "service.js"), [], {
    serviceName: "OpenMission service",
    stdio: "inherit",
    env: {
      ...process.env,
      OPENMISSION_DATA_DIR: dataDirectory(),
      OPENMISSION_TOKEN: token,
    },
  });
  app.on("will-quit", () => service.kill());
  return new Promise<string>((resolve, reject) => {
    service.once("exit", (code) => reject(new Error(`The service exited with code ${code}`)));
    service.on("message", (message: { type?: string; port?: number }) => {
      if (message.type === "ready") resolve(`ws://127.0.0.1:${message.port}/?token=${token}`);
    });
  });
};

/** The dev server may still be starting; wait for it before loading the app. */
const load = async (window: BrowserWindow) => {
  for (let attempt = 0; attempt < 120; attempt++) {
    const reachable = await fetch(appUrl).then(
      (response) => response.ok,
      () => false,
    );
    if (reachable) return window.loadURL(appUrl);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Could not load ${appUrl}`);
};

app.whenReady().then(async () => {
  const token = randomBytes(32).toString("base64url");
  const endpoint = await startService(token);
  ipcMain.handle("openmission:endpoint", () => endpoint);

  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "OpenMission",
    webPreferences: { preload: join(here, "preload.cjs"), contextIsolation: true, sandbox: true },
  });
  await load(window);
});

app.on("window-all-closed", () => app.quit());
