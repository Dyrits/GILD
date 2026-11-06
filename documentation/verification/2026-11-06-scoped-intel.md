# Proof: batch 12, scoped intel

- **Verdict:** behavior proven on the fake harness for C1 to C10; the owner has neither agreed the batch nor accepted it. Not checked with a live Claude Code thread.
- **Work:** working tree on `554a28c`, uncommitted.
- **Agreement:** none yet. Proposed in `documentation/work-in-progress.md` (Batch 12) from the scoped-intel specifications, chosen by an agent under the owner's instruction of 2026-11-06 ("build what is next", no questions this session). Tidy up intel and the starting-context warning are staged.
- **Environment:** macOS, Bun, Electron 45.2.3. Metro on port 8083; Electron run as `env -i HOME PATH USER TMPDIR LANG OPENMISSION_HARNESS=fake OPENMISSION_DATA_DIR=/tmp/om-run/data-b12 OPENMISSION_APP_URL=http://localhost:8083 electron --inspect=9336 dist/main.js --remote-debugging-port=9335` in `apps/desktop`, driven with Playwright CLI over CDP through the [batch 9 helper scripts](2026-11-06-mission-tracking/drive-run-code.sh). The folder dialog's IPC handler was replaced through the Node inspector ([main-eval.ts](2026-11-06-batch-4-drive/main-eval.ts)) to return `/tmp/om-run/ws-intel`. The fake harness's `call <tool> <json>` lines played the threads' tool calls; `context` echoed a turn's context.
- **Date:** 2026-11-06
- **Who:** an agent, built test-first.

## Claims

| # | Claim | Check | Verdict |
| --- | --- | --- | --- |
| C1 | A thread saves thread, mission, and workspace intel on its own, and each save shows in its thread | `intel.test.ts`; window ([b12-01-thread.png](2026-11-06-scoped-intel/b12-01-thread.png)): "Save intel to Mission "Release planning"" | proven |
| C2 | A global save waits for the owner: Approve saves it, Decline saves nothing; the thread's answer says it awaits approval | two tests; window: the card in the thread with Approve and Decline, approved | proven |
| C3 | An intel over 200 tokens is refused with its size; workspace intel is refused for a thread without a workspace | two tests; window: "Not saved: you have no workspace: choose thread or mission instead." | proven |
| C4 | Every turn's context carries all the intel in scope, most specific first, with the rule that the first listed wins a conflict, and the instruction to save a rule the owner gives in a chat | three tests | proven |
| C5 | Lookup: the thread, each thread above, the workspace, then global; a sibling's or another mission's thread intel stays out | two tests; window ([b12-04-second-context.png](2026-11-06-scoped-intel/b12-04-second-context.png)): a second mission in ws-intel received the workspace and global intel, and not the first missions' thread and mission intel | proven |
| C6 | `search_intel` finds by words in lookup order, filtered by scope | test | proven |
| C7 | A thread corrects and deletes thread and workspace intel on its own; global changes and deletions wait for approval; intel outside its scope is refused | three tests | proven |
| C8 | Widening waits for approval; narrowing is refused | test; window ([b12-05-widen-card.png](2026-11-06-scoped-intel/b12-05-widen-card.png)): "Move intel to Global" with Approve and Decline, declined | proven |
| C9 | The intel panel lists each intel with scope, saver, time, and size, filters by scope, and lets the owner edit and delete any intel; deleting a thread erases its intel and its awaiting changes | three tests; window ([b12-06-thread-panel.png](2026-11-06-scoped-intel/b12-06-thread-panel.png), [b12-07-filtered-edited.png](2026-11-06-scoped-intel/b12-07-filtered-edited.png), [b12-10-all-intel-global-deleted.png](2026-11-06-scoped-intel/b12-10-all-intel-global-deleted.png)) | proven |
| C10 | The intel icon turns red past the warning share of the model's context window (Settings, default 10%) | test; label test; window ([b12-09-red-icon.png](2026-11-06-scoped-intel/b12-09-red-icon.png)): at 1%, 13 intels over 2,000 tokens turned "Intel · 13 · 1.0%" to `rgb(185, 28, 28)` | proven |

## Evidence

- `bun run test`: 237 passed, 5 skipped (19 new intel checks, 2 new label checks). Typecheck, `bun run check`, desktop build, and a Metro web export (`CI=1 bunx expo export --platform web`): pass.
- Mutation check: [mutations.py](2026-11-06-scoped-intel/mutations.py); 12 of 12 mutations failed checks ([mutations.txt](2026-11-06-scoped-intel/mutations.txt)).
- Database after the drive: changes recorded as Save Done, Save Approved, Update Declined; the edited workspace intel kept its scope with a new text and time.

## Reproduction

Before the commit, from a separate worktree of `554a28c` with the working tree's changes applied: the mutation script (root pointed at the worktree) caught 12 of 12, and the full suite passed 237 with 5 skipped. The user's checkout was not touched by that run.

## Observed, not changed (interface pass)

- An intel change line repeats the whole intel text; long intels make long lines.
- The icon's percent rounds to one decimal, so "1.0%" shows on both sides of a 1% warning.

## Not verified

- A live Claude Code thread choosing scopes and saving a rule from a chat on its own (opt-in live check not run).
- Every model's context window counts 200,000 tokens, so "not red on a model with a larger window" is not checked.
- The owner's agreement and the human acceptance (desktop and phone).
