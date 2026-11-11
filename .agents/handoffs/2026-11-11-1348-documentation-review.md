# Handoff: sidebar documentation review

Supersedes: none (forked from `2026-11-11-1330-panel-handles.md`)
Workspace: `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`, branch `main`.

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Keep the sidebar documentation aligned with the recent handoffs and commits, while preserving pending owner acceptance and open decisions.

## State

- Verified by file reads and diff: `documentation/work-in-progress.md` and `documentation/capabilities/mission-tracking/specifications.md` now describe direct creation, quest lists, panel changes, and their remaining checks. The starting commit was `931aed5`; check Git for the commit and push containing this handoff.
- Verified: independent standards and specifications reviews found premature Delivery records, incomplete acceptance checks, and stale width wording. The Delivery records were removed; the acceptance and width wording were corrected. Both reviewers verified their findings resolved; no new regressions were reported.
- Verified: `git diff --check` passed for the documentation changes. Application tests and desktop interaction were not rerun in this documentation session; earlier results and their limits are in work in progress and the linked evidence.

## Decisions

- Keep the sidebar batches in work in progress until the owner's required appearance acceptance; do not record a completed Delivery while that acceptance is pending. The previous handoffs' instructions to add changelog deliveries remain pending on that acceptance.
- Preserve unresolved choices rather than treating current estimates as final. The Realmless cap and the 236 px minimum are explicitly qualified in the specification.

## Next

1. Check Git status and the commit and remote state, then read the linked handoffs and work in progress for the current acceptance and open decisions.
2. When the owner wants to review the app, rebuild the desktop bundle and verify the outstanding interactions and appearance; record a delivery only after the agreed checks and required acceptance.

## Open questions

- The owner decides the sword icon, Realmless cap, list sorting and refresh, and Free Realm and Realmless panel content; see work in progress and the earlier handoffs.
- The desktop appearance, realm panel lore link and rename remain unverified in the running app.

## Sources

- `documentation/work-in-progress.md` and `documentation/capabilities/mission-tracking/specifications.md`.
- `.agents/handoffs/2026-11-11-1330-panel-handles.md` and `.agents/handoffs/2026-11-11-1310-quest-list-page-pushed.md`.
- `documentation/verification/2026-11-11-sidebar-follow-ups.md` and `documentation/verification/2026-11-11-panel-handles.md`.
- Commits `f21e768`, `4e5e107`, and `931aed5`.
