# Proof: batch 4 run-through in the Electron window

- **Verdict:** proven, except C8 (the native folder dialog itself), which a person must click.
- **Work:** `0a930cd`, plus the three fixes the drive found (working tree, recorded in CHG-0036)
- **Agreement:** `documentation/work-in-progress.md` (Batch 4, Checks: owner run-through); CHG-0034, CHG-0035
- **Environment:** macOS 26.6.2, Bun 1.4.3, Electron 45.2.3, Claude Code 2.1.302 with Sonnet at default effort. Metro ran with `bunx expo start --port 8081` in `apps/app`, without `CI=1` so edits reload. Electron ran with `env -i HOME PATH USER TMPDIR LANG OPENMISSION_DATA_DIR=/tmp/om-run/data electron --inspect=9334 dist/main.js --remote-debugging-port=9333` in `apps/desktop`, and the window was driven with Playwright CLI over CDP. The workspace was a `git clone` of this repository at `/tmp/om-run/OpenMission-copy` whose `origin` was a local bare repository, so no push left the computer.
- **Date:** 2026-11-06
- **Who:** an agent, at the owner's request ("I want you to directly use the app and try it").

## Claims

| # | Claim | Verdict |
| --- | --- | --- |
| C1 | A mission on the repository follows `AGENTS.md`, installs, runs `bun run check`, typecheck, and `bun run test`, and commits, with no question | proven |
| C2 | A push the owner names in their message runs without a question, recorded "Allowed by your message" with the quote | proven |
| C3 | A push the owner did not name asks in plain words, with Allow, Always allow, Deny, an optional Deny message, and Show details | proven |
| C4 | Always allow saves a workspace permission, shown "In workspace OpenMission-copy" on the Permissions page | proven |
| C5 | A message sent while the workspace folder is gone puts the thread in Attention with the notice and Retry; Retry while still missing keeps it there; Retry after the folder returns delivers the waiting message | proven |
| C6 | A command Claude Code wants to run outside the sandbox that is not sensitive runs with no question and leaves "Ran · <reason> · time" | proven |
| C7 | The dashboard row shows the workspace name | proven |
| C8 | Choose folder… opens Finder and fills in the chosen folder | partly: the IPC path and the filled-in path are proven; the Finder dialog was not clicked |

## Evidence

- **C1:** mission "In README.md, add a short 'Running the app' section … run the checks, and commit the change. Do not push." The clone's `git log` showed `ddc8f0d Add Running the app section to README`; the `questions` table was empty. The thread reported 71 passed and 2 skipped.
- **C2:** "Thanks. Now push the commit to origin." gave the line `Allowed by your message · git push origin main` with the quote, and the bare remote's `git log` showed `ddc8f0d`.
- **C3:** "… Then finish the job so the change is wherever it needs to be." gave the card in [push-question.png](2026-11-06-batch-4-drive/push-question.png).
- **C4:** see [permissions-history.png](2026-11-06-batch-4-drive/permissions-history.png).
- **C5:** the folder was renamed away, a message sent, Retry pressed (thread stayed in Attention), the folder renamed back, Retry pressed: the thread committed `dc72300` and pushed. Screenshot: [missing-folder.png](2026-11-06-batch-4-drive/missing-folder.png).
- **C6:** asked to set `core.hooksPath`, the thread's sandboxed attempt was refused (`.git/config` is protected), Claude Code prompted, and OpenMission ran it: "Ran · Set repo-local hooks path to .githooks · 07:31 AM". Screenshot: [ran-line-and-follow.png](2026-11-06-batch-4-drive/ran-line-and-follow.png).
- **C8:** clicking Choose folder… opened the Finder sheet, but `osascript` has no accessibility access here and no computer-use tool was available, so the sheet could not be operated. The rest of the run replaced the `openmission:chooseFolder` handler in Electron's main process through the Node inspector with [main-eval.ts](2026-11-06-batch-4-drive/main-eval.ts), returning the clone's path; the app showed it and started the mission there.

## Found and fixed

1. **The conversation did not follow new entries.** The push question appeared below the visible area (scroll offset 156 of 636). Now the list keeps the newest entry in view, unless the owner has scrolled up, and sending follows again. Checked in the window: opening lands at the end (1116 of 1607 − 491), sending from the top jumps to the end, a reply is followed, and a reply arriving while scrolled up leaves the offset at 200. No automated UI test exists for the app.
2. **Always allow saved the thread's own label**, "Push code to GitHub", for a remote that was not GitHub, because the `request_approval` tool description used it as its example. A command the sensitive list recognizes now saves the list's label ("Push code"); the thread's label is kept for actions the list does not know. The tool's examples no longer mention GitHub. Checked test-first in `approvals.test.ts` ("names what Always allow saves after the sensitive list, and after the thread for actions it misses").
3. **Permissions history repeated each mission's whole first message** before every entry. The mission title is now one truncated line, with the summary below it.

## Observed, not changed

- In a fresh clone, `bun install`'s `prepare` step cannot set `core.hooksPath` inside the sandbox, so commits skip the pre-commit hook until something sets it. The thread then claimed that the hook had run, which was false. Asked to set it, the thread did so with no question (C6).
- The thread's question text said "on GitHub" for a local remote. The lead sentence is the thread's own; only the saved label is now the list's.

## Regressions

| Check | Command | Before | After |
| --- | --- | --- | --- |
| Tests with live Claude Code | `OPENMISSION_LIVE_CLAUDE=1 bun run test` | 73 passed | 74 passed |
| Typecheck | `bun run typecheck` | pass | pass |
| Lint | `bun run check` | pass | pass |
| Desktop build | `bun run build` in `apps/desktop` | pass | pass |
