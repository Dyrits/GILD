import { randomBytes } from "node:crypto";
import { homedir, userInfo } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { app, BrowserWindow, dialog, ipcMain, net, protocol, shell, utilityProcess } from "electron";
import { appFileOf } from "./appFiles.ts";
import { iconFileOf } from "./appIcon.ts";
import { moveFormerData } from "./formerData.ts";
import { instanceOf } from "./instance.ts";
import { mergedPathOf, readLoginPath } from "./shellPath.ts";
import { Terminals } from "./terminals.ts";
import { setUpUpdates } from "./updates/setup.ts";

const here = dirname(fileURLToPath(import.meta.url));
/** The app's icons, beside `dist` in the desktop app's own `assets`: Iskios's, and Gild's hooded figure. */
const iconPathOf = (theme: unknown) => join(here, "..", "assets", iconFileOf(theme));
const iconPath = iconPathOf("iskios");
/** The installed app carries its screens and loads them from its own scheme; a development run loads the dev server. */
const appScheme = "iskios-app";
const appUrl = app.isPackaged ? `${appScheme}://app/` : (process.env.ISKIOS_APP_URL ?? "http://localhost:8081");
// Lets checks run against a throwaway folder instead of the owner's data.
const dataDirectory = () => process.env.ISKIOS_DATA_DIR ?? app.getPath("userData");
// Only the installed app is plain "Iskios" on the default profile and data folder; dev and checks run as "Iskios Dev".
const instance = instanceOf({
  appData: app.getPath("appData"),
  dataDirectory: process.env.ISKIOS_DATA_DIR,
  hasProfileSwitch: app.commandLine.hasSwitch("user-data-dir"),
  isPackaged: app.isPackaged,
});
app.setName(instance.name);
if (instance.profileFolder !== null) app.setPath("userData", instance.profileFolder);
// A scheme with a stable origin keeps the installed app's local storage from one launch to the next.
protocol.registerSchemesAsPrivileged([
  { privileges: { secure: true, standard: true, stream: true, supportFetchAPI: true }, scheme: appScheme },
]);
// One instance per profile: a second launch on the owner's data would run two services on one database.
const isFirstInstance = app.requestSingleInstanceLock();
if (!isFirstInstance) app.quit();
// A stop signal quits through the usual path, so will-quit stops the service too (dev.ts relaunches with it).
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => app.quit());

// Runs before Electron creates the new user-data folder at ready, so an install from before the rename keeps its data.
const formerDataMoved = Promise.resolve().then(() => {
  if (!isFirstInstance || !app.isPackaged || process.env.ISKIOS_DATA_DIR !== undefined) return;
  const claudeFolder = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude");
  moveFormerData(app.getPath("appData"), app.getPath("userData"), claudeFolder);
});

