import { contextBridge, ipcRenderer } from "electron";
import type { DesktopBridge, TerminalSession } from "../../app/src/foundation/desktopBridge.ts";
import type { Theme } from "../../app/src/foundation/themeName.ts";

// The endpoint carries the per-launch owner token for the local service.
contextBridge.exposeInMainWorld("iskios", {
  endpoint: (): Promise<string> => ipcRenderer.invoke("iskios:endpoint"),
  /** Whether the window has no system title bar on macOS, so the app draws its own beside the traffic lights. */
  hasOwnTitleBar: process.platform === "darwin",
  setTheme: (theme: Theme): Promise<void> => ipcRenderer.invoke("iskios:setTheme", theme),
  terminalClose: (id: string): Promise<void> => ipcRenderer.invoke("iskios:terminalClose", id),
  terminalListen: (data: (id: string, text: string, sequence: number) => void, exit: (id: string) => void) => {
    const onData = (_event: Electron.IpcRendererEvent, id: string, text: string, sequence: number) =>
      data(id, text, sequence);
    const onExit = (_event: Electron.IpcRendererEvent, id: string) => exit(id);
    ipcRenderer.on("iskios:terminalData", onData);
    ipcRenderer.on("iskios:terminalExit", onExit);
    return () => {
      ipcRenderer.removeListener("iskios:terminalData", onData);
      ipcRenderer.removeListener("iskios:terminalExit", onExit);
    };
  },
  terminalOpen: (id: string, cwd: string | null): Promise<TerminalSession> =>
    ipcRenderer.invoke("iskios:terminalOpen", id, cwd),
  terminalResize: (id: string, cols: number, rows: number): Promise<void> =>
    ipcRenderer.invoke("iskios:terminalResize", id, cols, rows),
  terminalWrite: (id: string, data: string): Promise<void> => ipcRenderer.invoke("iskios:terminalWrite", id, data),
} satisfies DesktopBridge);
