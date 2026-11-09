import { contextBridge, ipcRenderer } from "electron";

// The endpoint carries the per-launch owner token for the local service.
contextBridge.exposeInMainWorld("gild", {
  /** Opens the system's folder dialog; resolves the chosen folder, or null when cancelled. */
  chooseFolder: (): Promise<string | null> => ipcRenderer.invoke("gild:chooseFolder"),
  endpoint: (): Promise<string> => ipcRenderer.invoke("gild:endpoint"),
  /** Whether the window has no system title bar on macOS, so the app draws its own beside the traffic lights. */
  hasOwnTitleBar: process.platform === "darwin",
});