/** Starts the local service on Electron's Node and resolves its loopback endpoint. */
const startService = (token: string) => {
  const service = utilityProcess.fork(join(here, "service.js"), [], {
    env: {
      ...process.env,
      ISKIOS_DATA_DIR: dataDirectory(),
      ISKIOS_TOKEN: token,
    },
    serviceName: "Iskios service",
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
  if (app.isPackaged) {
    await window.loadURL(appUrl);
    return true;
  }
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
  dialog.showErrorBox("Iskios could not start", reason);
  app.quit();
};

let mainWindow: BrowserWindow | undefined;
// A second launch on this profile brings the running window forward instead of starting another service.
app.on("second-instance", () => {
  if (mainWindow === undefined || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app
  .whenReady()
  .then(() => formerDataMoved)
  .then(async () => {
    if (!isFirstInstance) return;
    if (app.isPackaged) {
      const root = join(here, "app");
      protocol.handle(appScheme, (request) => {
        const file = appFileOf(root, new URL(request.url).pathname);
        return file === null ? new Response("Not found", { status: 404 }) : net.fetch(pathToFileURL(file).toString());
      });
    }
    // A Finder or Dock launch gives only the system folders, where the harness tools are not; the service and the shells inherit this path.
    if (app.isPackaged) {
      const loginPath = readLoginPath(userInfo().shell || process.env.SHELL || "/bin/sh");
      process.env.PATH = mergedPathOf({ home: homedir(), launchPath: process.env.PATH, loginPath });
    }
    const token = randomBytes(32).toString("base64url");
    const endpoint = await startService(token);

    // macOS shows the dock icon of the running app; the packaged build carries its own icon file.
    app.dock?.setIcon(iconPath);
    const window = new BrowserWindow({
      height: 800,
      icon: iconPath,
      title: instance.name,
      // On macOS the app's top bar is the title bar: the system's is hidden and its buttons stay.
      ...(process.platform === "darwin" ? { titleBarStyle: "hidden", trafficLightPosition: { x: 14, y: 12 } } : {}),
      webPreferences: { contextIsolation: true, preload: join(here, "preload.cjs"), sandbox: true },
      width: 1200,
    });
    mainWindow = window;
    // The owner token travels in the endpoint: only the app's own main frame may read it (audit SA-12).
    ipcMain.handle("iskios:endpoint", (event) => {
      if (
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame ||
        new URL(event.senderFrame.url).origin !== new URL(appUrl).origin
      )
        throw new Error("The endpoint is only given to Iskios's desktop window.");
      return endpoint;
    });
    // A link in a reply opens in the system's browser, never in a window of its own that could receive the bridge, and
    // the app's window never navigates away from the app.
    window.webContents.setWindowOpenHandler(({ url }) => {
      if (/^(?:https?|mailto):/i.test(url)) void shell.openExternal(url);
      return { action: "deny" };
    });
    window.webContents.on("will-navigate", (event, url) => {
      if (new URL(url).origin !== new URL(appUrl).origin) event.preventDefault();
    });
    const terminals = new Terminals(
      (id, data, sequence) => {
        if (!window.isDestroyed()) window.webContents.send("iskios:terminalData", id, data, sequence);
      },
      (id) => {
        if (!window.isDestroyed()) window.webContents.send("iskios:terminalExit", id);
      },
    );
    // Terminal execution is a desktop capability; embedded frames cannot call it.
    const checkTerminalSender = (event: Electron.IpcMainInvokeEvent) => {
      if (
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame ||
        new URL(event.senderFrame.url).origin !== new URL(appUrl).origin
      )
        throw new Error("Terminal access is only available in Iskios's desktop window.");
    };
    ipcMain.handle("iskios:terminalOpen", (event, id: string, cwd: string | null) => {
      checkTerminalSender(event);
      return terminals.open(id, cwd);
    });
    ipcMain.handle("iskios:terminalWrite", (event, id: string, data: string) => {
      checkTerminalSender(event);
      terminals.write(id, data);
    });
    ipcMain.handle("iskios:terminalResize", (event, id: string, cols: number, rows: number) => {
      checkTerminalSender(event);
      terminals.resize(id, cols, rows);
    });
    ipcMain.handle("iskios:terminalClose", (event, id: string) => {
      checkTerminalSender(event);
      terminals.close(id);
    });
    window.on("closed", () => terminals.dispose());
    // The theme chosen in the app sets the Dock's and the window's icon; the installed file's own icon stays Iskios's.
    ipcMain.handle("iskios:setTheme", (event, theme: unknown) => {
      if (
        event.sender !== window.webContents ||
        new URL(event.senderFrame?.url ?? "").origin !== new URL(appUrl).origin
      )
        throw new Error("The theme is only set from Iskios's desktop window.");
      app.dock?.setIcon(iconPathOf(theme));
      window.setIcon(iconPathOf(theme));
    });
    // The installed app looks for a newer release once its window is up; the owner decides when it installs.
    const updates = await setUpUpdates(
      window,
      (event) =>
        event.sender === window.webContents &&
        event.senderFrame === window.webContents.mainFrame &&
        new URL(event.senderFrame.url).origin === new URL(appUrl).origin,
    );
    if (!(await load(window))) quitWith(`Could not load ${appUrl}`);
    else updates.start();
  })
  .catch((error: Error) => quitWith(error.message));

app.on("window-all-closed", () => app.quit());
