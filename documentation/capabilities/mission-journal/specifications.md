# Mission journal

## Problem and outcome

Threads in a mission run on different harnesses and start without each other's history, so they lose track of where the mission stands. Each mission keeps one journal that every thread starts from and keeps current, so any thread, and the user, can tell what was decided and done.

## Agreed behavior

### Content

- A journal has a briefing of where the mission stands, rewritten as the mission changes, and a dated change log only ever added to.
- Each change log entry records its author (a thread, or the user) and its time.
- No one can edit or delete an entry, the user included. A correction is a new entry.

### Size

- The briefing holds at most 2,000 tokens, adjustable in settings. Tokens are estimated the same way on every harness, at about 4 characters per token.
- A rewrite over the limit is refused with its reason, and the thread that wrote it shortens it.
- The change log has no limit.

### Reading

- Every thread in the mission starts with the briefing and the 20 latest entries (see [thread-tree](../thread-tree/specifications.md#opening-a-thread)), and reads older entries with `read_journal`.
- An aside starts with the briefing only.
- `find_missions` matches other missions by their titles and briefings only.

### Updating

- Any thread in the mission may update the journal, except an aside, which informs its parent instead; the parent decides what to record.
- A thread adds an entry when it settles a decision, changes direction, or finishes a piece of work.
- `report_result` asks the thread for an entry, or for an explicit "nothing to record".
- A thread rewrites the briefing only when where the mission stands has changed.
- Every briefing rewrite comes with an entry.

### Parallel updates

- Entries are only ever added, so they never conflict.
- A briefing rewrite names the briefing version it was based on. When another thread rewrote the briefing in the meantime, the rewrite is refused with the current briefing and its version, and the thread merges its change and tries again.

### The user

- The user can rewrite the briefing and add entries in the app. Each change is recorded as an entry by the user.

### When a mission ends

- Ending a mission adds an entry saying how and by whom, for example "Marked done by the user" or "Archived by the user".
- The journal stays readable, and `find_missions` still matches Done and archived missions.
- When the mission continues, its threads update the journal again.

## External contract

Threads use these thread tools (see [0005](../../architecture-decision-record/0005-thread-tools-over-mcp.md)):

| Tool | Purpose | Arguments | Answer |
| --- | --- | --- | --- |
| `read_journal` | Read the mission's journal | Optionally a starting point and a number of entries | The briefing, its version, and those entries |
| `update_journal` | Record a change | An entry; optionally a new briefing and the version it was based on | The new version, or a refusal with the current briefing and version |

## Acceptance and validation

- **Automated, with a fake harness**:
  - a new thread starting with the briefing and the 20 latest entries, and an aside with the briefing only;
  - a briefing over the limit refused;
  - the entry added when a mission ends, and an ended mission still matched by `find_missions`;
  - adding an entry, with its author and time;
  - a briefing rewrite with its entry;
  - a stale rewrite refused with the current briefing, then merged and accepted;
  - `report_result` asking for an entry or "nothing to record";
  - an aside unable to update the journal;
  - entries that cannot be edited or deleted;
  - the user's edits recorded as entries by the user.
- **Human acceptance**: the user follows a mission's journal while 2 threads on different harnesses update it, and edits its briefing.

## Requirements

- [Local data](../../requirements.md): journals stay on the user's computer.

## Dependencies

- [thread-tree](../thread-tree/specifications.md): opens threads, which start from the journal, and asides.
- [thread-messaging](../thread-messaging/specifications.md): carries an aside's report to its parent.

## Exclusions

- Mission states, marking a mission done, and archiving belong to mission-tracking.
- Intel: facts worth keeping beyond where the mission stands belong to scoped-intel.
