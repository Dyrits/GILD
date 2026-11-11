# Workspace attachment

## Problem and outcome

Agents work on files: a repository to fix, a folder of documents to sort.
Each thread has to know which folder it works in, what intel, permissions, skills, and instructions go with that folder, and must not wander into folders the user never offered.
Attaching each thread to one workspace from folders the user allowed or from a repository Iskios clones gives every thread the right place and context, from the computer or the phone.
The owner can correct a wrong workspace by moving a whole quest when none of its threads is running.

## Agreed behavior

### Choosing a workspace

- A mission's or thread's initial workspace is chosen before it starts, in its settings: by choosing a folder, by giving a git repository link, or none.
  A new thread copies its opener's workspace unless the opener chooses another or none (see [thread-tree](../thread-tree/specifications.md#opening-a-thread)).
  Moving the whole quest can change these attachments later as specified below.
- On the desktop, **Choose folder…** opens the system's own folder dialog (Finder on macOS, Explorer on Windows), with its New Folder and hidden-file controls; any folder the user can open may be chosen (CHG-0035).
- The phone browses the computer's folders in Iskios's own browser, limited to the **browsable roots** in Settings. These start with the user's home folder; **Add root** adds others, for example `/Volumes/Drive/Code`. The browser has **New folder**. The browser, with **Show hidden**, and the roots are built and kept for phone browsing; the desktop does not show them.
- A folder becomes a workspace the first time it is chosen; there is no separate setup. Workspaces are listed on the **Workspaces** page in Settings, where the user can rename them.
- A thread works in the workspace chosen for it.
  A workspace inside another stays part of the outer folder for the outer workspace's threads, but its standing permissions apply only to threads attached to it.

### Cloning a repository

- Settings hold a **clone location**, `~/Code` by default. A repository given as a link is cloned there, into a folder named after the repository, and becomes a workspace.
- When the user gives Control a repository link, for example "let's work on this repo: https://github.com/…", Control clones it and proposes the mission in it, as a card the user opens.
- A repository already cloned by Iskios is reused as the same workspace, never cloned twice.
- Cloning uses the git sign-in already set up on the computer. A clone that fails (no access, no network) is refused with git's reason shown in the thread.

### Threads choosing workspaces

- A thread can open a thread in another workspace, choose a new folder, or clone a repository without asking, when the folder is under a browsable root or the clone goes to the clone location. Anything else is refused with the reason. Example: a thread in an app's repository opens a thread in the library the app depends on.

### No workspace

