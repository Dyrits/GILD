# Handoff: @ mentions and chips merged onto the redesigned composer

Supersedes: `2026-11-09-1725-mentions-chips.md`
Workspace: `/Users/dgerrits/Codelab/Dyrits/CANOPY`, Gild repository, branch `main` (at `52edc43` before the commit that carries this file)

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner types `/` for skills or `@` for files and folders of the current realm in a message box, and the chosen item is a chip with an icon inside the text. Both the slash skills (already on `main`) and the `@` work are now merged onto the owner's redesigned composer.
Done means the owner has seen the chips and the lists in the running window and accepted them.

## State

- **Verified (`bun run typecheck`, `bun run check`, `bun run test`, `cd apps/app && bunx expo export --platform web`, run after the merge):** typecheck and lint pass; 500 tests pass, 10 skipped; the web export bundles.
- **What the merge did (verified by reading the files):** the earlier uncommitted chips work was stashed, `origin/main` (25 commits, CHG-0077 to CHG-0098) was pulled, and the stash was applied with conflicts in 9 files, all resolved by hand; the stash was then dropped.
- **Composer (`apps/app/src/controls.tsx`):** keeps the one-line pill of CHG-0082 (`composerPill`, `composerField`, accessories, actions); `ChipEditor` sits in the field in place of the `TextInput`. The old text-overlay highlight (`SkillHighlights`, `skillOverlay`, `composerInputOverlaid`) is removed. The web editor (`chipEditor.web.tsx`) is 32px minimum and 200px maximum high, then scrolls; the native input has `maxHeight: 200`. These sizes were chosen at merge and not seen.
- **Conversation:** `conversationEntries.tsx` keeps the parchment message cards with provider logos (CHG-0095 area); the owner's messages use `ChipText` (`chips.tsx`), given `skills` and `workspacePath` by `conversation.tsx`.
- **Service:** unchanged by the merge: `ListSkills`, `ListWorkspaceEntries` (`packages/service/src/{skills,workspaceEntries}.ts`), delivery pointer for skills in `messaging.ts`. Tests for `@` were re-added at the end of `packages/service/test/workspaces.test.ts`.
- **Dropped at the merge:** the earlier change that hid the "Realms" and "Quests" rules in the collapsed rail (`sidebar.tsx`); the rail was rebuilt upstream (Category rows, The Keep) and the change had no target. Whether the new rail needs an equivalent is unchecked.
- **Records:** the `@` entry is now `CHG-0099` in `documentation/changelog.md` (it was CHG-0077, which already existed for another change); the superseded handoff still says CHG-0077. A "Naming files and folders with @" section is in `documentation/capabilities/workspace-attachment/specifications.md`. A proof folder `documentation/verification/2026-11-09-mentions-chips/` came with the earlier work; its claims were not re-run.
- **Not observed in the running window:** the pill with chips (growth with lines, caret across chips, Backspace), the `@` and `/` lists, the chips in the conversation cards, `/verify` after the merge.

## Decisions

- All the stashed work was kept (owner: "incorporate all"); where it overlapped the new composer or rail, the upstream layout won and the chips were fitted into it.
- Earlier decisions stand: chips inline through an editable element on the web, plain tokens on native; skills reach the harness as an appended pointer; the message goes plain; `@` follows `.gitignore` and needs a realm; a chip comes only from the list, not from typing a token by hand. See the superseded handoff for reasons.
- Pushing to `main` was authorized by the owner in this session; the Git guard otherwise forbids it for agents.

## Next

1. Start the window on a throwaway database with the fake harness (never the owner's data) and check the pill: one line at rest, growth with lines and the 200px ceiling, chips inline, the `/` and `@` lists above it, Enter to send, chips in the sent card, no `@` list outside a realm.
2. Check the collapsed and expanded rail for the empty "Realms" and "Quests" groups that the dropped change handled.
3. Record a proof under `documentation/verification/` and ask the owner what they saw; adjust chip size (height 18, icon 12) and editor heights.
4. Settle the open questions below.

## Open questions

- Should a typed-by-hand `/skill` or `@path` also become a chip, and should `@` list files of a folder other than the thread's workspace?
- Should the native phone build get inline chips (needs another editor)?
- Should plugin skills be listed, and should skills show per thread?
- Do the timing-sensitive intel, tracking, and harness tests fail on a clean `main` under a full run? The last full run passed.

## Sources

- `AGENTS.md`, `documentation/conventions.md`, `documentation/capabilities/{workspace-attachment,tool-and-skill-loading}/specifications.md`.
- `documentation/changelog.md` (CHG-0082 for the pill, CHG-0099 for `@`).
- `apps/app/src/{controls,chipEditor,chipEditor.web,chipEditorTypes,chips,useWorkspaceEntries,conversationEntries,conversation,styles}.ts*`.
- `packages/service/src/{skills,workspaceEntries,messaging}.ts`, `packages/service/test/{skills,workspaces}.test.ts`, `packages/contracts/src/{skills,workspaceEntries,requests}.ts`.
- `.agents/handoffs/2026-11-09-1725-mentions-chips.md` and `.agents/handoffs/2026-11-09-1653-skills-slash.md`.
