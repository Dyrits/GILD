import type { Theme } from "./themeName";
import type { UpdatesBridge } from "./updateState";

/** A bounded replay of the owner's local shell, held only until the desktop app quits. */
export interface TerminalSession {
  readonly cwd: string;
  readonly isRunning: boolean;
  readonly output: string;
  readonly sequence: number;
}

/** Capabilities exposed exclusively to the desktop window by its isolated preload. */
export interface DesktopBridge {
  endpoint(): Promise<string>;
  readonly hasOwnTitleBar: boolean;
  /** Gives the Dock and the window the icon of the theme in use. */
  setTheme(theme: Theme): Promise<void>;
  terminalClose(id: string): Promise<void>;
  terminalListen(data: (id: string, text: string, sequence: number) => void, exit: (id: string) => void): () => void;
  terminalOpen(id: string, cwd: string | null): Promise<TerminalSession>;
  terminalResize(id: string, cols: number, rows: number): Promise<void>;
  terminalWrite(id: string, data: string): Promise<void>;
  /** Finding and installing a newer release of the installed app. */
  readonly updates: UpdatesBridge;
}