- A thread with no workspace runs in its mission's **scratch folder**, `~/.iskios/missions/<mission>/`, shared by all the mission's threads with no workspace, never in the user's home folder.
- Archiving the mission keeps its scratch folder; deleting the mission deletes it.
- Standing permissions for a thread with no workspace apply to its mission (see [action-approval](../action-approval/specifications.md#standing-permissions)).

### Naming files and folders with @

- Typing `@` at the start of a word in a message box lists up to 8 files and folders of the workspace the message is written in, matched on their name or path; Tab, Enter, or a click completes the path, relative to the workspace, a folder's ending with a slash so the list goes on inside it. The text stays as typed and reaches the thread unchanged. Once chosen, a path shows as a chip with a file or folder icon in the owner's messages (a skill likewise with a puzzle piece), and, in the message box, as a chip inside the text where it was chosen, removed like a character, and sent as plain text.
- In a git workspace the list leaves out what `.gitignore` ignores; otherwise it skips `.git` and `node_modules`.
- With no workspace (a quest in its scratch folder) an `@` offers nothing.

### What a workspace gives its threads

- Its instructions, from the folder's own `AGENTS.md` and `CLAUDE.md`, and its skills from `.agents`, `.claude`, and equivalent supported harness folders. Workspace MCP servers are configured in Iskios. A harness that does not read the selected instructions itself gets them in its starting context. See [tool-and-skill-loading](../tool-and-skill-loading/specifications.md).
- Its standing permissions (see [action-approval](../action-approval/specifications.md)), kept in Iskios's own data, never written into the folder, so they survive a relocation or a new clone.
- Lore access follows [lore scopes](../scoped-intel/specifications.md#scopes), independently of the thread's working folder.
- Editing inside it without asking; editing outside it asks.
- Each thread's starting context names its workspace and path, or says it has none.

### Own copy

- Opening a thread in a git workspace offers **Own copy**, off by default. The thread then works in its own git worktree at `~/.iskios/worktrees/<workspace>/<thread>/`, on a new branch `mission/<mission-title>-<short id>` started from the workspace's current branch.
- Threads opened beneath it share its copy, unless they ask for their own.
- When the thread is Done, it reports its branch, and the thread shows **Merge into `<branch>`**. Merging is one button. On conflicts, the thread first merges the workspace's branch into its own copy and resolves them there, then merges. A merge that still cannot happen, for example because the workspace has uncommitted changes, is refused with the reason.
- Merging into the workspace's branch is local and asks no approval; pushing still does.
- Archiving the mission deletes its worktree folders and keeps their branches.

### Changing a thread's workspace

A started thread's workspace can change through a [whole-quest move](../mission-tracking/specifications.md#quest-placement-and-moves), which defines the running-thread check, destination attachments, and artifact preservation (CHG-0130; implementation pending).
[Relocating a workspace](#missing-folder) changes the folder's location while preserving the workspace's identity.

### Missing folder

- When a workspace's folder no longer exists, its threads and the Workspaces page say so.
- A thread about to start a turn in a missing workspace goes to Attention with **Retry**, **Relocate** (choose the folder's new location), and, for a workspace Iskios cloned, **Clone again**, which warns that changes never pushed are lost.
- Relocating keeps the workspace's missions, intel, and standing permissions.

### Hiding and deleting a workspace

- The Workspaces page offers **Hide** and **Delete permanently**. Neither touches the folder.
- **Hide** hides the workspace and its missions from the interface and keeps everything. Choosing the same folder again brings them all back.
- **Delete permanently**, after a confirmation that counts what goes, erases its missions, intel, and standing permissions.
- Neither is possible while one of its threads is running.

## External contract

Threads use these thread tools in addition to `open_thread`, whose workspace argument takes a workspace, a folder path, or none (see [0005](../../architecture-decision-record/0005-thread-tools-over-mcp.md)):

| Tool | Purpose | Arguments | Answer |
| --- | --- | --- | --- |
| `list_workspaces` | Find a workspace by name | Optionally a name to match | Each matching workspace's name, path, whether it is a git repository, and whether its folder exists |
| `clone_repository` | Clone a repository into the clone location | A repository link | The workspace, new or reused, or a refusal and its reason |

`open_thread` also takes **Own copy** for a git workspace.

## Acceptance and validation

- **Automated, with a fake harness and temporary folders**:
  - a folder becoming a workspace when first chosen, and listed on the Workspaces page;
  - choosing any folder through the desktop's system dialog, and phone browsing limited to the browsable roots;
  - a repository cloned into the clone location and reused when given again; a failed clone refused with git's reason;
  - a thread opening a thread in a folder under a root or cloning without asking, and refused outside the roots;
  - threads with no workspace sharing their mission's scratch folder, kept on archive and deleted with the mission;
  - workspace instructions and skills reaching a harness that does not read the files itself;
  - the starting context naming the workspace;
  - nested workspaces keeping their own standing permissions, with lore access determined separately by quest realm membership;
  - a missing folder sending a thread to Attention with Retry, Relocate, and Clone again only for a cloned workspace; relocating keeping intel and permissions;
  - Hide and re-adding restoring missions, intel, and permissions; Delete permanently erasing them; both refused while a thread runs; the folder untouched by either;
  - Own copy creating a worktree on its branch, shared by threads beneath, merged with one button, conflicts resolved by the thread in its copy, a blocked merge refused with its reason, and the worktree folder deleted on archive with its branch kept.
- **Human acceptance**: from the phone web app, the user starts a mission by browsing to a folder on the computer; from the desktop, sends Control a repository link and sees the mission open in the clone; opens two threads with Own copy in the same repository, lets both finish, and merges both; unplugs the drive holding a workspace, sees the thread ask, plugs it back, and chooses Retry.

## Requirements

- [Local data](../../requirements.md): workspace settings and realm lore stay in Iskios's data on the computer; browsing from the phone travels only over the encrypted connection.
- [Approval per action](../../requirements.md): a standing permission applies in its workspace, or in its mission with no workspace.

## Dependencies

- [thread-tree](../thread-tree/specifications.md): opening threads with a workspace, and the Attention state.
- [mission-tracking](../mission-tracking/specifications.md): choosing the workspace when starting a mission, and filtering by it.
- [mission-coordination](../mission-coordination/specifications.md): Control picking or cloning the workspace.
- [scoped-intel](../scoped-intel/specifications.md#scopes): lore visibility, separate from working-folder attachment.
- [action-approval](../action-approval/specifications.md): standing permissions per workspace, and approval before a push.
- **tool-and-skill-loading**: loading the workspace's MCP servers and skills.
- **device-pairing**: browsing the computer's folders from the phone.

## Exclusions

- Changing only one existing thread's workspace independently of a whole-quest move, except relocating its workspace.
- Several workspaces for one thread.
- A `.iskios` folder inside workspaces.
- Folders outside the browsable roots, when browsing from the phone or opened by a thread.
- A terminal; possibly later as a developer option.

## Technical notes

- Own copy uses `git worktree`; the merge runs in the workspace's folder.
- Zed's DeltaDB, version control for agent edits and conversations, could replace own copies if it is published as open source; it is not as of 2026-11-04.
