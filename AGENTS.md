# Gild

## Documents

- `documentation/outline.md`: what the system is for, its actors and capabilities. Read before any product or design work.
- `documentation/requirements.md`: system-wide obligations. Read before any design or technical choice.
- `documentation/glossary.md`: the domain language. Read before naming anything; use its terms.
- `documentation/architecture.md`: the system's parts, flows, and how each requirement is met. Read before any technical or structural change.
- `documentation/architecture-decision-record/`: why hard-to-reverse choices were made. Read before reversing one; add a record for each new one.
- `documentation/capabilities/<capability>/specifications.md`: each capability's agreed behavior and acceptance. Read before changing that capability.
- `documentation/first-slice-design.md` and `documentation/capabilities/<capability>/blueprint.md`: proposed modules, interfaces, and staged acceptance. Read before implementing or reviewing the first slice; settle the listed review decisions before production code.
- `documentation/backlog.md`: candidate work and deferrals. Read when choosing what to do next.
- `documentation/inspirations.md`: products Gild follows, their good ideas, what was taken, and what to check on. Read before designing a capability one of them covers; add new findings with their date.
- `documentation/work-in-progress.md`: the current batch, its checks, and open questions. Read first when resuming; work proceeds in batches with the iterate skill.
- `documentation/changelog.md`: authorized agreements and verified deliveries. Append a record for each.
- `documentation/verification/`: reproducible proofs that delivered work behaves as claimed, with their scripts and screenshots. Read before re-verifying a batch or trusting its claims.
- `documentation/architecture-audit/`: architecture audit reports (HTML), one per run. Read before proposing structural refactors.
- `apps/app/AGENTS.md`: Expo-specific rules for the app. Read before changing `apps/app`.
- `documentation/conventions.md`: how code is written here (naming, absence, errors, comments, tests). Read before writing or reviewing code.
- `packages/service/node_modules/effect/AGENTS.md`: Effect's own guide for this installed version. Read completely before writing Effect code; search its `src/` for APIs it does not cover.

## Tooling

- `.agents/ai-tooling.md`: installed AI tools (CodeGraph, Context7, ast-grep, Playwright CLI), their checks, gaps, and session recovery. Read before reinstalling or measuring tooling, or when a session must be recovered.
- Commits run `.githooks/pre-commit` (Biome on staged files, then `bun run typecheck`); fix with `bun run format` and stage again.
- A Git guard (`.agents/hooks/guard-git.py`, level 2) asks before, or blocks, pushes to `main` and commands that lose local work; `.githooks/pre-push` refuses pushes to `main`. A person approves a push to `main` with `git push --no-verify`; an agent asks the user instead.

## Handoffs

