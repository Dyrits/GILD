# Electron as the desktop shell

The local service is a Node program, and Electron ships Node, so the desktop app starts the service without bundling a second runtime, and loads the Expo app's web build in its window, as Paseo does. Tauri was considered for smaller downloads and lower memory use, but it would still need a bundled Node process for the service, keeping two runtimes for part of the gain. The window shows a plain web build, so a later move stays possible.
