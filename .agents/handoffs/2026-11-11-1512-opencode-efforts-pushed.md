# Handoff: OpenCode effort levels delivered and pushed

Supersedes: [.agents/handoffs/2026-11-11-1500-handover-pickers-efforts.md](2026-11-11-1500-handover-pickers-efforts.md)
Workspace: ISKIOS, branch `main`, pushed as commit `131c583`

To resume: read this whole file first. Treat every claim not marked verified as unverified, and check it against the Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

OpenCode threads can choose an effort level, per model, via a new `ListModelEfforts` request. Delivered and pushed; the remaining step is owner acceptance in the running app.

## State

- Verified: commit `131c583` "OpenCode effort levels (CHG-0158): per-model effort choices via ListModelEfforts" is on `origin/main` (pushed with `--no-verify`; the pre-push guard protects `main` and its comment names `--no-verify` as the person's deliberate approval — the owner asked for the push in chat).
- Verified by typecheck of the exact staged tree: all four workspaces (`desktop`, `@iskios/contracts`, `app`, `@iskios/service`) pass.
- Verified by vitest: `packages/service/test/harness/harnesses.test.ts` 43/43 pass. Note: that file is a vitest file (`import ... from "vitest"`); `bun test` on it fails at import — run it with `../../node_modules/.bin/vitest run` from `packages/service`.
- Verified earlier, from the superseded handoff: read against OpenCode 2.2.0 on this computer — `opencode-go/claude-haiku-5-5` offers none to max, `opencode-go/deepseek-v4-pro` offers high and max.
- Not driven in the running app (carried over from the superseded handoff): pickers' placement and effort lists per provider, and that changing a failed quest's runner runs nothing until Retry or a message.

## Decisions

- The commit contains only this session's work. A teammate agent (Kinkō) was working in the same tree on light mode and sidebar light icons (CHG-0159, CHG-0160) — those files (`theme.ts`, `colorScheme*`, `App.tsx`, `settings.tsx`, `dashboard.tsx`, `rituals.tsx` text-shadow line, `styles.ts` `cardCornerButton` line, `navIcons.tsx`, `assets/nav/light/`) are intentionally NOT in this commit and were left uncommitted in the working tree at push time. Changelog numbering clashed and was fixed: light mode = CHG-0159, sidebar light icons = CHG-0160; this work keeps CHG-0158; next free number CHG-0161.
- Effort naming: `EffortChoice` is the provider's own level name (bounded string), since OpenCode's levels include `none`. See CHG-0158 in `documentation/changelog.md` for the full record; do not duplicate it here.

## Next

1. Drive the app with the owner: effort picker per OpenCode model (asks `ListModelEfforts` on pick), placement of the runner pickers under the message box, and the Retry-not-start behavior from the superseded handoff; obtain owner acceptance.
2. Standing repo rule from the teammate's work: use `colors.*` from `foundation/theme.ts`, never a hex, and never `colors.text`/`colors.highlight` as a background (they turn dark in light mode). Any new nav icon needs a light twin in `assets/nav/light/`.

## Suggested skills

- `hand-off` — to write the next handoff at a phase boundary (Skill tool).
- `test-first` — if more request/service behavior is added (Skill tool).
- `verify` — to prove app behavior before asking for acceptance (Skill tool).

## Sources

- `documentation/changelog.md` (CHG-0157, CHG-0158), `documentation/capabilities/thread-handover/specifications.md`
- `packages/contracts/src/harnesses.ts`, `packages/contracts/src/requests.ts`
- `packages/service/src/harness/` (`harnessTools.ts`, `harnesses.ts`, `opencode.ts`), `packages/service/src/service.ts`, `packages/service/src/work/accounts.ts`
- `apps/app/src/editors/runners.tsx`, `apps/app/src/conversation/` (`conversation.tsx`, `guildmaster.tsx`, `suggestions.tsx`, `threadTree.tsx`)
- `packages/service/test/harness/harnesses.test.ts`, `packages/service/test/fixtures/stand-in-opencode.mjs`
- Superseded handoff: `.agents/handoffs/2026-11-11-1500-handover-pickers-efforts.md`
