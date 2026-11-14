import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Runs Git in a fixture repository with a fixed test identity, without changing the owner's Git settings. */
export const runGit = (folder: string, ...args: string[]) =>
  execFileSync("git", ["-C", folder, "-c", "user.name=Test", "-c", "user.email=test@example.com", ...args], {
    stdio: "ignore",
  });

/** Creates a real main-branch repository with one commit beneath a caller-owned temporary directory. */
export const createRepository = (base: string, name: string) => {
  const folder = join(base, name);
  mkdirSync(folder);
  runGit(folder, "init", "-q", "-b", "main");
  writeFileSync(join(folder, "a.txt"), "a");
  runGit(folder, "add", ".");
  runGit(folder, "commit", "-q", "-m", "first");
  return folder;
};
