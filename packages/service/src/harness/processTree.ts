import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";

// Ending a harness's whole process tree (CHG-0208). OpenCode's `acp` starts its own `serve` child, which moves its
// children into other process groups: a signal to the root or its group can leave an orphan running (probe of
// 2026-11-12). The tree is read from the process table before anything dies, since an orphan loses its parent link;
// an orphan made anyway, when `acp` ends first, is found by the marker its environment inherited (sweepOrphans).

/** Every process's parent, read from `ps`; empty when it cannot be read. */
const parentsOf = (): Map<number, number> => {
  try {
    const table = execFileSync("ps", ["-A", "-o", "pid=,ppid="], { encoding: "utf8" });
    return new Map(
      table
        .split("\n")
        .map((line) => line.trim().split(/\s+/).map(Number))
        .filter((pair): pair is [number, number] => pair.length === 2 && pair.every(Number.isInteger))
        .map(([pid, ppid]) => [pid, ppid] as const),
    );
  } catch {
    return new Map();
  }
};

/** The root and every process descending from it, the root first. */
export const processTreeOf = (root: number) => {
  const children = new Map<number, Array<number>>();
  for (const [pid, ppid] of parentsOf()) children.set(ppid, [...(children.get(ppid) ?? []), pid]);
  const tree = [root];
  for (let index = 0; index < tree.length; index++) tree.push(...(children.get(tree[index] ?? -1) ?? []));
  return tree;
};

/** The command line of each given process, read from `ps`; processes it does not list are left out. */
const commandsOf = (pids: ReadonlyArray<number>) => {
  try {
    const table = execFileSync("ps", ["-A", "-o", "pid=,args="], { encoding: "utf8" });
    const wanted = new Set(pids);
    const commands = new Map<number, string>();
    for (const line of table.split("\n")) {
      const match = /^\s*(\d+)\s+(.*)$/.exec(line);
      if (match?.[1] !== undefined && match[2] !== undefined && wanted.has(Number(match[1])))
        commands.set(Number(match[1]), match[2]);
    }
    return commands;
  } catch {
    return new Map<number, string>();
  }
};

/**
 * Whether the root's own process tree holds OpenCode's executor: a descendant running `serve --stdio`, which `acp`
 * starts for itself (probe of 2026-11-12). An `acp` that served from a process outside its tree, such as an existing
 * background service, would run commands that the root's sandbox does not cover, so this is the check that those run
 * inside it. False when the tree or its command lines cannot be read: containment is then not confirmed.
 */
export const hasExecutorBelow = (root: number) => {
  const below = processTreeOf(root).slice(1);
  const isExecutor = (command: string) =>
    /(?:^|\s)serve(?:\s|$)/.test(command) && /(?:^|\s)--stdio(?:\s|$)/.test(command);
  return [...commandsOf(below).values()].some(isExecutor);
};

const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
};

const signal = (pid: number, name: NodeJS.Signals) => {
  try {
    process.kill(pid, name);
  } catch {
    // Already gone.
  }
};

const sleep = (millis: number) => new Promise((resolve) => setTimeout(resolve, millis));

/** Waits until none of the processes is alive, or the time is up; returns those still alive. */
const waitForEnd = async (pids: ReadonlyArray<number>, millis: number) => {
  for (let waited = 0; waited < millis; waited += 50) {
    if (!pids.some(isAlive)) return [];
    await sleep(50);
  }
  return pids.filter(isAlive);
};

/**
 * Ends the root and all its descendants: freezes the tree so no new child escapes, reads it again, asks every process
 * to end, then kills those still alive after the grace. A root started in its own process group (`isGroupLeader`) has
 * its whole group signalled too, which reaches a member the tree no longer links to. Returns the processes still alive
 * afterwards: none, normally.
 */
export const killProcessTree = async (root: number, graceMillis = 2000, isGroupLeader = false) => {
  let tree = processTreeOf(root);
  // Stopped processes keep their parent links and start nothing more, so the tree read again is complete.
  for (let round = 0; round < 5; round++) {
    for (const pid of tree) signal(pid, "SIGSTOP");
    const again = processTreeOf(root);
    const grown = [...new Set([...tree, ...again])];
    if (grown.length === tree.length) break;
    tree = grown;
  }
  if (isGroupLeader) signal(-root, "SIGTERM");
  for (const pid of tree) {
    signal(pid, "SIGTERM");
    signal(pid, "SIGCONT");
  }
  if (isGroupLeader) signal(-root, "SIGCONT");
  const left = await waitForEnd(tree, graceMillis);
  if (isGroupLeader) signal(-root, "SIGKILL");
  for (const pid of left) signal(pid, "SIGKILL");
  return waitForEnd(left, 1000);
};

