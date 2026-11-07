import { contextBridge, ipcRenderer } from "electron";

// The endpoint carries the per-launch owner token for the local service.
contextBridge.exposeInMainWorld("canopy", {
  /** Opens the system's folder dialog; resolves the chosen folder, or null when cancelled. */
  chooseFolder: (): Promise<string | null> => ipcRenderer.invoke("canopy:chooseFolder"),
  endpoint: (): Promise<string> => ipcRenderer.invoke("canopy:endpoint"),
});
