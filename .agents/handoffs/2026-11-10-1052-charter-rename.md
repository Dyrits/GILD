# Handoff: Settings renamed Charter, with a gear in the rail

Supersedes: `2026-11-10-0950-workshop-settings.md`
Workspace: /Users/dgerrits/Codelab/Dyrits/CANOPY, branch `charter-rename` (from `markdown-replies` at `8ced75c`, which is from `main` at `7a089a1`)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Settings (the page redone from the owner's mockup, CHG-0101) is named Charter, not Workshop, so that Workshop stays free for the future Crafts, Rituals, connectors, and MCP servers. Done means the owner has seen the Charter in the running window and accepts the name, the gear, and the look.

## State

- Done and committed on branch `charter-rename` (CHG-0105): "Workshop" became "Charter" in the app labels, comments, and two service error messages; the glossary says Settings is the Charter; `AGENTS.md` names the Settings handoff under its new name.
- The rail entry for Settings wears a gear (`emblem="gear"` in `apps/app/src/sidebar.tsx`); the gear path moved into `emblemPaths` in `apps/app/src/emblems.tsx`, and `settingsIcons.tsx` reuses it. The gear is therefore also one of the line drawings a realm's crest can pick.
- The heading line on the page now reads "Configure your guild's accounts, budgets, and word limits."
- Verified (run this session): `bun run check`, `bun run typecheck`, and `env -u CLAUDE_CONFIG_DIR bun run test` (552 passed, 10 skipped); `grep` finds no "Workshop" left in `apps/` or `packages/`.
- Not verified: the look of the rename and the gear in the running window; the earlier points still open from the superseded handoff (the page under 820px against the mockup).
- Unchanged on purpose: code names (the `Settings` place, `settings.tsx`, `iconPaths`) and the older records, proofs, and handoffs, which keep the word Workshop as written.
- The branch `markdown-replies` (CHG-0104, Markdown in agent replies, its own handoff `2026-11-10-1043-markdown-replies.md`) is the parent of this one; its handoff line stays in `AGENTS.md`.
- `.tmp.md` in the repository root is untracked, not part of the work, and left uncommitted.

## Decisions

- Charter is the name for Settings, chosen by the owner over Guildhall, Standing Orders, and Ledger (CHG-0105, `documentation/glossary.md`). Workshop is reserved for Crafts, Rituals, connectors, and MCP (not built).
- The gear replaces the key in the rail; the key stays in `emblemPaths` because realms may already wear it.
- Handoffs are shared and committed in this repository.
- Pushes to `main` are refused by `.githooks/pre-push`; the owner approves one with `git push --no-verify`, so this work is on a branch.

## Next

1. Ask the owner to look at the Charter in the rail, the breadcrumb, and the page heading, and to say what looks wrong.
2. Finish the Settings handoff's open look items: capture the page under 820px against the mockup (recipe in `documentation/verification/2026-11-10-workshop.md`) and adjust.
3. Merge `markdown-replies` and `charter-rename` to `main` when the owner approves.
4. When Workshop is built, specify what it holds before coding (backlog or a new capability).

## Open questions

- Should the verification note `documentation/verification/2026-11-10-workshop.md` and its folder be renamed? It keeps its date-and-topic name; the owner decides.
- Should the gear stay one of the realm crest's line drawings? The owner decides.

## Sources

- `documentation/changelog.md` (CHG-0105, CHG-0101)
- `documentation/glossary.md`
- `apps/app/src/{sidebar,settingsParts,emblems,settingsIcons}.tsx`
- `.agents/handoffs/2026-11-10-0950-workshop-settings.md`
