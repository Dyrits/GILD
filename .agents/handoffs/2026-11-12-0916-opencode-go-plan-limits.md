# Handoff: Reserves usage page and plan-limit rings, with OpenCode Go limits

Supersedes: `2026-11-12-0726-reserves-usage-and-plan-rings.md`
Workspace: Iskios repository (`/Volumes/APFS-G-DRIVE/Codelab/Dyrits/CANOPY`), branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Every provider account the owner adds is tracked for its plan limits in the rail's rings, the Charter, and the thread panel, for Codex, Claude Code, and now OpenCode Go; and the Reserves usage page meets its specification. Done means the rings and page were driven live in the desktop app and the owner accepted how they look.

## State

Verified now (run on 2026-11-12 before this file was written): `bun run typecheck` has no errors; `bunx biome check .` is clean; the whole test suite passes (974 passed, 14 skipped, run with `ELECTRON_RUN_AS_NODE=1 node_modules/.bin/electron node_modules/vitest/vitest.mjs run` from the repository root). `bun install` was needed first: the pull had brought the `@iskios/*` renaming and `node-pty`.

Built in the commit that adds this file (CHG-0200):
- OpenCode Go plan limits: `readOpenCodePlanLimits` and `openCodePlanLimitsOf` in `packages/service/src/harness/opencode.ts`. A short `opencode serve --hostname 127.0.0.1 --port 0`, started in the account's data folder with `OPENCODE_SERVER_PASSWORD` set to a per-run value, is asked `GET /api/experimental/usage/limits` (basic authentication, user `opencode`) and killed. `data.go` gives `rolling` (300 minutes), `weekly` (10080), and `monthly` (43200 minutes, labeled "Monthly" in `windowLabelOf`), each with `percent` and `resetsAt` in milliseconds. A null `data` or no `go` gives no report ("Limits not reported"); a failed read is paced as any failed read.
- Rings with three windows use stroke 3 and gap 1 (`apps/app/src/editors/planLimitRings.tsx`), leaving the logo 16 of 44 points; with the old stroke 4 and gap 2 it would have been 6.
- Verified live: with the owner's own OpenCode sign-in, the route answered and the real adapter returned the three windows (probe of 2026-11-12, OpenCode 2.2.0, no model call). Verified by a mutation: removing the monthly window fails the stand-in test.
- The spec (budget-control, Plan limits), the backlog entry, and the changelog (CHG-0200) were updated.

Not done, unverified or open:
- The three rings were not seen in the running app, nor the usage page; the earlier handoff's gaps in the usage page (no companion or skill breakdown, only the first 100 rows of a breakdown reachable, token detail for incomplete turns, one reported unsafe cast) are unchanged and not rechecked.
- Only the computer's own OpenCode sign-in was read live; an OpenCode account added through Iskios and signed in to Go was not.
- The route is marked experimental by OpenCode and may change. What `percent` means for a Console workspace with several members is unknown.
- Claude Code's limits refresh only when a Claude turn happens, plus one probe per run.

## Decisions

- OpenCode's limits come from OpenCode's own local API, never from a provider endpoint called with a credential Iskios read (requirements, Comply with provider terms). Recorded in CHG-0200 and the spec.
- Rings show what is left, colored by how much is used (CHG-0198, unchanged).
- Three windows draw thinner rings rather than a smaller logo or a hidden window.

## Next

1. Drive the app live (the repository's verification notes describe how) and look at the rail with Codex, Claude Code, and OpenCode Go all reporting; check the three-ring look and the hover card, and add an OpenCode account signed in to Go to see it tracked.
2. Close the usage page's gaps listed above.
3. Write the outcomes into the changelog and a new handoff.

## Open questions

- Whether the owner likes the look of the rings, the thinner three-ring stroke, and the hover card position. The owner can answer.
- Whether the owner wants the Companion and Skill breakdowns now, since skill cost can only be shown when reliably attributed. The owner can answer.

## Sources

- `documentation/changelog.md` (CHG-0198, CHG-0199, CHG-0200)
- `documentation/capabilities/budget-control/specifications.md` (Plan limits)
- `documentation/backlog.md` (Plan usage in the rail)
- `packages/service/src/harness/opencode.ts`, `packages/service/src/work/planLimits.ts`
- `packages/service/test/harness/harnesses.test.ts`, `packages/service/test/fixtures/stand-in-opencode.mjs`, `apps/app/test/editors/planRings.test.ts`
- `.agents/handoffs/2026-11-12-0726-reserves-usage-and-plan-rings.md`
