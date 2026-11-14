# Scoped intel

## Problem and outcome

Facts, preferences, and decisions learned in one thread are lost to the next, or leak into work where they do not belong. Intel keeps each one at the scope where it applies, so every thread recalls what fits it.

## Agreed behavior

Version 1 serves the installation's owner. In future hosted missions, the sharing toggle governs agents' access to host intel regardless of who triggers a turn. Guests cannot inspect unshared intel, but replies may reveal information from enabled resources (CHG-0018). See the [hosted agreements](../../architecture.md#future-multiplayer-open-architecture-questions).

### Scopes

Each lore entry belongs to one scope.
For ordinary threads, visibility follows this table:

| Scope | Lore available |
| --- | --- |
| Side-quest | Its own, its ancestor side-quests', its quest's, its realm's when present, and global lore |
| Quest | Its own, its realm's when present, and global lore |
| Realm | Its own and global lore |
| Global | Global lore |

- A quest holds its lore on its top thread, making it available throughout the quest tree.
- Lore stays hidden from ancestors and sibling branches unless the owner approves [widening](#widening-and-narrowing).
- Realm membership determines realm lore, even when a side-quest works in another workspace.
  A quest in the Borderlands has no realm lore; a Realm without a workspace still shares lore across its quests.
- Guildmaster can search and read lore at every scope for the owner's requests (CHG-0132).
  This exception leaves ordinary threads' access unchanged and does not copy lore into broader scopes.
  Guildmaster follows the save, change, widening, and deletion rules below.
- Quest moves follow [quest placement and moves](../mission-tracking/specifications.md#quest-placement-and-moves).

Realm scopes and moves (CHG-0130), visibility across scopes (CHG-0131), and Guildmaster's access exception (CHG-0132) are agreed; implementation and verification remain pending.

### Lookup

- A search looks in the thread first, then in each thread above it, then in the quest's realm if it has one, then globally.
- When two intels conflict, the one from the most specific scope wins.

### Kinds

Each intel has a kind, which sets how fast it fades when no thread uses it. The starting half-lives below are adjustable in settings.

| Kind | Example | Half-life |
| --- | --- | --- |
| Rule | "always run the tests before a commit" | none: never fades |
| Preference | "prefers Bun" | 90 days |
| Decision | "the service uses Effect" | 45 days |
| Fact | "the relay runs on the user's Cloudflare account" | 45 days |
| Temporary | "the provider's API is flaky this week" | 3 days |

- A thread picks the kind when it saves an intel. A rule the user gives in a chat is saved as a rule.
- The user can pin any intel. A pinned intel never fades, whatever its kind.

### Recall

- A new thread starts with the intel in scope for it, like a memory:
  - thread, mission, and realm intel in full;
  - global intel as an index of one line per active intel (its identifier, kind, and a short summary), followed by how many dormant intels are not listed. The thread reads a global intel in full through `search_intel`.
- The index is ordered so that a new intel is added at its end, and the lines before it stay unchanged.
- The user is warned before a thread starts when its starting context is too large (see [thread-tree](../thread-tree/specifications.md#opening-a-thread)).

### Fading

- An intel's strength falls by half over its kind's half-life since it was last used.
- Each use slows its fading: the half-life grows with the number of uses, as `half-life × (1 + log2(1 + uses))`.
- Only real use counts: a thread reading the intel through `search_intel`, or saying it relied on it. Being in a thread's context, in the index or in full, is not a use.
- Below a strength of 0.15 an intel becomes **dormant**: it leaves the index and the starting context, and stays findable through `search_intel`. A use makes it active again.
- Below a strength of 0.05 an intel becomes **archived**: it leaves search too, and stays in the intel panel's Archived filter, where the user can restore it.
- Fading never deletes an intel. Only the user, or a thread under the rules of [Correcting and deleting](#correcting-and-deleting), deletes one.

### Saving

- Before saving, a thread checks whether there is anything worth keeping. Saving nothing is better than saving a vague or forced intel.
- A thread chooses the narrowest scope that fits.
- It saves thread and realm intel on its own, and shows each save in the thread.
- It saves global intel only after the user's approval.
- An intel holds at most 200 tokens, estimated as for the [journal](../mission-journal/specifications.md#size), so one intel holds one fact.
- A rule the user gives in a chat, such as "always run the tests before a commit", is saved as an intel without the user asking. Instructions are only what the user writes in settings.
- Each intel records where it came from: the thread that saved it and, when there is one, the journal entry or message it rests on. The intel holds one fact; the journal holds the story.

### Duplicates

- Before a save, the service finds the closest intels in the same scope and the scopes above it.
- When one says the same thing, or an older version of it, the save becomes a replacement: the new text replaces the old intel, which keeps its identifier and its uses. When in doubt, the save stays a new intel.
- A global replacement needs the user's approval, like any global change; its approval card shows the old and the new text.

### Correcting and deleting

- The user can edit or delete any intel.
- A thread can correct or delete thread and realm intels on its own, and shows each change in the thread.
  It corrects or deletes a global intel only after the user's approval.

### History and undo

- Every save, replacement, change, widening, deletion, and fading step is recorded with who or what made it and when.
- The intel panel shows an intel's history, including which intel replaced which, and the user can undo any change. Undoing a deletion restores the intel. Deleted intel stays listed under the panel's Deleted filter, where its deletion can be undone.
- The agreed [Start afresh flow for an archived realm](../mission-tracking/specifications.md#reusing-an-archived-realms-folder) uses this same deletion and recovery for realm-level lore only (CHG-0271; not implemented). It is not a permanent purge and does not delete global or quest-scoped lore.

### Widening and narrowing

- A thread can propose moving an intel to a wider scope when it is not specific to where it was saved, for example a global convention or a preference of the user. The move needs the user's approval.
- When the same intel is saved separately in two or more realms, the service proposes one global intel in their place.
- When a global intel has been used only in one realm for its whole half-life, the service proposes moving it to that realm.
- Each proposal waits in the intel panel for the user's approval and changes nothing before it.

### Size warning

- No limit on the amount of intel refuses a save.
- The thread's intel icon turns red when the intel in scope takes more than 10% of the chosen model's context window, adjustable in settings.
- Hovering or clicking the icon shows how much of the context window the intel takes, and opens the intel panel.

### Intel panel

- The panel lists each intel with its text, kind, scope, strength, uses, the thread that saved it, and when. It filters by scope and by state: active, dormant, archived, pinned.
- The user can edit, pin, delete, or restore any intel there.
- **Tidy up intel** starts from the panel. A thread proposes a list of changes: keep, shorten, merge, pin, or delete. Nothing changes until the user approves all of them or each one. Threads never start it on their own.
- The user can make Tidy up intel a routine, for example weekly. The routine prepares the proposal and waits for the user's approval; it applies nothing on its own.

## External contract

Threads use these thread tools (see [0005](../../architecture-decision-record/0005-thread-tools-over-mcp.md)):

| Tool | Purpose | Arguments | Answer |
| --- | --- | --- | --- |
| `search_intel` | Search the active and dormant intel in scope, or read intels by identifier; counts as a use of each intel returned | A query or identifiers; optionally a scope | The matching intels, best match first, each with its identifier, scope, kind, and text |
| `save_intel` | Save an intel | The text, a scope, and a kind; optionally the journal entry it rests on | The new identifier; "replaces" with the replaced identifier; or "awaiting approval" for a global save or replacement |
| `relied_on_intel` | Say intels shaped the thread's work; counts as a use of each | Identifiers | How many uses were counted, and which identifiers were refused |
| `update_intel` | Correct or widen an intel | An identifier, and new text or a wider scope or both | Done, or "awaiting approval" for widening or a global change |
| `forget_intel` | Delete an intel | An identifier | Done, or "awaiting approval" for a global intel |

Search ranks the closest match first and ranks higher an intel matching a word found in three intels or fewer, such as a name.

## Acceptance and validation

- **Automated, with a fake harness**:
  - side-quest lore visible to that thread and its descendants, hidden from ordinary ancestor and sibling threads, with Guildmaster's read exception checked separately;
  - quest lore visible throughout its tree but not to its realm or another quest;
  - realm lore visible throughout its quests, with global lore available at every scope and narrower lore winning conflicts;
  - a side-quest working in another workspace retaining its quest's realm lore without acquiring the other workspace's realm lore;
  - a new thread starting with thread, quest, and realm intel in full, the global index, and the count of dormant intels;
  - a new global intel added at the end of the index, leaving the lines before it unchanged;
  - the lookup order, and the most specific intel winning a conflict;
  - fading by kind on a fake clock: a temporary intel dormant after 30 days of unrelated turns, a rule and a pinned intel never fading, a dormant intel found by search and active again after use, an archived intel restored from the panel;
  - a greeting, or an intel only present in context, not counting as a use; `search_intel` counting as one and slowing fading;
  - a near-duplicate save becoming a replacement, a global replacement awaiting approval with the old and new text, and an unclear match saved as a new intel;
  - widening proposed for the same intel in two realms, narrowing proposed for a global intel used in one realm, neither applied before approval;
  - undo of a change, a replacement, and a deletion;
  - search ranking the closest match first and boosting rare words;
  - thread and realm saves without approval, global saves awaiting it;
  - an intel over 200 tokens refused;
  - a rule given in a chat saved as an intel;
  - a thread correcting and deleting thread and realm intels, and awaiting approval for global ones;
  - widening awaiting approval;
  - the intel icon turning red past 10% of the chosen model's context window, and not on a model with a larger window;
  - Tidy up intel changing nothing before approval, then applying all or each approved change, from the panel and from a routine.
- **Human acceptance**: the user tells a thread "always run the tests before a commit" and sees it saved as a rule, sees that intel in a thread of another quest in the same realm, approves a global save, sees a global intel as an index line that a thread reads in full, then makes the intel icon turn red, runs Tidy up intel, and undoes one of its changes.

## Requirements

- [Local data](../../requirements.md): intel stays on the user's computer.
- [Approval per action](../../requirements.md): each global save, change, or widening is approved on its own, unless the user granted a standing permission for it.

## Dependencies

- [thread-tree](../thread-tree/specifications.md): gives each new thread the intel in scope, and warns when its starting context is too large.
- [mission-tracking](../mission-tracking/specifications.md#quest-placement-and-moves): quest placement and moves between realms.
- [mission-coordination](../mission-coordination/specifications.md#what-guildmaster-does-itself): Guildmaster's app-wide role.
- [action-approval](../action-approval/specifications.md): carries the approvals for global intel, replacements, widening, and narrowing.
- Routines: run a scheduled Tidy up intel.

## Sources of the ideas

Fading by kind, the index in context, replacing duplicates, and the tests for fading come from Rerun; honest skips, recording an intel's origin, rare-word ranking, and undo come from souls.house's hearth guide. See [inspirations](../../inspirations.md).

## Exclusions

- Where the mission stands belongs to the [journal](../mission-journal/specifications.md).
- Instructions, which only the user writes, in settings.
- Semantic search; full-text search comes first (see [0002](../../architecture-decision-record/0002-one-local-service-owns-all-data.md)).
