import type { HarnessName, ModelOption } from "@canopy/contracts";

// What Canopy knows of each harness without running it (provider-accounts). The registry (harnesses.ts)
// adds how each one runs; these facts stay apart so the modules a harness's adapter needs can read them.

/** The harness's own default model, first in every list. */
export const defaultModel: ModelOption = { id: "default", label: "Default model" };

/** Claude Code's model aliases, which follow each family's latest model. */
export const claudeModels: ReadonlyArray<ModelOption> = [
  defaultModel,
  { id: "fable", label: "Fable" },
  { id: "opus", label: "Opus" },
  { id: "sonnet", label: "Sonnet" },
  { id: "haiku", label: "Haiku" },
];

/** What Canopy knows of one harness without running it. */
export interface HarnessFacts {
  /** What a command approved through `request_approval` needs on this harness, appended to that rule. */
  readonly approvedCommandAdvice: string;
  /** Where the harness keeps its sign-in and sessions, set to an account's own folder for an added account. */
  readonly configVariable: string;
  /** The harness's own fixed list of models, or null when its tool lists them. */
  readonly fixedModels: ReadonlyArray<ModelOption> | null;
  /** Whether the harness asks its permission prompts through the `answer_prompt` thread tool (ADR 0005). */
  readonly hasPromptTool: boolean;
  /** The harness's name as the owner reads it. */
  readonly label: string;
  /** The arguments of the harness's own sign-in command. */
  readonly signInArgs: ReadonlyArray<string>;
}

/** Each harness's facts, by name. */
export const harnessFacts = {
  claude: {
    approvedCommandAdvice: "; for a Bash command set dangerouslyDisableSandbox to true",
    configVariable: "CLAUDE_CONFIG_DIR",
    fixedModels: claudeModels,
    hasPromptTool: true,
    label: "Claude Code",
    signInArgs: ["auth", "login"],
  },
  codex: {
    approvedCommandAdvice: "",
    configVariable: "CODEX_HOME",
    fixedModels: null,
    hasPromptTool: false,
    label: "Codex",
    signInArgs: ["login"],
  },
  opencode: {
    approvedCommandAdvice: "",
    // OpenCode keeps its sign-ins and sessions under its data folder (`$XDG_DATA_HOME/opencode`).
    configVariable: "XDG_DATA_HOME",
    fixedModels: null,
    hasPromptTool: false,
    label: "OpenCode",
    signInArgs: ["auth", "login"],
  },
} as const satisfies Record<HarnessName, HarnessFacts>;

/** Each harness's name as the owner reads it. */
export const harnessLabels = {
  claude: harnessFacts.claude.label,
  codex: harnessFacts.codex.label,
  opencode: harnessFacts.opencode.label,
} as const satisfies Record<HarnessName, string>;

/** Every harness, in the order pickers list them. */
export const harnessNames: ReadonlyArray<HarnessName> = ["claude", "codex", "opencode"];

/** The environment that points a harness at an account's folder; empty for the computer's own sign-in. */
export const accountEnvironmentOf = (harness: HarnessName, configDirectory: string | null): Record<string, string> =>
  configDirectory === null ? {} : { [harnessFacts[harness].configVariable]: configDirectory };

/** The label of a harness's own sign-in on this computer, outside Canopy. */
export const ownAccountLabel = "This computer";