To resume steps instead of update lines (CHG-0113, committed on branch `one-side-panel`; the look awaits the owner), read the [current handoff](.agents/handoffs/2026-11-10-1355-steps-instead-of-updates.md). Handoffs are shared and committed.
To resume the harness update in the Charter (CHG-0110, pushed to `main`; a real update and the owner's look remain), read the [current handoff](.agents/handoffs/2026-11-10-1330-harness-update.md). Handoffs are shared and committed.
To resume the one side panel (grouped as Companions, Knows, and Does; backup companions chosen in the panel, with a default list in the Charter; CHG-0115 committed on branch `one-side-panel`; the look awaits the owner), read the [current handoff](.agents/handoffs/2026-11-10-1400-backups-in-panel.md). Handoffs are shared and committed.
To resume deleting a Ritual from its card (CHG-0108, committed on branch `ritual-delete`; the look awaits the owner), read the [current handoff](.agents/handoffs/2026-11-10-1152-ritual-delete.md). Handoffs are shared and committed.
To resume the Guildmaster (increments A, B, and C, the link buttons beside its replies, and finished quests off the sidebar, all on `main`; a live-model check and the owner's look remain), read the [current handoff](.agents/handoffs/2026-11-10-1317-guildmaster-link-buttons-and-sidebar.md). Handoffs are shared and committed.
To resume agent replies drawn as Markdown (committed on branch `markdown-replies`; the look awaits the owner), read the [current handoff](.agents/handoffs/2026-11-10-1043-markdown-replies.md). Handoffs are shared and committed.
To resume message attachments, the large-paste freeze, and the startup failure (images on the owner's messages built and checked; the look awaits the owner), read the [current handoff](.agents/handoffs/2026-11-10-1034-message-attachments.md). Handoffs are shared and committed.
To resume the Charter (Settings, first named Workshop; renamed in CHG-0105, committed on branch `charter-rename`; the look awaits the owner), read the [current handoff](.agents/handoffs/2026-11-10-1052-charter-rename.md). Handoffs are shared and committed.
To resume Rituals as a place apart from the quests (CHG-0100, pushed to `main`; the look and a Ritual firing on a live harness await the owner), read the [current handoff](.agents/handoffs/2026-11-10-0914-rituals-place.md). Handoffs are shared and committed.
To resume thread handover (changing harness, account, and model in the middle of a quest; pushed to `main`; the look and a live handover await the owner), read the [current handoff](.agents/handoffs/2026-11-10-0800-thread-handover.md). Handoffs are shared and committed.
To resume the Quest tree menu restyle and the conversation cards (committed and pushed to `main`; the look of both awaits the owner), read the [current handoff](.agents/handoffs/2026-11-10-0736-quest-tree-menu.md). Handoffs are shared and committed.
To resume the review fixes, the lore rename, and the architecture audit (committed and pushed to `main`; the owner picks a candidate and looks at the screens), read the [current handoff](.agents/handoffs/2026-11-10-0015-review-fixes-and-lore.md). Handoffs are shared and committed.
To resume the Companion model label and the `ask_question` specification for Summons (CHG not yet written; the label is committed and pushed, the look awaits the owner), read the [current handoff](.agents/handoffs/2026-11-09-2332-companion-label.md). Handoffs are shared and committed.
To resume realms, crests, and the board redesign (pushed to `main`; its records still to write), read the [current handoff](.agents/handoffs/2026-11-09-2323-realms-and-crests.md). Handoffs are shared and committed.
To resume the thread panel and context gauge (CHG-0079; the look and the live per-call usage await the owner), read the [current handoff](.agents/handoffs/2026-11-09-2000-thread-panel.md). Handoffs are shared and committed.
To resume the quest board cards and column ribbons (committed on branch `board-cards`; the look awaits the owner), read the [current handoff](.agents/handoffs/2026-11-09-1909-board-cards.md). Handoffs are shared and committed.
To resume `@` mentions and chips merged onto the redesigned composer (committed and pushed to `main`; the look awaits the owner), read the [current handoff](.agents/handoffs/2026-11-10-0901-mentions-chips-merged.md). Handoffs are shared and committed.
To resume after the rename to Gild and the owner's logo (CHG-0072; the next launch moves the install; the look awaits the owner), read the [current handoff](.agents/handoffs/2026-11-09-0900-renamed-to-gild.md). Handoffs are shared and committed.
To resume the Guild interface layout (breadcrumbs, rail handle, quest screen, quest panel; committed on a branch, the look awaits the owner), read the [current handoff](.agents/handoffs/2026-11-09-1626-quest-layout.md). Handoffs are shared and committed.
To resume after the sidebar trim (CHG-0070 pushed; the look awaits the owner), read the [current handoff](.agents/handoffs/2026-11-08-1602-sidebar-trim.md). Handoffs are shared and committed.
To resume after the thread-opening indicators (CHG-0067 pushed; the look awaits the owner), read the [current handoff](.agents/handoffs/2026-11-08-1135-thread-opening-indicators.md). Handoffs are shared and committed.
To resume after the five Low findings (CHG-0066 uncommitted; awaiting the owner), read the [current handoff](.agents/handoffs/2026-11-08-1110-low-findings.md). Handoffs are shared and committed.
To resume after OpenCode carries on after a refusal (CHG-0065 uncommitted; awaiting the owner), read the [current handoff](.agents/handoffs/2026-11-08-0955-opencode-refusals.md). Handoffs are shared and committed.
To resume after the live probes and the Codex wrapper fix (CHG-0064 uncommitted; awaiting the owner), read the [current handoff](.agents/handoffs/2026-11-08-0945-live-probes.md). Handoffs are shared and committed.
To resume after the OpenCode edit and Always allow fixes (CHG-0064 uncommitted; awaiting the owner), read the [current handoff](.agents/handoffs/2026-11-08-0200-edits-and-pattern-kinds.md). Handoffs are shared and committed.
To resume after the approval fixes (CHG-0063 committed, not pushed; awaiting the owner), read the [current handoff](.agents/handoffs/2026-11-07-2310-approval-fixes.md). Handoffs are shared and committed.
To resume after the architecture pass (CHG-0062 committed; its behavior changes await the owner), read the [current handoff](.agents/handoffs/2026-11-07-1911-architecture-pass.md). Handoffs are shared and committed.
To resume after the cost audit (committed; the interface pass still awaits the owner's judgment), read the [current handoff](.agents/handoffs/2026-11-07-1748-cost-audit.md). Handoffs are shared and committed.
To resume after the rename to Canopy (batch 18 still awaiting the owner), read the [current handoff](.agents/handoffs/2026-11-07-1455-renamed-to-canopy.md). Handoffs are shared and committed.