/** The environment variable that marks every sandboxed process the service starts, and its value (sweepOrphans). */
export interface ProcessMarker {
  readonly name: string;
  readonly value: string;
}

/** A running process carrying a marker: its id, its parent, and its command line without the environment. */
export interface MarkedProcess {
  readonly command: string;
  readonly pid: number;
  readonly ppid: number;
}

/** The token a process's environment holds when it carries the marker, matched whole. */
const tokenOf = (marker: ProcessMarker) => `${marker.name}=${marker.value}`;

/**
 * macOS: `ps -E` appends the environment to the command line, for this user's processes only. The command line alone
 * is read without `-E`, so the environment is the rest of the line and an argument can never pass for it.
 */
const markedOnMac = (token: string): Array<MarkedProcess> => {
  const read = (args: ReadonlyArray<string>) => {
    const rows = new Map<number, { command: string; ppid: number }>();
    const table = execFileSync("ps", [...args], { encoding: "utf8", maxBuffer: 64_000_000 });
    for (const line of table.split("\n")) {
      const match = /^\s*(\d+)\s+(\d+)\s(.*)$/.exec(line);
      if (match?.[1] !== undefined && match[2] !== undefined && match[3] !== undefined)
        rows.set(Number(match[1]), { command: match[3].trim(), ppid: Number(match[2]) });
    }
    return rows;
  };
  const commands = read(["-ww", "-A", "-o", "pid=,ppid=,command="]);
  const withEnvironment = read(["-E", "-ww", "-A", "-o", "pid=,ppid=,command="]);
  const marked: Array<MarkedProcess> = [];
  for (const [pid, row] of withEnvironment) {
    const command = commands.get(pid)?.command;
    if (command === undefined || !row.command.startsWith(command)) continue;
    const environment = row.command.slice(command.length).split(/\s+/);
    if (environment.includes(token)) marked.push({ command, pid, ppid: row.ppid });
  }
  return marked;
};

/** Linux: each process's starting environment in /proc/<pid>/environ, readable for this user's processes. */
const markedOnLinux = (token: string): Array<MarkedProcess> => {
  const marked: Array<MarkedProcess> = [];
  for (const entry of readdirSync("/proc")) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      if (!readFileSync(`/proc/${entry}/environ`, "utf8").split("\0").includes(token)) continue;
      const command = readFileSync(`/proc/${entry}/cmdline`, "utf8").split("\0").join(" ").trim();
      // The parent is the fourth field of `stat`, after the command name in parentheses.
      const stat = readFileSync(`/proc/${entry}/stat`, "utf8");
      const ppid = Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[1]);
      marked.push({ command, pid: Number(entry), ppid });
    } catch {
      // Gone, or another user's process.
    }
  }
  return marked;
};

/** The running processes whose environment carries exactly this marker; empty when the table cannot be read. */
export const markedProcessesOf = (marker: ProcessMarker): Array<MarkedProcess> => {
  try {
    if (process.platform === "darwin") return markedOnMac(tokenOf(marker));
    if (process.platform === "linux") return markedOnLinux(tokenOf(marker));
  } catch {
    // Unreadable: nothing is taken for marked.
  }
  return [];
};

/** Whether a command line is OpenCode's: its executable, or the `serve ... --stdio` executor its `acp` starts. */
export const isOpenCodeCommand = (command: string) =>
  /(?:^|[\s/])opencode(?:\s|$)/.test(command) ||
  (/(?:^|\s)serve(?:\s|$)/.test(command) && /(?:^|\s)--stdio(?:\s|$)/.test(command));

/** This process and every process descending from it. */
const ownTree = () => new Set(processTreeOf(process.pid));

/**
 * Ends OpenCode processes the service started and lost (CHG-0208): those carrying the service's marker in their
 * environment, running OpenCode or its executor, and no longer descending from this process, such as the `serve` child
 * of an `acp` that ended first, or one left by a service that stopped. A process is never ended by its name alone,
 * nor one of this process's own living threads. Each is ended with its own tree; returns those still alive.
 */
export const sweepOrphans = async (marker: ProcessMarker) => {
  const isOrphan = (candidate: MarkedProcess, own: Set<number>) =>
    candidate.pid !== process.pid && !own.has(candidate.pid) && isOpenCodeCommand(candidate.command);
  const own = ownTree();
  const orphans = markedProcessesOf(marker).filter((candidate) => isOrphan(candidate, own));
  for (const orphan of orphans) await killProcessTree(orphan.pid, 1000);
  if (orphans.length === 0) return [];
  const ownAfter = ownTree();
  return markedProcessesOf(marker)
    .filter((candidate) => isOrphan(candidate, ownAfter))
    .map((candidate) => candidate.pid);
};
