import { spawnSync } from "node:child_process";
import { join } from "node:path";

const startMark = "__GILD_PATH_START__";
const endMark = "__GILD_PATH_END__";

/** The path a login shell prints between the marks, so whatever its start-up files print around it is ignored; null when it printed none. */
export const pathFromShellOutput = (output: string): string | null => {
  const start = output.indexOf(startMark);
  const end = output.indexOf(endMark, start + startMark.length);
  if (start === -1 || end === -1) return null;
  const path = output.slice(start + startMark.length, end).trim();
  return path === "" ? null : path;
};

/** The shell's own path, read the way the owner's terminal sees it; null when the shell fails, hangs, or prints none. */
export const readLoginPath = (shell: string): string | null => {
  // printenv is an executable, so the same line works in zsh, bash, and fish; -i loads what only an interactive shell's rc file sets.
  const script = `printf '${startMark}'; printenv PATH; printf '${endMark}'`;
  const result = spawnSync(shell, ["-l", "-i", "-c", script], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 5000,
  });
  return result.status === 0 ? pathFromShellOutput(result.stdout) : null;
};

export interface MergedPathInput {
  home: string;
  /** The path the app was launched with; a Finder or Dock launch gives only the system folders. */
  launchPath: string | undefined;
  /** The login shell's path, or null when it could not be read. */
  loginPath: string | null;
}

/**
 * The path the installed app runs the service and its shells with: the login shell's folders first, then the launcher's, then where the harness tools install themselves.
 * So `claude`, `codex`, and `opencode` are found even when the shell could not be read.
 */
export const mergedPathOf = ({ home, launchPath, loginPath }: MergedPathInput): string => {
  const installFolders = [
    join(home, ".local", "bin"),
    join(home, ".opencode", "bin"),
    join(home, ".bun", "bin"),
    "/opt/homebrew/bin",
    "/usr/local/bin",
  ];
  const folders = [...(loginPath?.split(":") ?? []), ...(launchPath?.split(":") ?? []), ...installFolders];
  return [...new Set(folders.filter((folder) => folder !== ""))].join(":");
};
