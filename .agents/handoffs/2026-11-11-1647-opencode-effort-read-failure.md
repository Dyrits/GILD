# Handoff: OpenCode effort levels, read failures no longer hide the picker

Supersedes: `2026-11-11-1645-handover-lines-effort-picker.md`
Workspace: ISKIOS repository, branch `main`, working tree uncommitted (commit `59e88cd` and the handoff commit `f6b7cdb` are the last pushed state)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner's OpenCode effort picker must offer the provider's levels (a model's `thought_level` options) without a visible delay, flicker, or silent disappearance. Done is: the levels are read ahead, a pick shows them at once, and a failed read never leaves the picker hidden.

## State

Pushed earlier (see the superseded handoff and the changelog): CHG-0158 per-model efforts through `ListModelEfforts`; CHG-0162 read-ahead of every OpenCode model's levels when the model list is read; CHG-0166 no flicker on a model change; CHG-0168 handover line written when a turn starts.

In the working tree, uncommitted, this session's last change, CHG-0169 (changelog entry written):

- `packages/service/src/harness/opencode.ts`: `listOpenCodeEfforts` fails with a `ServiceFailure` ("did not give this model's effort levels. Try again.") when OpenCode cannot be asked or opens no session; it is tried twice, 30 seconds each. An empty list now means OpenCode says the model has none.
- `packages/service/src/harness/harnesses.ts` and `harnessTools.ts`: `readEfforts` and `listEfforts` carry `ServiceFailure`; an empty answer is still not cached; the read-ahead (`warmEfforts`) ignores failures and runs 2 models at a time (was 3).
- `apps/app/src/editors/runners.tsx`: `useModelEfforts` asks again up to 3 times, 3 seconds apart, after a failed ask and never stores a failure as "no levels"; it keeps the previous model's levels of the same harness and account while the new model's answer is awaited (CHG-0166).
- `packages/service/test/harness/harnesses.test.ts`: a case for the failed read, and the read-ahead case of CHG-0162.
- `documentation/changelog.md`: CHG-0169.
- Not part of this work: `packages/service/serve-cl.ts` (untracked throwaway script), the `assets/nav/scroll.png` twins, and the sidebar and quest-tree edits of other sessions.

Verified now (2026-11-11 16:46): `bun run typecheck` clean on the 4 workspaces; Biome clean on the files above; `packages/service` vitest `test/harness/harnesses.test.ts` and `test/work/handover.test.ts` 56 of 57 (the one failure, "runs a thread with an added account's own folder", also fails without these changes: the running session's environment leaks into it); `apps/app` vitest 177 of 177. Verified earlier in this session against the real OpenCode 2.2.0 (60 models, through the live service layer): `ListModelEfforts` answers with levels for the default model and specific models, and from the cache in 1 to 3 ms once the read-ahead finished; a pick during the read-ahead took 3 to 8 seconds, against 1 to 2 alone.

Assumed, not verified: that a failed or timed-out read was the owner's cause. The report "the picker no longer offers levels" was not reproduced; the owner's running service needs a per-launch token and was not queried. A model OpenCode lists no levels for (for example `github-copilot/gpt-5-mini`) also shows no picker, which is correct. No test drives `useModelEfforts` (the app has no React renderer), and neither CHG-0166 nor CHG-0169 was seen in the running app.

## Decisions

- Failed read versus no levels: the service fails on the former and answers empty only for the latter, so the app can retry the former and keep the latter (CHG-0169).
- Levels are read in the service, ahead of time, into the cache that holds them for the model list's lifetime; the contracts' request and response shapes are unchanged (CHG-0162).
- The handover line belongs to a turn that runs, not to a picker change (CHG-0168; specification `documentation/capabilities/thread-handover/specifications.md`).
- Rules of this tree: colors from `foundation/theme.ts` only, never a hex, never `colors.text` or `colors.highlight` as a background; a nav icon change needs both the dark and the light set; the changelog is append-only, read its tail for the next number (the last used is CHG-0169); harness tests run with vitest, not `bun test`.

## Next

1. Confirm with the owner that the effort picker offers OpenCode levels in the running app after a restart, and on which model and account if it still does not.
2. If it does not, reproduce in the running app (a throwaway instance of the web export on the fake harness cannot show OpenCode's real levels; use the real OpenCode) and check the service's answer for that model before changing the app again.
3. Consider a test for the retry in `useModelEfforts`, which needs a React renderer the app does not have, or moving the retry into a plain function that a vitest file can drive.
4. Consider whether the read-ahead should be skipped or slowed while a pick is in flight, since it slows a pick for a few seconds after the model list is read.

## Open questions

- Which model and account did the owner have when the picker was missing? The owner can answer.
- Is the read-ahead's cost acceptable (about 60 short OpenCode sessions, 2 at a time, per model-list read every 10 minutes at most, each stored in OpenCode's own session history)? The owner decides.

## Sources

- `documentation/changelog.md`, entries CHG-0158, CHG-0162, CHG-0166, CHG-0168, CHG-0169
- `packages/service/src/harness/harnessTools.ts`, `harnesses.ts`, `opencode.ts`
- `apps/app/src/editors/runners.tsx`
- `packages/service/test/harness/harnesses.test.ts`
- `.agents/handoffs/2026-11-11-1645-handover-lines-effort-picker.md` (superseded)
- Commits `131c583`, `8b85c98`, `59e88cd`
