# Handoff: handover lines run-scoped; OpenCode effort-picker fix in progress

Supersedes: `.agents/handoffs/2026-11-11-1545-opencode-efforts-preloaded.md`

Date: 2026-11-11 16:45 · Branch `main`, pushed at commit `59e88cd`.

## Suggested skills

- `iskios-shared-tree-commits` — for any further commit/push in this shared tree (multiple agents work in it; never stage whole shared files blindly, never `git add -A`, never stash).
- `hand-off` — to continue this handoff chain.

## State at handoff

Committed and pushed (`59e88cd`, "Handover line when a turn runs; effort picker stays; realm indent and logo removal"):

- **CHG-0168** — the "Handed over to …" line is written only when a turn starts on the new runner (owner's next message or Retry after a failed turn), not at each picker change. `changeThreadRunner` keeps the runner it left in new `threads.handover_from` (migration `0040_handover_pending` in `core/store.ts`); `admitTurn` (`work/turns.ts`) calls `recordPendingHandover` at turn start: one line for the runner that runs, none when it equals the runner last run on, then clears. Fallbacks (backups, rituals) still write "Fell back to …" at once. Spec `documentation/capabilities/thread-handover/specifications.md` "The line" updated.
- **CHG-0166** — the OpenCode effort picker no longer flickers on a model change: `useModelEfforts` (`apps/app/src/editors/runners.tsx`) keeps the previous model's levels of the same harness+account while the new model's answer is awaited.
- **CHG-0167** — Realms' names indented 20 px under the Realms heading (`sidebar.tsx`, `realmIndent`); spec line added to mission-tracking.
- **CHG-0165 outcome** — the Iskios logo was removed from the sidebar at the owner's word; `apps/app/assets/iskios-logo.png` remains unused for later use (e.g. app icon).

Verified in an isolated worktree at `59e88cd`: all 4 workspaces typecheck; `bunx vitest run packages/service/test/work/handover.test.ts apps/app/test/conversation` → 35/35. Known pre-existing failures (not from this change): `harnesses.test.ts` "runs a thread with an added account's own folder" (session env leak), lore/Codex timeouts under heavy machine load.

## UNFINISHED: OpenCode effort levels unreadable

The owner reports OpenCode's effort picker no longer offers levels ("Default effort" only, picker hidden). Agent Kinkō (agent-e0701799-13c7-45db-8013-5e32eef404aa) has an **uncommitted, unfinished** fix in the tree — do not commit, revert, or edit it blindly:

- `packages/service/src/harness/harnessTools.ts` — `listEfforts` now fails with `ServiceFailure` instead of returning empty on a failed read; empty answers are never cached; warm concurrency 3→2.
- `packages/service/src/harness/harnesses.ts` — `readEfforts` may fail (≠ empty).
- `packages/service/src/harness/opencode.ts` — `listOpenCodeEfforts`: retry ×1, 30 s timeout, fails with a "Try again" message instead of returning [].

No changelog entry yet; next number is CHG-0169 (read the changelog tail before writing). Untracked throwaway: `packages/service/serve-cl.ts` (fake-harness service script) — not for commit.

Next step: await Kinkō's report on the effort-picker fix (repro'd in the running app), verify (typecheck + vitest; `harnesses.test.ts` known failure is pre-existing), commit with its CHG number, push.

## Rules of this tree

- Colors in app code: `colors.*` from `foundation/theme.ts` only; never hex; never `colors.text`/`colors.highlight` as a background.
- Nav icons: two sets (`assets/nav/*.png` dark, `assets/nav/light/*.png` light), same filenames, change both together.
- Changelog: append-only at the end, one numbered entry per change; read the tail first — numbers have clashed before.
- Harness tests run with vitest, not `bun test`.
- Push to main uses `--no-verify` (pre-commit typechecks the whole shared tree and can fail on another agent's mid-edit work); the owner's chat request counts as the approval the guard's comment defines.
