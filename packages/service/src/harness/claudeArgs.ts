import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ApprovalLevel } from "@iskios/contracts";
import { Exit, Schema } from "effect";
import { fieldOf, type ThreadAccess, textFieldOf } from "../core/index.ts";
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
 * The hosts a sandboxed thread reaches unasked (CHG-0208): package registries, GitHub and other code hosts, release
 * downloads, and common CDNs. Claude Code 2.1.322 refuses "*" and a bare top-level wildcard such as "*.com" in
 * `allowedDomains`, so this list is a broad allowlist, not an open network. A host outside it is asked about over
 * Claude Code's stream-json control channel as a `can_use_tool` request for the tool `SandboxNetworkAccess` with
 * `input.host` (live probe of 2026-11-12), and the Claude Code adapter answers exactly that ask inside a sandboxed
 * thread (`networkHostOf`), so egress is open in practice. Either way data can leave to any reachable host, such as
 * a push to GitHub: the sandbox contains file and process damage, not data.
 */
export const allowedDomains = [
  // JavaScript and Bun
  "registry.npmjs.org",
  "*.npmjs.org",
  "registry.yarnpkg.com",
  "*.yarnpkg.com",
  "bun.sh",
  "*.bun.sh",
  "jsr.io",
  "*.jsr.io",
  "deno.land",
  "*.deno.land",
  "nodejs.org",
  "*.nodejs.org",
  // Python, Rust, Go, Ruby, Java
  "pypi.org",
  "*.pypi.org",
  "files.pythonhosted.org",
  "crates.io",
  "*.crates.io",
  "proxy.golang.org",
  "sum.golang.org",
  "index.golang.org",
  "rubygems.org",
  "*.rubygems.org",
  "repo.maven.apache.org",
  "repo1.maven.org",
  "plugins.gradle.org",
  "services.gradle.org",
  // Code hosts and their release downloads
  "github.com",
  "*.github.com",
  "*.githubusercontent.com",
  "ghcr.io",
  "*.ghcr.io",
  "gitlab.com",
  "*.gitlab.com",
  "bitbucket.org",
  "*.bitbucket.org",
  // Common CDNs and browser downloads for checks
  "cdn.jsdelivr.net",
  "*.jsdelivr.net",
  "unpkg.com",
  "esm.sh",
  "cdnjs.cloudflare.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "cdn.playwright.dev",
  "playwright.azureedge.net",
];

/**
 * What a sandboxed thread may also do unasked, so it can install the project's dependencies and run its checks
 * (CHG-0034, CHG-0208): reach the allowlisted hosts, write the package managers' and Electron's caches, listen on
 * loopback for test servers, and send Node's own downloads through the sandbox proxy.
 */
const threadSandbox = {
  env: { NODE_USE_ENV_PROXY: "1" },
  sandbox: {
    filesystem: { allowWrite: ["~/.bun/install/cache", "~/.npm", "~/Library/Caches/electron", "~/.cache/electron"] },
    network: { allowedDomains, allowLocalBinding: true },
  },
};

/**
 * Claude Code's sandbox settings: always on, commands unasked inside it, and never run unsandboxed on a warning
 * (`failIfUnavailable`, in the 2.1.322 settings schema): a sandbox that cannot start stops Claude Code instead.
 */
const sandboxSettingsOf = () => ({
  env: threadSandbox.env,
  sandbox: { autoAllowBashIfSandboxed: true, enabled: true, failIfUnavailable: true, ...threadSandbox.sandbox },
});

/** Whether Claude Code runs a thread at this level inside its enforced sandbox: the level allows it and the host can run one. */
export const isSandboxedOf = (level: ApprovalLevel, options: AccessOptions) =>
  level === "RiskyOnly" && options.sandboxProblem === null;

/**
 * The host of a `can_use_tool` control request that asks to reach a host the sandbox blocks, or null for any other
 * ask: a Bash call outside the sandbox, a file outside the workspace, an MCP tool, or a tool approval. Only the tool
 * name `SandboxNetworkAccess` with one plain host name in `input.host` counts; anything else is never answered here.
 */
export const networkHostOf = (request: unknown): string | null => {
  if (
    textFieldOf(request, "subtype") !== "can_use_tool" ||
    textFieldOf(request, "tool_name") !== "SandboxNetworkAccess"
  )
    return null;
  const host = textFieldOf(fieldOf(request, "input"), "host");
  return host !== null && /^[A-Za-z0-9.-]+(:\d{1,5})?$/.test(host) ? host : null;
};

/** The arguments that depend on the thread's access: its endpoint, instructions, and approval level. */
export const accessArgsOf = (access: ThreadAccess, context: string, options: AccessOptions) => {
  // A question waits with no time limit (action-approval, Waiting); without its own
  // timeout, Claude Code aborts a call silent for 300 seconds (verified 2026-11-05).
  const mcpConfig = { mcpServers: { [toolServerName]: { timeout: noTimeLimit, type: "http", url: access.mcpUrl } } };
  const isSandboxed = isSandboxedOf(access.approvalLevel, options);
  const levelArgs = isSandboxed
    ? ["--permission-mode", "acceptEdits", "--settings", JSON.stringify(sandboxSettingsOf())]
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
