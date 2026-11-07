# Handoff: renamed to Canopy

Supersedes: `2026-11-07-1230-harnesses-and-accounts.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission (folder name unchanged), branch `harnesses-and-accounts`, remote `git@github.com:Dyrits/CANOPY.git`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner asked: "Operate the rebranding overall in Canopy." Done means the product, code, living documents, and GitHub repository carry the name Canopy, and the owner's existing data carries over. It is done; batch 18's open items from the superseded handoff remain.

## State

- Verified by command output: `bun run test` passed 335 with 8 skipped; `bun run typecheck`, `bun run check`, `git diff --check`, `bun install --frozen-lockfile`, and the desktop build (`apps/desktop`, `bun run build`) passed.
- Verified: the GitHub repository is `Dyrits/CANOPY` (was `Dyrits/OPEN-MISSION`, renamed with the owner's own `gh` sign-in, `GH_CONFIG_DIR=$HOME/.config/gh`; OpenBot's GitHub app token got HTTP 403); `origin` points to it and `git ls-remote` answers.
- Verified: the owner's data moved with `moveFormerData` (`apps/desktop/src/formerData.ts`) from `~/Library/Application Support/OpenMission` to `~/Library/Application Support/Canopy`; `canopy.sqlite` has 5 threads and passes `PRAGMA integrity_check`; 4 folders in `~/.claude/projects` were renamed from `…-OpenMission-missions-…` to `…-Canopy-missions-…`; the built service started on it for 6 seconds without error.
- Not verified: the app driven in the window after the rename, and a scratch thread resuming its Claude Code session.
- The rename and this handoff are committed and pushed to `origin/harnesses-and-accounts` in the commit that adds this file; check with `git log origin/harnesses-and-accounts -1`. `.zcode/` stays untracked.
- Assumed: an Expo dev server another session started on port 8082 may need a restart to pick up the renamed packages.

## Decisions

- Canopy is the brand only; the domain terms stay (mission, thread, Control, journal, briefing, dashboard, intel). No tree vocabulary (leaf, branch, trunk): it clashes with git and with tree semantics. Owner, this conversation; recorded in CHG-0059.
- Intel stays, for now ("Let's keep Intel for now."); a later rename was discussed as Knowledge, but knowledge has no plural and intel is countable in code and storage.
- Dated records (handoffs, verification, earlier changelog records, ADRs, audits) keep the name they were written with; their `OPENMISSION_*` commands need `CANOPY_*` when rerun.
- Words meaning "open a mission" keep their names: `open_mission`, `reopenMission`, the `openMission` UI state.
- The repository follows the owner's uppercase naming (`CANOPY`). The local folder is still `OpenMission`; renaming it would break open sessions and tool indexes.

## Next

1. Run `bun run dev` and check the window title, sidebar, and that the five existing threads appear; send one message in a thread with no workspace to check its Claude Code session resumes.
2. Then the Next list of the superseded handoff (batch 18's provisional choices, signing in an added Claude account, using Canopy on its own repository).

## Open questions

- Should the local folder be renamed to `Canopy`? The owner decides; tool state keyed by path (`.codegraph`, `~/.claude/projects`) would follow.
- Should Intel later become Knowledge, and what is one item called then? The owner decides.

## Sources

- `documentation/changelog.md` (CHG-0059)
- `apps/desktop/src/formerData.ts`, `apps/desktop/src/main.ts`, `apps/desktop/test/formerData.test.ts`
- `documentation/glossary.md`; `README.md`; `AGENTS.md`
- https://github.com/Dyrits/CANOPY
