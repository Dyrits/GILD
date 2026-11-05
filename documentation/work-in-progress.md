# Work in progress

## Goal

Build the first slice iteratively (CHG-0025): each batch leaves a runnable application with its checks. Design under review: [first-slice-design.md](first-slice-design.md) and the mission-tracking, thread-tree, and thread-messaging blueprints. Starting revision: `e445b44`.

## Batch 1: delivered

Delivered in CHG-0026 (commit 649e232). Provisional behavior still in place until decided: on startup, threads left Running become Idle and interrupted turns are not replayed; the desktop app loads only the Metro dev server; rollback of a failed mission start is not directly tested.

## Batch 2: Claude Code chat without tools

Status: implemented and checked; awaiting the user's run-through.

Evidence (2026-11-05, committed on `main` as a draft after `649e232`):

- `bun run test`: 19 checks pass on Electron's Node 24.22.2, including 8 for the Claude Code adapter against `packages/service/test/fixtures/stand-in-claude.mjs` (chat-only flags with model and effort, defaults omitted, no `OPENMISSION_` variables in the child, one process across turns, usage totals, resume after idle close, failure and retry, reported errors not saved as replies, drafts only while the setting is on) and settings persistence.
- `OPENMISSION_LIVE_CLAUDE=1 bun run test`: the live check passed against the installed Claude Code 2.1.302 with Haiku.
- `bun run typecheck` and `bun run check` pass.
- Driven through the Electron window with real Claude Code and a throwaway data folder: picked Haiku and low effort; the reply streamed in a "writing…" bubble, then was saved, with the thread Running then Idle and token usage shown; a follow-up kept the conversation's context; Settings turned streaming off, after which no draft appeared; the dashboard showed token totals. Quitting Electron left no Claude Code process; after relaunching, a follow-up resumed the stored session (`--resume`) with its context. The live Claude Code process's environment had PATH and HOME but no `OPENMISSION_` variable.
- Not checked live: a missing `claude` executable (covered by the stand-in failure checks only).

Behavior:

- The start box has Model (Claude Code default, Fable, Opus, Sonnet, Haiku) and Effort (default, low, medium, high, xhigh, max) selectors, prefilled from saved defaults. The thread keeps its choice.
- A Settings screen holds the default model and effort and "Show replies as they're written" (on by default).
- Each thread runs one `claude -p` stream-json process in its mission's scratch folder, with no tools, permission prompts denied, and no MCP servers, skills, or user and project settings. OpenMission's own variables, including the owner token, are not passed to it.
- Each assistant message is saved and shown when it arrives; with the setting on, the reply in progress shows word by word without being saved. The thread is Running until the turn's result, then Idle. Messages sent during a turn wait for the next turn.
- Token usage (input, output, cache) adds up per mission on the dashboard and in the conversation, never in dollars.
- An idle process closes after 10 minutes; the next message, or the first after a restart, resumes the stored session.
- If Claude Code is missing or fails, the thread shows Failed with the reason; the next message retries, together with the messages of the failed turn.
- The fake harness remains for checks; `OPENMISSION_HARNESS=fake` selects it. `OPENMISSION_CLAUDE_PATH` overrides the `claude` executable.

Checks: adapter tests against a scripted stand-in `claude` (flags, model and effort, one process per thread, resume after idle close, failure and retry, drafts on and off, usage totals), settings persistence, one opt-in live test with `OPENMISSION_LIVE_CLAUDE=1`, and the user's run-through.

Excluded: tools and approvals (batch 3), steering a running turn, thread tools, child threads.

## Open questions, settled when a batch needs them

- Dependency gates and fake-first live launch (first-slice-design, Dependency gates).
- Recovery of turns interrupted by a crash or restart, and uncertain delivery.
- What resets the chatter count.
- Idle as the mission state when no thread is urgent, including all Done or Stopped.
- Claude Code protocol verification; installed version 2.1.302.
