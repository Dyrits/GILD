# Handoff: Folder picker on a host (device pairing, batch 3a)

Supersedes: none
Workspace: ISKIOS repository, branch `main`, Delta worktree `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS/.delta/worktrees/wst80r26t38y/ISKIOS`; starting commit `ae217e4`, nothing committed yet

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Land batch 3a of device pairing, the folder picker, which is built and uncommitted: commit it, push it to `main`, and sync the original checkout's `main` to it. Done means `origin/main` holds the work and the original checkout's `main` is at the same commit.

## State

- Verified now: the working tree holds the whole batch uncommitted on top of `ae217e4`, which is also `origin/main` after `git fetch` (about 31 changed or new paths; see `git status`). Nothing was staged except the deletion of `apps/app/src/realms/folderBrowser.tsx` (`git rm`).
- Verified now by running them: `bun run typecheck` passes in all 6 workspaces; `npx biome check .` is clean; `bun run test apps/app packages/service/test/work/folderPicker.test.ts packages/service/test/work/workspaces.test.ts packages/service/test/remote` passes (45 files, 415 passed, 4 skipped), including 11 new service tests in `packages/service/test/work/folderPicker.test.ts`, one end-to-end test through a local relay in `packages/service/test/remote/devicePairing.test.ts`, and `apps/app/test/realms/folderPickerLabels.test.ts`. The web export (`bunx expo export --platform web` in `apps/app`) bundled earlier in the session; not rerun after the card rename.
- Built (recorded in CHG-0253 and CHG-0254): `SearchFolders` and `RemoveBrowsableRoot` requests; `service.handle(request, source)` limits a paired device's folder requests to the browsable roots while the host's own window reaches any folder; `AddBrowsableRoot` and `RemoveBrowsableRoot` are host-only; `core/folderSearch.ts`; the app's `realms/folderPicker.tsx` replacing the Electron system dialog (bridge, preload, main handler removed); the Workshop card "Folders open to Iskios" (`settings/browsableRootsCard.tsx`, in the Remote access section). `bun install` had to be run in this worktree; it had no `node_modules`.
- Not verified: the picker and the card were never driven in a window; the full workspace suite was not run (only the paths above); `~/Library` skipping on macOS and the 3 second search deadline on a stuck drive were not exercised. The owner ran `bun dev` once: it started, but name search did not find folders on `/Volumes/APFS-G-DRIVE/...`, because name search walks only the browsable roots, which on the owner's data are still just the home folder.
- Assumed: the owner's remaining unresolved sidebar errors (`Heading` in `shell/sidebar.tsx`, SVG `WebShape` through `editors/planLimitRings.tsx`) are unrelated to this batch; the full messages are still elided in the output the owner pasted.
- Known in the original checkout (from the previous handoff, not rechecked): an untracked `documentation/architecture-audit/architecture-audit-2026-11-12-2245.html` that collides with the committed copy can make a pull there fail.

## Decisions

- The roots limit binds paired devices only; the host's own window uses the same picker over any folder (owner's choice, CHG-0253). The home folder stays the default root (owner's choice). Replaces CHG-0202's "any folder the owner can open" for paired devices.
- The roots are shown in the Workshop as "Folders open to Iskios" (owner's rename: they are also where the host's own searches look). A name search walks only the roots; a typed absolute path resolves anywhere in the host's own window (my choice, in CHG-0254).
- Batch 3 was split: 3a the picker (this), 3b the terminal on a host (not agreed; options in the backlog). The direct WebRTC path gets a mini-prototype first, not an implementation (owner, backlog).
- An agent pushing to `main` needs the repository's pre-push hook bypassed (`git push --no-verify`); `AGENTS.md` requires the user's approval before that. The owner wrote "commit and push on main" as the focus of this handoff, which is the instruction to do it for this batch, but confirm before pushing.

## Next

1. Check `git status` and `git fetch`; confirm `origin/main` is still `ae217e4` and the working tree still holds the batch. If another session pushed, rebase first and rerun the checks above.
2. Commit the batch (one commit, message naming CHG-0253 and CHG-0254; the pre-commit hook runs Biome and the workspace typecheck on staged files), then push to `main` with the owner's approval for `--no-verify`, and check `gh run list` for the hosted run.
3. Sync the original checkout `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/ISKIOS`: it is outside the attached workspace, so attach it or get explicit permission to update it directly; confirm it is clean, then fast-forward its `main` to the pushed commit; stop on local work or divergence; leave other linked worktrees untouched.
4. Offer the owner the picker choice still open (below), and driving the picker in a window: the host's own window, then a paired host through a local relay.
5. Next in device pairing: 3b (terminal on a host, needs the owner's choice), the direct-path mini-prototype, then batch 5 measurement of the relay in real use.

## Open questions

- Owner: should the picker offer "Also search here" for the folder being browsed (recommended; it adds a root and so also opens the folder to paired devices), search `/Volumes` automatically on macOS in the host's own window, or stay as is?
- Owner: the terminal on a host (3b): a terminal endpoint on the host's service with an amendment to ADR 0012 (recommended), a bridge from the main process, or only a notice that it works on this computer.
- Owner review of the look of the picker and the Workshop card is pending.
- What are the actual `Heading` and `WebShape` error messages? Running `bun run build && bun scripts/dev.ts` from `apps/desktop` instead of `bun dev` may print them.

## Sources

- `documentation/changelog.md` CHG-0253 (agreement) and CHG-0254 (delivery); `documentation/work-in-progress.md` entry "Folder picker on a host"; `documentation/capabilities/device-pairing/specifications.md` (the picker and "Where a paired device may look"); `documentation/backlog.md` (terminal on a host, direct path prototype).
- `packages/service/src/core/folderSearch.ts`, `packages/service/src/core/folders.ts`, `packages/service/src/service.ts` (`handle`), `packages/service/src/remote/frames.ts`, `packages/contracts/src/requests.ts` and `remote.ts` (`hostOnlyRequestTags`).
- `apps/app/src/realms/folderPicker.tsx`, `apps/app/src/settings/browsableRootsCard.tsx`, tests under `packages/service/test/work/folderPicker.test.ts`, `packages/service/test/remote/`, and `apps/app/test/realms/`.
- Paseo's behavior was read from its public repository on 2026-11-13 (`packages/server/src/server/session.ts`, `packages/server/src/server/project-suggestions.ts`); nothing was copied.
- Previous handoffs for context: `.agents/handoffs/2026-11-13-0051-side-quest-and-expanded-iskios.md`.
