import { spawn } from "node:child_process";
import { chmod, writeFile } from "node:fs/promises";

/**
 * Replaces the installed app once the running one has quit, and puts the old one back if any step fails. It takes
 * its paths as arguments, never inside the text, so no path can change what the script does.
 * Arguments: process id to wait for, installed app, new app, a place to keep the old app, a failure log, an opener.
 */
export const swapScript = `#!/bin/sh
pid="$1"; bundle="$2"; staged="$3"; backup="$4"; log="$5"; opener="$6"
waited=0
while kill -0 "$pid" 2>/dev/null; do
  waited=$((waited + 1))
  if [ "$waited" -gt 300 ]; then
    echo "Iskios did not quit in time to be replaced." > "$log"
    "$opener" "$bundle"
    exit 1
  fi
  sleep 0.2
done
rm -rf "$backup"
if ! mv "$bundle" "$backup"; then
  echo "The installed app could not be moved aside." > "$log"
  "$opener" "$bundle"
  exit 1
fi
if ! mv "$staged" "$bundle"; then
  mv "$backup" "$bundle"
  echo "The new app could not be put in place; the installed version was kept." > "$log"
  "$opener" "$bundle"
  exit 1
fi
xattr -dr com.apple.quarantine "$bundle" 2>/dev/null
rm -rf "$backup"
"$opener" "$bundle"
`;

/** What the swap script needs to know. */
export type SwapPlan = {
  readonly backup: string;
  readonly bundle: string;
  readonly logFile: string;
  readonly opener: string;
  readonly pid: number;
  readonly scriptFile: string;
  readonly staged: string;
};

/** Writes the swap script and starts it detached, so it outlives the app that started it. */
export const startSwap = async (plan: SwapPlan): Promise<void> => {
  await writeFile(plan.scriptFile, swapScript);
  await chmod(plan.scriptFile, 0o700);
  const child = spawn(
    "/bin/sh",
    [plan.scriptFile, String(plan.pid), plan.bundle, plan.staged, plan.backup, plan.logFile, plan.opener],
    { detached: true, stdio: "ignore" },
  );
  child.unref();
};
