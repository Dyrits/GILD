# Scoped intel

## Problem and outcome

Facts, preferences, and decisions learned in one thread are lost to the next, or leak into work where they do not belong. Intel keeps each one at the scope where it applies, so every thread recalls what fits it.

## Agreed behavior

Version 1 serves the installation's owner. In future hosted missions, the sharing toggle governs agents' access to host intel regardless of who triggers a turn. Guests cannot inspect unshared intel, but replies may reveal information from enabled resources (CHG-0018). See the [hosted agreements](../../architecture.md#future-multiplayer-open-architecture-questions).

### Scopes

- An intel belongs to one intel scope: a thread (and the threads beneath it), a workspace, or global.
- Intel saved on a mission's top thread applies to the whole mission.

### Lookup

- A search looks in the thread first, then in each thread above it, then in the thread's workspace, then globally.
- When two intels conflict, the one from the most specific scope wins.

### Recall

- A new thread starts with all the intel in scope for it, like a memory.
- The user is warned before a thread starts when its starting context is too large (see [thread-tree](../thread-tree/specifications.md#opening-a-thread)).

### Saving

- A thread chooses the narrowest scope that fits.
- It saves thread and workspace intel on its own, and shows each save in the thread.
- It saves global intel only after the user's approval.
- An intel holds at most 200 tokens, estimated as for the [journal](../mission-journal/specifications.md#size), so one intel holds one fact.
- A rule the user gives in a chat, such as "always run the tests before a commit", is saved as an intel without the user asking. Instructions are only what the user writes in settings.

### Correcting and deleting

- The user can edit or delete any intel.
- A thread can correct or delete thread and workspace intels on its own, and shows each change in the thread. It corrects or deletes a global intel only after the user's approval.

### Widening

- A thread can propose moving an intel to a wider scope when it is not specific to where it was saved, for example a global convention or a preference of the user. The move needs the user's approval.

### Size warning

- No limit on the amount of intel refuses a save.
- The thread's intel icon turns red when the intel in scope takes more than 10% of the chosen model's context window, adjustable in settings.
- Hovering or clicking the icon shows how much of the context window the intel takes, and opens the intel panel.

### Intel panel

- The panel lists each intel with its text, its scope, the thread that saved it, and when. It filters by scope.
- The user can edit or delete any intel there.
- **Tidy up intel** starts from the panel. A thread proposes a list of changes: keep, shorten, merge, or delete. Nothing changes until the user approves all of them or each one. Threads never start it on their own.

## External contract

Threads use these thread tools (see [0005](../../architecture-decision-record/0005-thread-tools-over-mcp.md)):

| Tool | Purpose | Arguments | Answer |
| --- | --- | --- | --- |
| `search_intel` | Search the intel in scope | A query; optionally a scope | The matching intels, each with its identifier, scope, and text |
| `save_intel` | Save an intel | The text and a scope | The new identifier, or "awaiting approval" for a global save |
| `update_intel` | Correct or widen an intel | An identifier, and new text or a wider scope or both | Done, or "awaiting approval" for widening or a global change |
| `forget_intel` | Delete an intel | An identifier | Done, or "awaiting approval" for a global intel |

## Acceptance and validation

- **Automated, with a fake harness**:
  - a new thread starting with all the intel in scope;
  - the lookup order, and the most specific intel winning a conflict;
  - thread and workspace saves without approval, global saves awaiting it;
  - an intel over 200 tokens refused;
  - a rule given in a chat saved as an intel;
  - a thread correcting and deleting thread and workspace intels, and awaiting approval for global ones;
  - widening awaiting approval;
  - the intel icon turning red past 10% of the chosen model's context window, and not on a model with a larger window;
  - Tidy up intel changing nothing before approval, then applying all or each approved change.
- **Human acceptance**: the user tells a thread "always run the tests before a commit" and sees it saved as an intel, sees that intel in a thread of another mission in the same workspace, approves a global save, then makes the intel icon turn red and runs Tidy up intel.

## Requirements

- [Local data](../../requirements.md): intel stays on the user's computer.
- [Approval per action](../../requirements.md): each global save, change, or widening is approved on its own, unless the user granted a standing permission for it.

## Dependencies

- [thread-tree](../thread-tree/specifications.md): gives each new thread the intel in scope, and warns when its starting context is too large.
- [workspace-attachment](../workspace-attachment/specifications.md): decides which workspace's intel a thread sees.
- [action-approval](../action-approval/specifications.md): carries the approvals for global intel and widening.

## Exclusions

- Where the mission stands belongs to the [journal](../mission-journal/specifications.md).
- Instructions, which only the user writes, in settings.
- Semantic search; full-text search comes first (see [0002](../../architecture-decision-record/0002-one-local-service-owns-all-data.md)).
