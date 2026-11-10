/** The server name Claude Code prefixes to tool names (`mcp__gild__…`). */
export const toolServerName = "gild";
/** The tool name Claude Code's `--permission-prompt-tool` takes. */
export const promptToolName = `mcp__${toolServerName}__answer_prompt`;
/** The approval tool's name as Claude Code lists it. */
export const approvalToolName = `mcp__${toolServerName}__request_approval`;
