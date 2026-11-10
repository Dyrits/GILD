import { contextBridge, ipcRenderer } from "electron";
import type { DesktopBridge, TerminalSession } from "../../app/src/desktopBridge.ts";

// The endpoint carries the per-launch owner token for the local service.
contextBridge.exposeInMainWorld("gild", {
  /** Opens the system's folder dialog; resolves the chosen folder, or null when cancelled. */
  chooseFolder: (): Promise<string | null> => ipcRenderer.invoke("gild:chooseFolder"),
  endpoint: (): Promise<string> => ipcRenderer.invoke("gild:endpoint"),
  /** Whether the window has no system title bar on macOS, so the app draws its own beside the traffic lights. */
  hasOwnTitleBar: process.platform === "darwin",
  terminalClose: (id: string): Promise<void> => ipcRenderer.invoke("gild:terminalClose", id),
  terminalListen: (data: (id: string, text: string, sequence: number) => void, exit: (id: string) => void) => {
    const onData = (_event: Electron.IpcRendererEvent, id: string, text: string, sequence: number) =>
      data(id, text, sequence);
    const onExit = (_event: Electron.IpcRendererEvent, id: string) => exit(id);
    ipcRenderer.on("gild:terminalData", onData);
    ipcRenderer.on("gild:terminalExit", onExit);
    return () => {
      ipcRenderer.removeListener("gild:terminalData", onData);
      ipcRenderer.removeListener("gild:terminalExit", onExit);
    };
  },
  terminalOpen: (id: string, cwd: string | null): Promise<TerminalSession> =>
    ipcRenderer.invoke("gild:terminalOpen", id, cwd),
  terminalResize: (id: string, cols: number, rows: number): Promise<void> =>
    ipcRenderer.invoke("gild:terminalResize", id, cols, rows),
  terminalWrite: (id: string, data: string): Promise<void> => ipcRenderer.invoke("gild:terminalWrite", id, data),
} satisfies DesktopBridge);
