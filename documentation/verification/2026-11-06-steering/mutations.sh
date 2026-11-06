#!/bin/sh
# Breaks one steering or interrupt rule at a time in a disposable worktree and runs the checks; each must fail.
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
mutate "M1 never steered" threads.ts 'if (running !== undefined) return steerInto(threadId, running);' 'if (running !== undefined) return Effect.void;'
mutate "M2 Queue ignored" threads.ts 'AND m.is_queued = 0' ''
mutate "M3 default setting ignored" service.ts 'send.delivery ?? (yield* readSettings).defaultDelivery' 'send.delivery ?? "Steer"'
mutate "M4 untaken message kept in the process" claude.ts 'if (turn.untaken.size > 0) close(request.threadId);' 'if (false) close(request.threadId);'
mutate "M5 interrupt_thread reach unchecked" mcp.ts 'return commit(isBeneath(threadId, target)).pipe(' 'return Effect.succeed(true).pipe('
mutate "M6 interrupted turn is a failure" claude.ts 'if (turn.isInterrupting) return end(usageOf(event.usage));' ''
mutate "M7 delivery never recorded" threads.ts 'Delivered: (delivered) => markDelivered(turn, delivered.messageId),' 'Delivered: () => Effect.void,'
mutate "M8 interrupted thread always Idle" threads.ts 'const state = row?.reportedTurnId === turn.turnId ? "Done" : (row?.active ?? 0) > 0 ? "Waiting" : "Idle";' 'const state = outcome.isInterrupted ? "Idle" : row?.reportedTurnId === turn.turnId ? "Done" : (row?.active ?? 0) > 0 ? "Waiting" : "Idle";'
(cd "$W" && printf 'restored: ' && bun run test 2>&1 | grep -E "Tests ")
