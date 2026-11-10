# One side panel, grouped as Companions, Knows, and Does (CHG-0109, CHG-0111)

Verdict: observed in the running window on the fake harness; the look awaits the owner.

| # | Claim | Proof | Status |
| --- | --- | --- | --- |
| 1 | One panel at the window's edge holds the quest heading, Companions, Knows, and Does; no tabs, no "Thread panel" link | [quest](2026-11-10-one-side-panel/1-quest.png), [first merge](2026-11-10-one-side-panel/0-first-merge.png) | observed |
| 2 | Skills is one row ("52 available") | [quest](2026-11-10-one-side-panel/1-quest.png) | observed; its expanded block not pressed |
| 3 | The Backup companions row opens a menu where a backup is added with harness, model, and effort pickers; the panel then counts 1 | [menu](2026-11-10-one-side-panel/2-backups.png) | observed |
| 4 | A backup takes over a failed turn, with the "Fell back to" line | `packages/service/test/backups.test.ts` | proven on the fake harness |
| 5 | A side-quest's panel is headed by its own title, has a Quest row that opens its quest, and its own Mark as done, which leaves the quest Resting | [side-quest](2026-11-10-one-side-panel/4-sidequest.png), [after](2026-11-10-one-side-panel/6-sidequest-done.png), `backups.test.ts` ("marking a side-quest done") | observed and proven |
| 6 | The panel shows in a narrow window | [narrow](2026-11-10-one-side-panel/7-narrow.png) | observed |

## Reproduce

Run `drive.py` as in the Guildmaster record's "Reproduce" (copy `2026-11-10-guildmaster/serve.ts.txt` to `packages/service/scratch-serve.ts`, add an `OpenThread` under the seeded quest, export the app, serve it on 8099), with `root` set to the scratch folder.

Not checked: the order of backups changing under Move up and Move down; a live harness failing and falling back; the backup menu in a narrow window.
