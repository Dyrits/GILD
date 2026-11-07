# Handoff: harnesses and provider accounts (batch 18), committed

Supersedes: `2026-11-07-1100-interface-pass.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff for the interface pass. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner asked, while away and without questions: "I'd like OpenMission to be able to be used to build OpenMission. I want to be able to use different providers in it, using my Claude subscription (and even register more than one account like OpenBot does). I want to be able to use Codex as well and OpenCode. Focus on that first."

## State

- Verified by command output: `bun run test` passed 332 with 8 skipped; `bun run typecheck`, `bun run check`, `git diff --check`, the desktop build, and `CI=1 bunx expo export --platform web` passed.
- Verified live: `OPENMISSION_LIVE_HARNESSES=1 OPENMISSION_LIVE_OPENCODE_MODEL=opencode-go/deepseek-v4.1-flash bun run test packages/service/test/liveHarnesses.test.ts` passed 3 (listing, a Codex turn and an OpenCode turn that call `set_mission_title`).
- Verified in the window with the real harnesses: a Codex mission, an OpenCode thread beneath it whose result reached the Codex thread, a Claude Code mission, adding and removing a Claude account (`documentation/verification/2026-11-07-harnesses-and-accounts.md`).
- Committed at the owner's request ("Yes, and push."), on top of `ab85b66`, in the commit that adds this file; where it was pushed is recorded in the session's report, check `git log origin/main -1` and `git branch -r`. `.zcode/` stays untracked.
- Verified: 12 of 12 mutations caught by `harnesses.test.ts` in a separate copy.
- Not accepted by the owner: batch 18 (CHG-0059), nor the interface pass and batches 12–17.

## Decisions

- An added account is a folder the harness uses as its home (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `XDG_DATA_HOME`), signed in through the harness's own login in Terminal; OpenMission stores a name and path only (ADR 0011).
- `ModelChoice` is a free string per harness; `default` is the harness's own.
- `StartMission`, `OpenThread`, and `NewMission` take optional `harness` and `accountId`; left out, they come from Settings or the opener (`runners.ts`).
- Codex: one `codex app-server` per thread; OpenCode: one `opencode acp` per thread with `OPENCODE_CONFIG_CONTENT` in OpenCode's v2 shape. Both answer permission requests through `answer_prompt`.
- Provisional choices are listed in `documentation/work-in-progress.md` (Batch 18).

## Next

1. Ask the owner's judgment of batch 18's provisional choices, especially loading their own Codex and OpenCode settings in threads.
2. Ask the owner to sign in an added Claude account from Settings (Sign in opens Terminal) and run one turn on it: not yet verified.
3. Use OpenMission on its own repository: start a mission with the workspace `/Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission`, and note what blocks real work there.
4. Then the Next list of the superseded handoff.

## Open questions

- Should removing a Claude account also remove the sign-in Claude Code keeps in the keychain?
- Live Codex escalation, live Codex steering, and live OpenCode permission prompts are covered by stand-ins only.

## Sources

- `documentation/verification/2026-11-07-harnesses-and-accounts.md` and its screenshots
- `documentation/capabilities/provider-accounts/specifications.md`; `documentation/architecture-decision-record/0011-accounts-as-harness-folders.md`
- `documentation/changelog.md` (CHG-0059); `documentation/work-in-progress.md` (Batch 18)
- `packages/service/src/codex.ts`, `opencode.ts`, `rpcProcess.ts`, `harnessTools.ts`, `accounts.ts`, `runners.ts`; `apps/app/src/runners.tsx`, `accounts.tsx`
