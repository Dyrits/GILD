import { chmodSync, existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir, userInfo } from "node:os";
import { dirname, isAbsolute, join, sep } from "node:path";
import { type IPty, spawn } from "node-pty";

const require = createRequire(import.meta.url);
const outputLimit = 200000;

/** The copy on disk of a path inside the packaged archive, where node-pty's native files are unpacked; other paths are unchanged. */
export const unpackedPathOf = (path: string) => path.replace(`${sep}app.asar${sep}`, `${sep}app.asar.unpacked${sep}`);

/** Repairs missing executable permissions on node-pty's bundled Unix helper. */
export const prepareTerminalHelper = () => {
  if (process.platform === "win32") return;
  // Inside the packaged archive the helper cannot be changed, so its unpacked copy is the one to repair.
  const root = unpackedPathOf(dirname(require.resolve("node-pty/package.json")));
  for (const folder of [
    join(root, "prebuilds", `${process.platform}-${process.arch}`),
    join(root, "build", "Release"),
  ]) {
    const helper = join(folder, "spawn-helper");
    if (existsSync(helper) && (statSync(helper).mode & 0o111) === 0) chmodSync(helper, 0o755);
  }
};

interface Session {
  readonly cwd: string;
  isRunning: boolean;
  output: string;
  readonly process: IPty;
  sequence: number;
}

/** Owns desktop shells independently of whether their conversation is visible. */
export class Terminals {
  private readonly sessions = new Map<string, Session>();
  constructor(
    private readonly onData: (id: string, data: string, sequence: number) => void,
    private readonly onExit: (id: string) => void,
    private readonly options = { home: homedir(), shell: userInfo().shell || process.env.SHELL || "/bin/sh" },
  ) {}

  /** Starts a shell or returns its retained output without restarting its process. */
  open(id: string, cwd: string | null) {
    if (typeof id !== "string" || id.length === 0 || id.length > 4096) throw new Error("Invalid terminal identifier.");
    if (cwd !== null && (typeof cwd !== "string" || !isAbsolute(cwd)))
      throw new Error("Choose an absolute realm folder.");
    const existing = this.sessions.get(id);
    if (existing !== undefined) return this.view(existing);
    if (this.sessions.size >= 32) throw new Error("Close an existing terminal before opening another.");
    const folder = cwd ?? this.options.home;
    if (!statSync(folder).isDirectory()) throw new Error("The terminal's starting folder is not a directory.");
    prepareTerminalHelper();
    const shell = spawn(this.options.shell, ["-l"], {
      cols: 80,
      cwd: folder,
      env: process.env,
      name: "xterm-256color",
      rows: 24,
    });
    const session: Session = { cwd: folder, isRunning: true, output: "", process: shell, sequence: 0 };
    this.sessions.set(id, session);
    shell.onData((data) => {
      session.output = (session.output + data).slice(-outputLimit);
      session.sequence++;
      if (this.sessions.get(id) === session) this.onData(id, data, session.sequence);
    });
    shell.onExit(() => {
      session.isRunning = false;
      if (this.sessions.get(id) === session) this.onExit(id);
    });
    return this.view(session);
  }

  private view(session: Session) {
    return { cwd: session.cwd, isRunning: session.isRunning, output: session.output, sequence: session.sequence };
  }

  /** Sends owner input to the shell, including control characters. */
  write(id: string, data: string) {
    if (typeof data !== "string" || data.length > 1000000) throw new Error("Terminal input is too large.");
    const session = this.sessions.get(id);
    if (session?.isRunning !== true) throw new Error("The shell has exited. Start a new shell.");
    session.process.write(data);
  }

  /** Keeps the pseudo-terminal's dimensions aligned with its visible surface. */
  resize(id: string, cols: number, rows: number) {
    if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || cols > 500 || rows < 1 || rows > 200)
      throw new Error("Invalid terminal dimensions.");
    const session = this.sessions.get(id);
    if (session?.isRunning === true) session.process.resize(cols, rows);
  }

  /** Ends the shell and discards its temporary replay buffer. */
  close(id: string) {
    const session = this.sessions.get(id);
    this.sessions.delete(id);
    if (session?.isRunning === true) session.process.kill();
  }

  /** Ends every shell when the desktop window closes. */
  dispose() {
    for (const id of this.sessions.keys()) this.close(id);
  }
}
