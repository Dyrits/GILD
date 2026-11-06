# Proof: review fixes and architecture after batch 11

Date: 2026-11-06. Base: `083003f` plus the uncommitted working tree. Fake harness, real temporary SQLite; nothing driven in the window.

## What is claimed

- Findings P1–P8 of the specifications review are fixed, each with a test that failed first (work-in-progress, Review, fixes, and architecture after batch 11).
- The standards refactors and the six architecture candidates keep the agreed behavior: [architecture-audit-2026-11-06-1959.html](../architecture-audit/architecture-audit-2026-11-06-1959.html).

## Reproduce

```bash
bun run test                     # 216 passed, 5 opt-in live skipped
bun run typecheck && bun run check
bun run --filter desktop build
cd apps/app && CI=1 npx expo export --platform web --output-dir /tmp/om-export   # contracts split under Metro
for f in packages/service/test/*.test.ts; do bun run test "$f"; done              # no module-load cycle per entry
```

## Red before green

Each new test failed before its fix, for the reason it names: a Waiting parent stayed Waiting (P1, budget and chatter), spending fell to 0 after a delete (P2), a held thread stayed in Attention after the period (P3), Claude Code started 3 processes (P4), the setting opened a mission although one matched (P5), the answer said "stopped" (P6), a second Mark as done succeeded (P7), the blocker became Budget (P8), the thread view had no actions, and a Failed thread messaged under a reached budget stayed Failed (R1, Claude Code stand-in).

## Mutations

Each mutation reverted one fix; the suite caught 10 of 10: relaxing parents on Stop, keeping deleted spending, the period release, the note outside the system prompt, the service-side match, the ending guard, keeping another blocker, `canResume`, the not-asked text, and holding a starting Failed thread (R1).

## Module-load cycles

An import-graph check over `packages/service/src` (value imports only) finds no cycle; each test file also passes run alone.

## Not verified

- A live Claude Code turn reading the budget line from its message.
- A failed turn withdrawing a suggestion (no fake path).
- The look of the "Deleted threads" and "Deleted missions" parts.

## Verdicts

| Claim | Verdict | Evidence |
| --- | --- | --- |
| P1 every Stop relaxes a Waiting parent | proven | budget and chatter tests; red before; mutation caught |
| P2 deleting keeps spending | proven | two budget tests; red before; mutation caught |
| P3 release at a new global period | proven | TestClock test; red before; mutation caught |
| P4 budget line outside the system prompt | proven (stand-in) | claude.test with the stand-in executable; mutation caught. Live Claude Code: unproven |
| P5 service-side match | proven | off-topic test; red before; mutation caught |
| P6 withdrawal on Interrupt, restart, not-asked text | proven | off-topic tests; mutation caught. Failed-turn withdrawal: unproven (no fake path) |
| P7 ending guard | proven | tracking test; red before; mutation caught |
| P8 budget hold keeps another blocker | proven | budget test; red before; mutation caught |
| R1 a Failed thread is held and runs after a raise | proven (stand-in) | claude.test; fails with the regression restored |
| Thread actions from the service | proven | threads test; red before; mutation caught |
| Structure keeps behavior | proven | 216 tests, per-file runs, no cycles, two reviewer passes |
| "Deleted threads" and "Deleted missions" parts look right | awaiting human judgment | not driven in the window |

Overall: not every claim proven. Unproven: live Claude Code turns, and the failed-turn withdrawal. Awaiting the owner: the look of the deleted parts.

Limitation: the mutations ran in the working checkout, each restored right after (the suite passed afterwards), not in a separate worktree.

## Reproduction

Rerun from a clean shell on 2026-11-06 at 21:15 by the implementing agent, not a fresh-context agent: `bun run test` 216 passed, 5 skipped; typecheck and `bun run check` clean; desktop build passed; Metro web export passed; 16 of 16 service test files passed alone. Matches the claims above.
