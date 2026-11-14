import type { HarnessInfo } from "@iskios/contracts";

/** A harness-reported version reduced to its number, retaining unknown reports and absence. */
export const versionOf = (harness: Pick<HarnessInfo, "version">) =>
  harness.version?.match(/\bv?\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?/)?.[0] ?? harness.version;
