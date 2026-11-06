#!/bin/sh
# Breaks one batch 8 (mission journal) rule at a time in a disposable worktree and runs the checks; each must fail.
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
mutate "M1 limit off by one" $S/journal.ts 'if (tokens > briefingLimit) {' 'if (tokens >= briefingLimit) {'
mutate "M2 stale rewrite accepted" $S/journal.ts 'if (rewrite.basedOn !== current.version) {' 'if (rewrite.basedOn === null) {'
mutate "M3 empty entry accepted" $S/journal.ts 'if (entry.trim() === "") return refuse(' 'if (entry === "\0") return refuse('
mutate "M4 token estimate per 3 characters" $S/journal.ts 'Math.ceil(text.length / 4)' 'Math.ceil(text.length / 3)'
mutate "M5 starting context with 19 entries" $S/journal.ts 'listEntries(missionId, null, latestEntryCount);' 'listEntries(missionId, null, latestEntryCount - 1);'
mutate "M6 opener messages from before the entry" $S/journal.ts 'AND sent_at >= ${since}' 'AND sent_at >= 0'
mutate "M7 opener messages left out" $S/journal.ts '...(openerMessages === null' '...(true'
mutate "M8 result entry not recorded" $S/tree.ts 'if (!isNothingToRecord(journal)) {' 'if (false) {'
mutate "M9 entries editable" $S/store.ts "BEGIN SELECT RAISE(ABORT, 'Journal entries cannot be edited.'); END" "BEGIN SELECT 1; END"
mutate "M10 owner entry by a thread" $S/service.ts 'updateJournal(add.missionId, { kind: "user" }, text, null)' 'updateJournal(add.missionId, { kind: "thread", threadId: "" }, text, null)'
mutate "M11 owner rewrite without default entry" $S/service.ts '? "Rewrote the briefing"' '? " "'
mutate "M12 over-limit label missing" apps/app/src/labels.ts 'tokens > limit ? ": over the limit" : ""' '""'
(cd "$W" && printf 'restored: ' && bun run test 2>&1 | grep -E "Tests ")
