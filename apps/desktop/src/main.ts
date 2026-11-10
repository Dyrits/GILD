import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog, ipcMain, utilityProcess } from "electron";
import { moveFormerData } from "./formerData.ts";
import { Terminals } from "./terminals.ts";

const here = dirname(fileURLToPath(import.meta.url));
/** The app's icon, beside `dist` in the desktop app's own `assets`. */
const iconPath = join(here, "..", "assets", "icon.png");
const appUrl = process.env.GILD_APP_URL ?? "http://localhost:8081";
// Lets checks run against a throwaway folder instead of the owner's data.
const dataDirectory = () => process.env.GILD_DATA_DIR ?? app.getPath("userData");
app.setName("Gild");
// A stop signal quits through the usual path, so will-quit stops the service too (dev.ts relaunches with it).
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => app.quit());

// Runs before Electron creates the new user-data folder at ready, so an install from before the rename keeps its data.
const formerDataMoved = Promise.resolve().then(() => {
  if (process.env.GILD_DATA_DIR !== undefined) return;
  const claudeFolder = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude");
  moveFormerData(app.getPath("appData"), app.getPath("userData"), claudeFolder);
});

/** Starts the local service on Electron's Node and resolves its loopback endpoint. */
const startService = (token: string) => {
  const service = utilityProcess.fork(join(here, "service.js"), [], {
    env: {
      ...process.env,
      GILD_DATA_DIR: dataDirectory(),
      GILD_TOKEN: token,
    },
    serviceName: "Gild service",
    stdio: "inherit",
  });
  app.on("will-quit", () => service.kill());
  return new Promise<string>((resolve, reject) => {
    service.once("exit", (code) => reject(new Error(`The service exited with code ${code}`)));
    service.on("message", (message: { type?: string; port?: number }) => {
      if (message.type === "ready") resolve(`ws://127.0.0.1:${message.port}/?token=${token}`);
    });
  });
};

/** The dev server may still be starting; waits for it, then loads the app. Resolves false when it never answers. */
const load = async (window: BrowserWindow) => {
  for (let attempt = 0; attempt < 120; attempt++) {
    const isReachable = await fetch(appUrl).then(
      (response) => response.ok,
      () => false,
    );
    if (isReachable) {
      await window.loadURL(appUrl);
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
};

/** Startup failures end here: the owner sees why, and the app quits instead of leaving an empty window. */
const quitWith = (reason: string) => {
  dialog.showErrorBox("Gild could not start", reason);
  app.quit();
};

app
  .whenReady()
  .then(() => formerDataMoved)
  .then(async () => {
    const token = randomBytes(32).toString("base64url");
    const endpoint = await startService(token);
    ipcMain.handle("gild:endpoint", () => endpoint);

    // macOS shows the dock icon of the running app; a packaged build will carry its own icon file.
    app.dock?.setIcon(iconPath);
    const window = new BrowserWindow({
      height: 800,
      icon: iconPath,
      title: "Gild",
      // On macOS the app's top bar is the title bar: the system's is hidden and its buttons stay.
      ...(process.platform === "darwin" ? { titleBarStyle: "hidden", trafficLightPosition: { x: 14, y: 12 } } : {}),
      webPreferences: { contextIsolation: true, preload: join(here, "preload.cjs"), sandbox: true },
      width: 1200,
    });
    const terminals = new Terminals(
      (id, data, sequence) => {
        if (!window.isDestroyed()) window.webContents.send("gild:terminalData", id, data, sequence);
      },
      (id) => {
        if (!window.isDestroyed()) window.webContents.send("gild:terminalExit", id);
      },
    );
    // Terminal execution is a desktop capability; embedded frames cannot call it.
    const checkTerminalSender = (event: Electron.IpcMainInvokeEvent) => {
      if (
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame ||
        new URL(event.senderFrame.url).origin !== new URL(appUrl).origin
      )
        throw new Error("Terminal access is only available in Gild's desktop window.");
    };
    ipcMain.handle("gild:terminalOpen", (event, id: string, cwd: string | null) => {
      checkTerminalSender(event);
      return terminals.open(id, cwd);
    });
    ipcMain.handle("gild:terminalWrite", (event, id: string, data: string) => {
      checkTerminalSender(event);
      terminals.write(id, data);
    });
    ipcMain.handle("gild:terminalResize", (event, id: string, cols: number, rows: number) => {
      checkTerminalSender(event);
      terminals.resize(id, cols, rows);
    });
    ipcMain.handle("gild:terminalClose", (event, id: string) => {
      checkTerminalSender(event);
      terminals.close(id);
    });
    window.on("closed", () => terminals.dispose());
    // Choose folder… opens the system's own dialog, Finder or Explorer (CHG-0035); null when cancelled.
    ipcMain.handle("gild:chooseFolder", async () => {
      const chosen = await dialog.showOpenDialog(window, {
        buttonLabel: "Use this folder",
        properties: ["openDirectory", "createDirectory"],
        title: "Choose a workspace folder",
      });
      return chosen.canceled ? null : (chosen.filePaths[0] ?? null);
    });
    if (!(await load(window))) quitWith(`Could not load ${appUrl}`);
  })
  .catch((error: Error) => quitWith(error.message));

app.on("window-all-closed", () => app.quit());
