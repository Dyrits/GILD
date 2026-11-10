# Conversation terminal

Authorized by the owner on 2026-11-10, with Delta's inline terminal as the reference.
The owner confirmed that shell output belongs in the Companion's context and clarified that the live terminal appears as a message bubble in the conversation, rather than inside the composer.

## Behavior

- In a desktop conversation, typing `!` on an empty composer line opens the owner's default login shell as an interactive owner-message bubble in the conversation, without triggering the Companion.
- An exclamation mark in ordinary text stays text; paste and input composition do not trigger a shell.
- With a workspace-backed Realm, the starting folder is that Realm's root, including the Realm selected in the Guild Hall.
- For a Free Realm or realmless quest, the terminal starts in the owner's home folder.
  Agents without a workspace still use the quest's [scratch folder](../workspace-attachment/specifications.md#no-workspace).
- The terminal accepts interactive input, control keys, and resizing through a pseudo-terminal.
- Hide keeps the shell running; Show or `!` brings it back.
- Send freezes the recent rendered output as a terminal block in the owner's message and includes that same output in the persisted text supplied to the harness.
- The owner can add text beneath the terminal or send the terminal alone.
- The shell continues after sending; another `!` brings that same shell back into an interactive bubble for the next snapshot.
- Close shell ends the process and removes it from the draft; an exited shell keeps its output and offers New shell.
- The desktop window owns these temporary processes and ends them when it closes.
- Phone and standalone browser clients cannot create or control a shell.

The Free Realm fallback was agreed on 2026-11-10 (CHG-0131); implementation and verification remain pending.

## Bounds

One terminal per conversation and starting folder, with at most 32 retained sessions in a desktop window.
The replay buffer holds at most 200,000 characters; the emulator holds 3,000 scrollback lines and a sent snapshot includes at most the latest 20,000 rendered characters, with an omission marker when trimmed.
Snapshots show visible output rather than hidden password keystrokes or a complete shell audit log.
Sessions do not survive quitting Gild; sent snapshots remain in the conversation.
Multiple terminal blocks, background-terminal selection, and Delta's shell-code prefill are outside this increment.

## Verification

`apps/desktop/test/terminals.test.ts` checks real shells in home and realm folders, session isolation, continued shell state, exit output, and explicit restart.
`apps/app/test/terminal/terminalSnapshot.test.ts` checks context serialization, safe Markdown fences, wrapped lines, limits, and the sent block's display data.
The isolated Electron drive in `documentation/verification/2026-11-10-bang-terminal/drive.py` checks the owner interaction through the desktop preload and a fake harness.
