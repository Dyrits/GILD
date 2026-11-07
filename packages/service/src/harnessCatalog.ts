import type { HarnessName, ModelOption } from "@openmission/contracts";

// What OpenMission knows of each harness without running it (provider-accounts).

/** Each harness's name as the owner reads it. */
export const harnessLabels = {
  claude: "Claude Code",
  codex: "Codex",
  opencode: "OpenCode",
} as const satisfies Record<HarnessName, string>;

/** Every harness, in the order pickers list them. */
export const harnessNames: ReadonlyArray<HarnessName> = ["claude", "codex", "opencode"];

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

/** Where each harness keeps its sign-in and sessions, set to an account's own folder for an added account. */
export const configVariables = {
  claude: "CLAUDE_CONFIG_DIR",
  codex: "CODEX_HOME",
  // OpenCode keeps its sign-ins and sessions under its data folder (`$XDG_DATA_HOME/opencode`).
  opencode: "XDG_DATA_HOME",
} as const satisfies Record<HarnessName, string>;

/** The environment that points a harness at an account's folder; empty for the computer's own sign-in. */
export const accountEnvironmentOf = (harness: HarnessName, configDirectory: string | null): Record<string, string> =>
  configDirectory === null ? {} : { [configVariables[harness]]: configDirectory };

/** The label of a harness's own sign-in on this computer, outside OpenMission. */
export const ownAccountLabel = "This computer";
