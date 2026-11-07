# AI tooling record

Set up 2026-11-05 with the setup skill. Rerun that skill to change or remove anything here.

## Tools

| Tool | Version | Scope | Wiring | Check |
| --- | --- | --- | --- | --- |
| CodeGraph | 1.6.1 | Index in `.codegraph/` (not committed); MCP server global | Claude Code, OpenCode (already wired); Codex, Gemini CLI (added) | `codegraph status` up to date (492 nodes, 1,056 edges); `codegraph explore claudeHarnessLayer` returned `packages/service/src/claude.ts:83`; Codex and Gemini each answered the same through `codegraph_explore` |
| Context7 | MCP `https://mcp.context7.com/mcp`; `npx ctx7` | Global | Claude Code, OpenCode (already wired); Codex (added, OAuth signed in), Gemini CLI (added, connected) | `npx ctx7 library effect Layer` gave `/effect-ts/effect`; `npx ctx7 docs /effect-ts/effect/effect_4.1.0 Layer.effect` returned v4 docs (the project pins effect 4.1.2) |
| ast-grep | 0.45.3 | Global | None needed | `--pattern 'export const claudeHarnessLayer = $$$'` matched `claude.ts:83`; a non-existent name matched nothing |
| Playwright CLI | 0.1.23 (`bun add -g @playwright/cli`) | Global binary; skill in `.agents/skills/playwright-cli`, linked from `.claude/skills/` and `.zcode/skills/`; config `.playwright/cli.config.json` | Skill-based, no MCP | `playwright-cli open https://example.com` then `snapshot` returned the page tree |
| GitHub CLI | signed in as Dyrits | Global | None | `gh auth status` |

Not installed: RTK (declined), Chrome DevTools MCP (no diagnosis need yet).

## Gaps

- Gemini CLI headless (`-p`) runs MCP tools only with `--allowed-mcp-server-names codegraph,context7`; without it, it delegated to a subagent that could not call them.
- Z Code: not wired (no CodeGraph or Context7 entry checked).
- Playwright output goes to `.playwright-cli/`, which is ignored because it may contain credentials.

## Measurement sources and baseline (2026-11-05)

- Claude Code transcripts: `~/.claude/projects/-Volumes-APFS-G-DRIVE-Codelab-Dyrits-OpenMission/` (JSONL per session): 2 entries, 360 KB at setup.
- Codex sessions: `~/.codex/sessions/` (JSONL), not attributed per project by path.
- Gemini CLI sessions: `gemini --list-sessions` in the repository: 3 at setup (all setup probes).
- No token monitor or output-reduction counter is installed; command-output reduction is unmeasured.
- Representative read-only task: "where is `claudeHarnessLayer` defined and who calls it". Correct answer: `packages/service/src/claude.ts:217` (it was at line 83 when the baseline was measured), callers in `packages/service/src/main.ts`, `packages/service/src/index.ts`, tested by `packages/service/test/claude.test.ts`. Codex used 16,155 tokens for it through CodeGraph; duration and output bytes were not measured.

## Session recovery

- Claude Code: `claude --continue` or `claude --resume <session-id>` in the repository.
- Codex: `codex resume --last` or `codex resume` (picker).
- Gemini CLI: `gemini --list-sessions`, then `gemini --resume latest` or `--resume <index>`.
- OpenCode: `opencode --continue` or `opencode --session <id>`.
- Each reads local transcripts, so recovery does not depend on remaining plan allowance. Only the listing commands were run; no resume was performed.
