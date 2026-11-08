# Proof: OpenCode edits outside the workspace, Always allow across kinds

- **Verdict:** proven for all claims, on the stand-in and fake harnesses and live on OpenCode 2.2.0 and Codex.
- **Work:** working tree on `1f00947`, not committed (CHG-0064).
- **Agreement:** the owner's instruction of 2026-11-08 to continue with the next step without questions; the findings come from the Specifications review in `work-in-progress.md`.
- **Environment:** macOS 26, Bun, the OpenCode stand-in (`test/fixtures/stand-in-opencode.mjs`) and the fake harness; live, the owner's OpenCode 2.2.0 with `opencode/deepseek-v4.1-flash-free` and the owner's Codex sign-in.
- **Date:** 2026-11-08

## Claims

| # | Claim | Check | Verdict |
| --- | --- | --- | --- |
| 1 | OpenCode is configured to ask Canopy for every edit | `harnesses.test.ts` › "runs a thread over ACP with Canopy's tools, permissions, context, and model" | proven |
| 2 | An OpenCode edit inside the thread's folder runs without a question | `harnesses.test.ts` › "lets an edit inside the thread's folder run without a question" | proven |
| 3 | An OpenCode edit outside the folder, absolute or climbing out with `..`, asks the owner | `harnesses.test.ts` › "asks the owner before an edit outside the thread's folder"; › "asks the owner before a relative edit that climbs out of the thread's folder" | proven |
| 4 | A path through a link pointing outside the folder counts as outside, for existing and new files | `workspaces.test.ts` › "telling edits inside a workspace from edits outside it" (2 tests) | proven |
| 5 | A thread's question shows the pattern Always allow will save | `approvals.test.ts` › "shows in the question the pattern Always allow will save, not one that does not cover the action" | proven |
| 6 | A broad pattern saved for one kind never covers another kind, nor a sensitive action from an unlisted one; it still covers its own kind | `approvals.test.ts` › "never lets a broad pattern saved for one kind of action cover another kind"; › "never lets a pattern saved for an action the sensitive list misses cover a sensitive one" | proven |
| 7 | A command wholly wrapped in one shell `-c` script is named by its script, so the action just allowed runs once without a second question | `approvals.test.ts` › "names a command Codex wraps in a shell script by the script, and keeps anything around it"; › "runs the action just allowed once when Codex prompts for it wrapped in a shell script" | proven |
| 8 | Live: real OpenCode writes inside the workspace unasked and asks before writing outside it; the owner's Deny keeps the file from being written | `liveHarnesses.test.ts` › "lets OpenCode write inside its workspace unasked and asks before it writes outside" | proven |
| 9 | Live: a Codex thread's `git push` is recognized as Push code, decided once, and reaches the remote | `liveHarnesses.test.ts` › "recognizes a git push from a Codex thread as Push code and runs it once allowed" | proven |

## Shown able to fail

- Before the fix: claims 1 and 2 failed (config `allow`; the inside edit waited on a question). Claims 5 and 6 failed (`npm publish *` shown; the reset and the `./git push` ran under the saved permission, so no question opened).
- Mutations, each restored afterwards: every edit unasked in `isUnaskedEdit` (2 failed); `isInsideFolder` without resolving links (1 failed); `findCoveringPermission` ignoring the kind (2 failed); the question storing the proposed pattern (1 failed).

## Live probes (2026-11-08)

- OpenCode 2.2.0 edit requests, captured raw over ACP (`write` and `edit` tools): `"kind":"edit"`, `"name":"write"` or `"edit"`, `"title"` the path as written, `"locations":[{"path":"/tmp/canopy-probe-ws/notes.txt"}]`, `"rawInput":{"path":"../canopy-probe-rel.txt","content":"hi"}`, and `"content":[{"type":"diff","path":"/tmp/canopy-probe-rel.txt",…}]`. Locations and diffs are absolute; `rawInput.path` keeps a relative path. No `filePath`.
- Rejecting an OpenCode permission ends the whole prompt with `stopReason: "cancelled"`: the model does not continue after a Deny. Recorded as an open finding.
- Codex, before the unwrap fix: `[{"details":"git push origin main","outcome":"AllowedByMessage","source":"Thread"},{"details":"/bin/zsh -lc 'git push origin main'","outcome":"Allowed","source":"Harness"}]`: the owner was asked a second time. After: `[{"details":"git push origin main","outcome":"AllowedByMessage","source":"Thread"}]`, and the remote held the commit.

## Regressions

`bun run test` passed 390 with 10 skipped, twice in a row. Live: 5 of 5 passed. Typecheck, `bun run check` (no diagnostics), and `git diff --check` passed.

## Not verified

- The app driven in the window.
- At "Also commands and edits", an OpenCode edit inside the folder still asks with the summary "Change a file outside the workspace": the wording is unchanged from before and is listed as Low in `work-in-progress.md`.
