#!/bin/sh
# Breaks one batch 9 (mission tracking) rule at a time in a disposable worktree and runs the checks; each must fail.
# Usage: mutations.sh <worktree with node_modules linked>
set -u
W=$1
mutate() {
  name=$1 file=$2 from=$3 to=$4
  cp "$W/$file" /tmp/om-mutation-backup
  python3 -c 'import sys; p,a,b=sys.argv[1:4]; s=open(p).read(); assert a in s, a; open(p,"w").write(s.replace(a,b,1))' "$W/$file" "$from" "$to"
  printf '%s: ' "$name"
  (cd "$W" && bun run test 2>&1 | grep -E "Tests ")
  cp /tmp/om-mutation-backup "$W/$file"
}
S=packages/service/src
mutate "M1 urgency order swapped" $S/missions.ts '["Attention", "Failed", "Running", "Waiting", "Idle"]' '["Running", "Attention", "Failed", "Waiting", "Idle"]'
mutate "M2 inactivity a day late" $S/missions.ts 'settings.inactivityDays * day' '(settings.inactivityDays + 1) * day'
mutate "M3 dismissal ignored" $S/missions.ts 'Math.max(row.lastActivityAt, row.inactivityDismissedAt ?? 0)' 'row.lastActivityAt'
mutate "M4 child result asks Mark as done" $S/tree.ts 'if (thread.parentId === null)
      yield* sql`UPDATE missions SET is_asking_done = 1' 'if (true)
      yield* sql`UPDATE missions SET is_asking_done = 1'
mutate "M5 working threads not stopped" $S/ending.ts 'yield* haltThreads(ids, "Stopped");' ''
mutate "M6 stale ending accepted" $S/ending.ts 'if (JSON.stringify(ids) !== snapshot) {' 'if (false) {'
mutate "M7 auto-archive ignores the setting" $S/ending.ts 'settings.shouldAutoArchive ? archiveDueMissions' 'true ? archiveDueMissions'
mutate "M8 writing keeps the ending" $S/messaging.ts 'SET ending = NULL WHERE id = ${thread.missionId}' 'SET ending = ending WHERE id = ${thread.missionId}'
mutate "M9 rename does not lock the title" $S/titles.ts 'if (mission.isTitleByUser === 1)' 'if (false)'
mutate "M10 any thread names the mission" $S/titles.ts 'WHERE top_thread_id = ${threadId}' 'WHERE id = (SELECT mission_id FROM threads WHERE id = ${threadId})'
mutate "M11 attention not first" $S/missions.ts 'missions: [...first, ...missions.filter' 'missions: [...missions.filter'
mutate "M12 briefing not searched" $S/missions.ts "OR instr(lower(COALESCE(j.briefing, '')), \${search}) > 0" ""
mutate "M13 choices not saved" $S/missions.ts 'yield* saveStartChoices({ effort, model, workspacePath });' ''
mutate "M14 no hourly change" $S/ending.ts 'Effect.andThen(changes.publish),' ''
mutate "M15 reopen entry missing" $S/ending.ts 'yield* updateJournal(missionId, { kind: "user" }, entries.Reopened, null);' ''
(cd "$W" && printf 'restored: ' && bun run test 2>&1 | grep -E "Tests ")
