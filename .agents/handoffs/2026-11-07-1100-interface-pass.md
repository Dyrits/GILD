# Handoff: first interface pass, after the look of OpenBot, committed

Supersedes: `2026-11-07-1036-batches-16-17-committed.md`
Workspace: /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff for anything about batches 12–17. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner asked, while away and without questions: "Let's work a bit on the UI. Look at how OpenBot looks like and try to get something close to that if possible." The pass restyles the app only; no behavior changed.

## State

- Verified by command output: `bun run test` passed 311 with 5 skipped; `bun run typecheck`, `bun run check`, `git diff --check`, and `CI=1 bunx expo export --platform web` passed.
- Verified in the window on the fake harness, with before and after screenshots: the sidebar shell, the pickers in the composer, the restyled dashboard, thread, intel, settings, journal, and budget screens, and the narrow fallback (`documentation/verification/2026-11-07-interface-pass.md`).
- Committed on `main` in the commit that adds this file, on top of `d42d7fd`, at the owner's request ("Commit and push."); whether it reached `origin/main` is not recorded here: check `git log origin/main -1`. `.zcode/` stays untracked.
- Not accepted by the owner: the look (CHG-0056), nor batches 12–17.

## Decisions

- The look comes from OpenBot's light theme tokens, read from its installed stylesheet; no OpenBot code was copied (PolyForm Noncommercial, decision record 0001). The palette lives in `apps/app/src/theme.ts`; screens import from it, not hex values.
- Light theme only, as `app.json` sets `userInterfaceStyle: light`.
- The sidebar shows from 820 points wide; screens hide the links it offers through `useHasSidebar()`, and keep them on narrow windows.
- Model and effort at mission start are compact pickers (`Menu`); Settings and the open-thread form keep chips.
- The owner's messages carry no "You" label unless queued.

## Next

1. Show the owner the screenshots and ask for their judgment of the look.
2. Candidates for a second pass: hover states on web (the native `Pressable` types declare no hover), grouped settings cards as OpenBot draws them, relative times in mission rows, a hidden title bar with the traffic lights over the sidebar (needs a drag region), dark mode from OpenBot's dark tokens, the thread pane's Delete link moved into its header.
3. Then the Next list of the superseded handoff.

## Open questions

- Why `playwright-cli click` times out on some pressables while a DOM `click()` works (also seen in batch 17's proof).

## Sources

- `documentation/verification/2026-11-07-interface-pass.md` and its screenshots
- `documentation/changelog.md` (CHG-0056); `documentation/inspirations.md` (OpenBot)
- `apps/app/src/theme.ts`, `sidebar.tsx`, `styles.ts`, `controls.tsx`, `App.tsx`
