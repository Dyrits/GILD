# Work in progress

## Goal

Build the first slice iteratively (CHG-0025): each batch leaves a runnable application with its checks. Design under review: [first-slice-design.md](first-slice-design.md) and the mission-tracking, thread-tree, and thread-messaging blueprints. Starting revision: `e445b44`.

## Batch 1: thin end-to-end with the fake harness

Status: implemented and checked; awaiting the user's run-through.

Evidence (2026-11-05, committed on `main` after `e445b44` as a first draft):

- `bun run test`: 11 Vitest checks pass on Electron's Node 24.22.2 (`packages/service/test`): start saves mission, top thread and message with the first-line title; echo reply then Idle; blank text refused with nothing saved; repeated request identifier returns the original outcome; follow-ups keep order and run after the current turn; Idle thread wakes; unknown thread refused; data survives reopening the database; WebSocket refuses a missing or wrong token, answers requests, announces changes, and answers an invalid frame with InvalidInput.
- `bun run typecheck` and `bun run check` pass; `expo export --platform web` bundles.
- Driven through the Electron window over the DevTools protocol with a throwaway data folder: started a two-line mission, saw the echo, sent a follow-up and saw Running then its echo, returned to the dashboard showing Idle. After quitting and relaunching Electron, the mission and conversation were still there; the service process ended with Electron. A tokenless connection to the live service was refused. `bun run dev` starts Metro and Electron and stops both together.
- Not checked directly: rollback when a statement fails midway through starting a mission (the three inserts share one transaction).

Provisional behavior pending decisions: on startup, threads left Running become Idle and their interrupted turn is not replayed. The desktop app loads the Metro dev server only; a packaged build is not part of this batch.

Behavior:

- `bun run dev` opens Electron, which starts the service in a utilityProcess and loads the Expo web app.
- The dashboard lists missions with title, state, and last activity, and has a box that starts a mission with one message. The title is the message's first line.
- Starting commits the mission, its top thread, and the message in one SQLite transaction. The fake harness answers with an echo after a short delay; the thread shows Running, then Idle.
- Opening a mission shows the top thread's conversation; follow-up messages are answered the same way.
- Data survives a restart. The WebSocket accepts only the per-launch owner token.

Checks (Vitest on Node 24): atomic start, message order, persistence across reopening the database, request-identifier retry returning the original outcome, refusal without the owner token, contract decoding. Then one manual run-through by the user.

Excluded: child threads, Stop and Resume, Claude Code, agent-proposed titles, chatter guard, crash recovery.

## Open questions, settled when a batch needs them

- Dependency gates and fake-first live launch (first-slice-design, Dependency gates).
- Recovery of turns interrupted by a crash or restart, and uncertain delivery.
- What resets the chatter count.
- Idle as the mission state when no thread is urgent, including all Done or Stopped.
- Claude Code protocol verification; installed version 2.1.302.
