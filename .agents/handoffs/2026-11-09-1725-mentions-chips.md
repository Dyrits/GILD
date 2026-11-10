# Handoff: @ mentions of realm files and chips inside the message box

Supersedes: `2026-11-09-1653-skills-slash.md`
Workspace: `/Users/dgerrits/Codelab/Dyrits/CANOPY`, Gild repository, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

The owner types `@` in a message box and picks a file or folder of the current realm (workspace); it does nothing outside a realm. A chosen `@path` or `/skill` is a chip with an icon inside the text, as in OpenBot (the owner's screenshot: "Use the [architect] skill.").
Done means the owner has seen the chips and the `@` list in the running window and accepted them.

## State

- **Verified (`bun run test`, `bun run typecheck`, `bun run check`, `git diff --check`, run just before this file was written):** 422 tests pass, 10 skipped; typecheck, lint, and whitespace pass. `cd apps/app && bunx expo export --platform web` bundles.
- **Verified in Chrome on the editor alone** (a throwaway page bundled with `bun build`, driven with Playwright, not committed): typing `/arch` then Tab gives an inline chip with the puzzle icon; a second chip (`@src/`) in the same sentence; the plain text read back is `Use the /architect skill. See @src/ ok`; Backspace removes a chip whole; Shift+Enter makes a newline.
- **Not observed in the running window:** the chips in Post a quest, the conversation, and the side-quest form; the `@` list; caret movement across a chip; the sidebar rail change below. `/verify` was not run as a proof file; no `documentation/verification/` entry exists for this work.
- **Service (tested):** `ListWorkspaceEntries { workspacePath, query }` (`packages/contracts/src/{requests,workspaceEntries}.ts`, `packages/service/src/workspaceEntries.ts`) lists up to 8 files and folders, best match first (name starts with the query, path starts with it, name contains it, path contains it); empty query lists the top level; `git ls-files` (tracked and untracked, not ignored) in a git folder, otherwise a walk skipping `.git` and `node_modules`, 20,000 files at most; folders end with `/`. It accepts any existing folder, not only registered workspaces (a folder chosen for a first quest is not a workspace until that quest starts). Three tests in `packages/service/test/workspaces.test.ts`; `mentionTokensOf` has one in `skills.test.ts`.
- **App, message box (read, typechecked, partly driven):** `Composer` in `apps/app/src/controls.tsx` now uses `ChipEditor`. On the web (`chipEditor.web.tsx`) it is an editable `div` kept by hand (not by React): chips are non-editable spans built with the DOM, the message is read back as plain text with each chip as its token (`/name`, `@path`), and the trigger before the caret feeds the list. Elsewhere (`chipEditor.tsx`) it is a `TextInput` that writes the token in. Shared types in `chipEditorTypes.ts`. The list shows up to 6 skills or 8 paths; arrows, Tab, Enter, or a click choose. `@` offers nothing when the composer has no workspace path (`mentions.workspacePath` null).
- **App, conversation (read, typechecked):** `chips.tsx` draws the owner's messages with chips (icon, name without `/` or `@`): known skills, and `@paths` that the service finds in the thread's workspace (`useMentionKinds`, one `ListWorkspaceEntries` call per path, cached while the app runs). `EntryView` takes `skills` and `workspacePath`.
- **Sidebar (read, typechecked):** in the collapsed rail the "Realms" and "Quests" rules show only when their group has items (`apps/app/src/sidebar.tsx`).
- **Known quirk (observed in the Chrome test):** after deleting the space after a chip the serialized text can end with a `\n`; the composer trims before sending, so it has no effect on what is sent.
- **Recorded:** CHG-0077 in `documentation/changelog.md` and a "Naming files and folders with @" section in `documentation/capabilities/workspace-attachment/specifications.md`.

## Decisions

- Chips live inside the text on the web through an editable element, at the owner's choice after a text-indent overlay and a row of chips above the field were each rejected ("it should be part of the text in the input"). Native builds keep plain tokens.
- The message goes to the thread as plain text; no pointer to the file is added, since the thread works in the workspace folder. Skills keep the pointer line added by `withSkillInstructions` (previous handoff).
- `@` follows `.gitignore` in git folders; no hidden-file or size rules beyond that.
- A chip chosen from a list is the only way to get a chip in the box; a token typed by hand stays plain text.
- The listing accepts any existing folder (no registered-workspace check): attaching a folder already accepts any folder the owner chose (CHG-0035), so the check added no protection.

## Next

1. Start the window on a throwaway database with the fake harness (never on the owner's data) and check: the `@` and `/` lists in Post a quest, in a quest's composer, and in the side-quest form; chips inside the text and with the caret and arrow keys; Backspace; Enter to send; the conversation showing chips; no list outside a realm; the collapsed rail with no realm or quest. Record a proof under `documentation/verification/`.
2. Ask the owner what they saw and adjust the chip look (height 18, icon size 12, spacing).
3. Decide with the owner whether a typed-by-hand `/skill` or `@path` should also become a chip, and whether `@` should list files of a folder the thread was not started in.

## Open questions

- Should the native phone build get inline chips too? It needs a different editor; the owner decides when the phone app is built.
- Should plugin skills be listed, and should skills be shown per thread (carried over from the previous handoff)?
- Do the timing-sensitive intel, tracking, and harness tests fail on a clean `main` under a full run (carried over; not seen in the last full run)?

## Sources

- `AGENTS.md`, `documentation/conventions.md`, `documentation/capabilities/workspace-attachment/specifications.md`, `documentation/capabilities/tool-and-skill-loading/specifications.md`.
- `documentation/changelog.md` (CHG-0077).
- `packages/service/src/{workspaceEntries,skills,messaging}.ts`, `packages/service/test/{workspaces,skills}.test.ts`, `packages/contracts/src/{requests,workspaceEntries,skills}.ts`.
- `apps/app/src/{controls,chipEditor,chipEditorTypes,chips,useWorkspaceEntries,conversationEntries,conversation,dashboard,threadTree,sidebar,styles}.ts*` and `apps/app/src/chipEditor.web.tsx`.
- `.agents/handoffs/2026-11-09-1653-skills-slash.md`.
