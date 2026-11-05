import { execFileSync } from "node:child_process";
import { Effect } from "effect";

const hasCommand = (name: string) => {
  try {
    execFileSync("which", [name], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

/**
 * Why Claude Code's sandbox cannot run here, or null when it can. Without it, the
 * default level asks for every harness prompt (CHG-0031).
 */
export const sandboxProblem = Effect.sync((): string | null => {
  if (process.platform === "darwin") return null;
  if (process.platform === "linux") {
    const missing = ["bwrap", "socat"].filter((name) => !hasCommand(name));
    return missing.length === 0
      ? null
      : `Sandbox unavailable: install ${missing.map((name) => (name === "bwrap" ? "bubblewrap" : name)).join(" and ")}.`;
  }
  return "Sandbox unavailable on this system (Claude Code sandboxes only on macOS, Linux, and WSL2).";
});
