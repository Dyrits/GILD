import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Exit, Schema } from "effect";
import type { ThreadAccess } from "../core/index.ts";
import { approvalInstructionsOf } from "./instructions.ts";
import { approvalToolName, promptToolName, toolServerName } from "./toolNames.ts";

// The command line Claude Code starts with: its fixed arguments, and those that follow the thread's access.

/** Where the adapter finds what decides a thread's access. */
export interface AccessOptions {
  /** Why the sandbox cannot run here, or null; without it every harness prompt asks (CHG-0031). */
  readonly sandboxProblem: string | null;
  /** The owner's Claude Code settings file, whose allow and deny rules apply at "Also commands and edits". */
  readonly userSettingsPath?: string;
}

// Tools behind approval (CHG-0031): built-in tools only, none of the owner's MCP
// servers, skills, or settings; every permission prompt goes to Iskios.
/** The arguments every Claude Code process starts with, the thread tools it runs without asking being those the thread's access names. */
export const baseArgsOf = (unaskedTools: ReadonlyArray<string>) => [
  "-p",
  "--input-format",
  "stream-json",
  "--output-format",
  "stream-json",
  "--verbose",
  "--include-partial-messages",
  // Echoes each user message, with its uuid, when the turn takes it in: how steering knows a
  // message was delivered (CHG-0039).
  "--replay-user-messages",
  "--tools",
  "default",
  // One thread is one Claude Code conversation; native subagents stay off, and threads open
  // threads with open_thread instead (ADR 0007).
  "--disallowedTools",
  "Agent",
  "Task",
  "--strict-mcp-config",
  "--setting-sources",
  "",
  "--disable-slash-commands",
  "--permission-prompts",
  "host",
  "--permission-prompt-tool",
  promptToolName,
  "--allowedTools",
  approvalToolName,
  ...unaskedTools,
];

const PermissionRules = Schema.Struct({
  permissions: Schema.optional(
    Schema.Struct({
      allow: Schema.optional(Schema.Array(Schema.String)),
      deny: Schema.optional(Schema.Array(Schema.String)),
    }),
  ),
});
const decodeRules = Schema.decodeUnknownExit(Schema.fromJsonString(PermissionRules));

/** The owner's own allow and deny rules from their Claude Code settings, or none when unreadable. */
const ownerRulesOf = (path: string) => {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return {};
  }
  const decoded = decodeRules(text);
  if (Exit.isFailure(decoded)) return {};
  const { allow, deny } = decoded.value.permissions ?? {};
  return { ...(allow === undefined ? {} : { allow }), ...(deny === undefined ? {} : { deny }) };
};

/** The longest timer Node allows, in milliseconds: about 24.8 days. */
export const noTimeLimit = 2147483647;

/**
 * What a sandboxed thread in a workspace may also do unasked, so it can install the project's
 * dependencies and run its checks (CHG-0034; probe of 2026-11-06 with Bun 1.4.3 and Electron 45):
 * reach the package registry and GitHub's release downloads, write Bun's and Electron's caches,
 * listen on loopback for test servers, and send Node's own downloads through the sandbox proxy.
 */
const workspaceSandbox = {
  env: { NODE_USE_ENV_PROXY: "1" },
  sandbox: {
    filesystem: { allowWrite: ["~/.bun/install/cache", "~/Library/Caches/electron", "~/.cache/electron"] },
    network: {
      allowedDomains: [
        "registry.npmjs.org",
        "github.com",
        "objects.githubusercontent.com",
        "release-assets.githubusercontent.com",
      ],
      allowLocalBinding: true,
    },
  },
};

/** Claude Code's sandbox settings: always on and unasked inside it, widened for a workspace thread. */
const sandboxSettingsOf = (access: ThreadAccess) => {
  const base = { autoAllowBashIfSandboxed: true, enabled: true };
  return access.isInWorkspace
    ? { env: workspaceSandbox.env, sandbox: { ...base, ...workspaceSandbox.sandbox } }
    : { sandbox: base };
};

/** The arguments that depend on the thread's access: its endpoint, instructions, and approval level. */
export const accessArgsOf = (access: ThreadAccess, context: string, options: AccessOptions) => {
  // A question waits with no time limit (action-approval, Waiting); without its own
  // timeout, Claude Code aborts a call silent for 300 seconds (verified 2026-11-05).
  const mcpConfig = { mcpServers: { [toolServerName]: { timeout: noTimeLimit, type: "http", url: access.mcpUrl } } };
  const isSandboxed = access.approvalLevel === "RiskyOnly" && options.sandboxProblem === null;
  const levelArgs = isSandboxed
    ? ["--permission-mode", "acceptEdits", "--settings", JSON.stringify(sandboxSettingsOf(access))]
    : [
        "--permission-mode",
        "default",
        "--settings",
        JSON.stringify({
          permissions: ownerRulesOf(options.userSettingsPath ?? join(homedir(), ".claude", "settings.json")),
        }),
      ];
  return [
    "--mcp-config",
    JSON.stringify(mcpConfig),
    "--append-system-prompt",
    // Claude Code runs without setting sources, so it reads no CLAUDE.md itself (workspaces.ts).
    `${context}\n\n${approvalInstructionsOf(access, isSandboxed, "claude")}`,
    ...levelArgs,
  ];
};
