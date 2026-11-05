import { contextBridge, ipcRenderer } from "electron";

// The endpoint carries the per-launch owner token for the local service.
contextBridge.exposeInMainWorld("openMission", {
  endpoint: (): Promise<string> => ipcRenderer.invoke("openmission:endpoint"),
});
