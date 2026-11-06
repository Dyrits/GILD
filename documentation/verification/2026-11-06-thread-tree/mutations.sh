#!/bin/sh
# Breaks one thread-tree rule at a time in a disposable worktree and runs the checks; each must fail.
# Usage: mutations.sh <worktree with node_modules linked>
set -u
W=$1
cd "$W/packages/service/src" || exit 1
mutate() {
  name=$1 file=$2 from=$3 to=$4
  cp "$file" /tmp/om-mutation-backup
  python3 -c 'import sys; p,a,b=sys.argv[1:4]; s=open(p).read(); assert a in s, a; open(p,"w").write(s.replace(a,b,1))' "$file" "$from" "$to"
  printf '%s: ' "$name"
  (cd "$W" && bun run test 2>&1 | grep -E "Tests ")
  cp /tmp/om-mutation-backup "$file"
}
mutate "M1 never Done or Waiting" threads.ts 'const state = row?.reportedTurnId === turn.turnId ? "Done" : (row?.active ?? 0) > 0 ? "Waiting" : "Idle";' 'const state = "Idle";'
mutate "M2 reach unchecked" mcp.ts 'if (!(yield* isWithinReach(threadId, to))) return false;' ''
mutate "M3 no running limit for open_thread" tree.ts 'if ((yield* runningCountOf(caller.missionId)) >= maxRunning) {' 'if (false) {'
mutate "M4 Stopped threads admitted" threads.ts '["Running", "Attention", "Stopped"].includes(thread.state)' '["Running", "Attention"].includes(thread.state)'
mutate "M5 no depth limit for the owner" tree.ts 'if ((yield* depthOf(parentId)) + 1 > maxOwnerDepth) {' 'if (false) {'
mutate "M6 model not copied" tree.ts '${opening.model ?? parent.model}' "\${opening.model ?? 'default'}"
mutate "M7 held messages never woken" threads.ts 'for (const { threadId } of waiting) yield* wake(threadId);' ''
mutate "M8 parents never relaxed" tree.ts "yield* sql\`UPDATE threads SET state = 'Idle' WHERE id = \${parentId}\`;" ''
(cd "$W" && printf 'restored: ' && bun run test 2>&1 | grep -E "Tests ")
