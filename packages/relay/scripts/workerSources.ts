import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageFolder = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The files the Worker bundle is built from: a change to any of them makes the committed bundle stale. */
export const workerSourceFiles = [
  "src/base64url.ts",
  "src/roomCore.ts",
  "src/route.ts",
  "src/worker.ts",
  "wrangler.jsonc",
] as const;

/** A fingerprint of the files the Worker bundle is built from; the bundle records the one it was built from. */
export const workerSourceHash = (): string => {
  const hash = createHash("sha256");
  for (const file of workerSourceFiles)
    hash
      .update(file)
      .update("\0")
      .update(readFileSync(join(packageFolder, file)))
      .update("\0");
  return hash.digest("hex");
};
