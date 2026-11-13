# Folder picker on a host, 2026-11-13

Claim: a paired device reaches only the host's browsable roots when it searches, browses, or makes folders; the host's own window reaches any folder; only the host adds or removes a root; one picker replaces the system folder dialog (CHG-0253, CHG-0254).
Starting commit: `ae217e4`, end state: the uncommitted working tree of this worktree. A narrowed pass, at the owner's request: the owner validated the batch and asked for the push, so this records a rerun of the checks, not a full proof.
Not checked: the picker and the Workshop card in a running window (the owner ran `bun dev` once; the look and name search on `/Volumes` were reviewed by them, not by an automated drive); `~/Library` skipping on macOS; the search deadline on a stuck drive; the full workspace suite.

## Claims and results

| Claim | Check | Verdict |
| --- | --- | --- |
| Name search ranks exact, prefix, part, loose; leaves out hidden, `node_modules`, build output, Git-ignored folders, and links leaving the root | `packages/service/test/work/folderPicker.test.ts` | proven by the test passing; able to fail: the same file's first run failed on the old call shape before `service.handle` took a source (type error), and `workspaces.test.ts` failed until updated when the owner's window could browse outside the roots |
| A typed path resolves exactly (hidden included) under a root, and only the host's window outside the roots | same file | as above |
| A paired device is refused folders outside the roots (browse, search, make), and reaches them once the host adds the root | same file; `packages/service/test/remote/devicePairing.test.ts` through a real local relay and the encrypted channel | passing; failure not shown by a mutation |
| `AddBrowsableRoot` and `RemoveBrowsableRoot` are refused to a paired device | `packages/service/test/remote/frames.test.ts` (loops over `hostOnlyRequestTags`), `devicePairing.test.ts` | passing; failure not shown by a mutation |
| Suggestions list used folders newest first, limited by access | `folderPicker.test.ts` | passing |
| The picker's look and interaction | not automated | awaiting human judgment (the owner ran it once and accepted it for now) |

## Rerun, 2026-11-13

- `npx biome check .`: clean (554 files).
- `bun run typecheck`: 6 of 6 workspaces exit 0.
- `bun run test apps/app packages/service/test/work/folderPicker.test.ts packages/service/test/work/workspaces.test.ts packages/service/test/remote`: 45 files, 415 passed, 4 skipped.
- `git diff --check`: clean after removing a blank line at the end of `documentation/changelog.md`.
- Earlier in the session: the web export bundled; one typecheck failure in the new relay test was found by the handoff's re-verification and fixed.

## Overall

Not fully proven: no mutation check was run (no separate worktree), and the interface was not driven by an agent. Reproduction by a fresh agent was not done; the commands above are the reproduction.
