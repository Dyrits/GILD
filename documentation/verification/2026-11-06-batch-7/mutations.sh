#!/bin/sh
# Breaks one batch 7 rule at a time in a disposable worktree and runs the checks; each must fail.
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
mutate "M1 threshold off by one" $S/chatter.ts 'pair.count < chatterThreshold' 'pair.count <= chatterThreshold'
mutate "M2 owner message never resets" $S/messaging.ts 'if (message.fromThreadId === null) yield* resetOwnerChatter(message.threadId);' ''
mutate "M3 result never resets" $S/messaging.ts 'else if (message.isResult) yield* resetResultChatter(message.fromThreadId, message.threadId);' ''
mutate "M4 Continue does not wake" $S/chatter.ts 'if (choice === "Continue") for (const id of ids) yield* threads.wake(id);' ''
mutate "M5 Stop both leaves them Attention" $S/chatter.ts 'if (choice === "Stop") yield* haltThreads(ids, "Stopped");' ''
mutate "M6 mission scratch folder kept" $S/deleting.ts 'if (root.parentId === null) yield* removeScratch(join(scratchRoot, root.missionId));' ''
mutate "M7 mission permissions kept" $S/deleting.ts 'yield* sql`DELETE FROM standing_permissions WHERE mission_id = ${root.missionId}`;' ''
mutate "M8 running count wrong" $S/deleting.ts 'runningCount: rows.filter((row) => row.running === 1).length,' 'runningCount: 0,'
mutate "M9 workspace not protected" $S/scratch.ts 'if (isWithin(folder, scratch) || isWithin(scratch, folder)) return;' ''
mutate "M10 urgent threads fold" apps/app/src/folding.ts 'const isUrgent = thread.state === "Attention" || thread.state === "Failed";' 'const isUrgent = false;'
mutate "M11 folding default off" $S/settings.ts '  shouldShowAgentThreads: true,' '  shouldShowAgentThreads: false,'
(cd "$W" && printf 'restored: ' && bun run test 2>&1 | grep -E "Tests ")
