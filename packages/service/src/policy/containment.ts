import type { ApprovalLevel } from "@iskios/contracts";
import { Effect } from "effect";
import { type Containment, isInsideFolder } from "../core/index.ts";
import { type Capability, capabilities, changedFilesOf, isFileWriting } from "./patterns.ts";

/**
 * What is known about one harness action when Containment judges it: the adapter reports whether its harness runs
 * inside an enforced sandbox at the thread's level, and whether this action leaves it; the store reports the folder
 * a file change must lie in. Nothing here is a verdict.
 */
export interface ActionFacts {
  /** Whether the harness's tools run inside an enforced sandbox at the thread's approval level. */
  readonly containment: Containment;
  /** The folder a file change must lie in to count as the thread's own, or null when none counts. */
  readonly editFolder: string | null;
  readonly input: unknown;
  /** Whether the action leaves its active sandbox (Claude Code's `dangerouslyDisableSandbox`, a Codex escalation). */
  readonly isEscape: boolean;
  /** Whether the adapter runs this thread without the sandbox it otherwise runs in. */
  readonly isUnsandboxed: boolean;
  readonly toolName: string;
}

/**
 * What a harness action needs beyond its sandbox, or null when it is contained (CHG-0208): the one place that
 * decides it, from level, sandbox, action, and folder. A file change inside the thread's folder is contained by its
 * exact path; any other change by the harness's own tool is not. For any other action, a harness with no enforced
 * sandbox needs the owner for everything, and inside one, only leaving it or widening it does.
 */
export const needsOf = (facts: ActionFacts) =>
  Effect.gen(function* () {
    if (isFileWriting(facts.toolName)) {
      const files = changedFilesOf(facts.input);
      // Unsandboxed for a folder that points outside its workspace, the thread's folder itself is outside it.
      if (facts.isEscape || facts.isUnsandboxed || files.length === 0 || facts.editFolder === null)
        return capabilities.fileOutsideWorkspace;
      for (const file of files)
        if (!(yield* isInsideFolder(facts.editFolder, file))) return capabilities.fileOutsideWorkspace;
      return null;
    }
    if (facts.containment === "Unprotected" || facts.isUnsandboxed) return capabilities.unsandboxed;
    if (facts.toolName === "Permissions") return capabilities.widenSandbox;
    return facts.isEscape ? capabilities.outsideSandbox : null;
  });

/** Whether an action runs without asking: only at the default level, and only when nothing beyond the sandbox is needed. */
export const isUnaskedAt = (level: ApprovalLevel, need: Capability | null) => level === "RiskyOnly" && need === null;
