import type { HarnessName, ModelOption } from "@iskios/contracts";

// What Iskios knows of each harness without running it (provider-accounts). The registry (harnesses.ts)
// adds how each one runs; these facts stay apart so the modules a harness's adapter needs can read them.

/**
 * Claude Code's models, each by its full identifier so the owner picks a version, newest family first. The
 * aliases (`opus`, `sonnet`) stay valid for threads that already use them but are no longer offered.
 */
export const claudeModels: ReadonlyArray<ModelOption> = [
  { id: "claude-fable-5-2", label: "Fable 5.2" },
  { id: "claude-opus-5-5", label: "Opus 5.5" },
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5" },
  { id: "claude-haiku-5-5", label: "Haiku 5.5" },
];

/** The cheapest model Iskios knows for Claude Code, where the Guildmaster, which only routes, starts. */
export const claudeCheapestModel = "claude-haiku-5-5";

/** What Iskios knows of one harness without running it. */
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
  /** The package whose `latest` tag on the npm registry is the harness's newest release. */
  readonly packageName: string;
  /** The arguments of the harness's own sign-in command. */
  readonly signInArgs: ReadonlyArray<string>;
  /** The arguments of the harness's own command that updates it, which knows how it was installed. */
  readonly updateArgs: ReadonlyArray<string>;
}

/** Each harness's facts, by name. */
export const harnessFacts = {
  claude: {
    approvedCommandAdvice: "; for a Bash command set dangerouslyDisableSandbox to true",
    configVariable: "CLAUDE_CONFIG_DIR",
    fixedModels: claudeModels,
    hasPromptTool: true,
    label: "Claude Code",
    packageName: "@anthropic-ai/claude-code",
    signInArgs: ["auth", "login"],
    updateArgs: ["update"],
  },
  codex: {
    approvedCommandAdvice: "",
    configVariable: "CODEX_HOME",
    fixedModels: null,
    hasPromptTool: false,
    label: "Codex",
    packageName: "@openai/codex",
    signInArgs: ["login"],
    updateArgs: ["update"],
  },
  opencode: {
    approvedCommandAdvice: "",
    // OpenCode keeps its sign-ins and sessions under its data folder (`$XDG_DATA_HOME/opencode`).
    configVariable: "XDG_DATA_HOME",
    fixedModels: null,
    hasPromptTool: false,
    label: "OpenCode",
    packageName: "opencode-ai",
    signInArgs: ["auth", "login"],
    updateArgs: ["upgrade"],
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

/** The label of a harness's own sign-in on this computer, outside Iskios. */
export const ownAccountLabel = "This computer";
