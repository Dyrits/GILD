/** A bounded replay of the owner's local shell, held only until the desktop app quits. */
export interface TerminalSession {
  readonly cwd: string;
  readonly isRunning: boolean;
  readonly output: string;
  readonly sequence: number;
}

/** Capabilities exposed exclusively to the desktop window by its isolated preload. */
export interface DesktopBridge {
  chooseFolder(): Promise<string | null>;
  endpoint(): Promise<string>;
  readonly hasOwnTitleBar: boolean;
  /** Gives the Dock and the window the icon of the theme in use. */
  setTheme(theme: "gild" | "iskios"): Promise<void>;
  terminalClose(id: string): Promise<void>;
  terminalListen(data: (id: string, text: string, sequence: number) => void, exit: (id: string) => void): () => void;
  terminalOpen(id: string, cwd: string | null): Promise<TerminalSession>;
  terminalResize(id: string, cols: number, rows: number): Promise<void>;
  terminalWrite(id: string, data: string): Promise<void>;
}
