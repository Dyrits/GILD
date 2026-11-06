#!/bin/sh
# Breaks one batch 11 (budget control) rule at a time in a disposable worktree and runs the checks; each must fail.
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
mutate "M1 cost turns count tokens too" $S/spending.ts 'CASE WHEN u.cost IS NULL THEN u.input + u.output + u.cache_read + u.cache_creation ELSE 0 END' 'u.input + u.output + u.cache_read + u.cache_creation'
mutate "M2 cost limit ignored" $S/spending.ts '(limits.cost !== null && spent.cost >= limits.cost) ||' ''
mutate "M3 limit reached only above it" $S/spending.ts 'spent.tokens >= limits.tokens)' 'spent.tokens > limits.tokens)'
mutate "M4 week starts on Sunday" $S/spending.ts '((date.getDay() + 6) % 7)' 'date.getDay()'
mutate "M5 default budget not applied" $S/missions.ts 'yield* applyDefaultBudget(missionId, (yield* readSettings).defaultMissionBudget);' ''
mutate "M6 no enforcement at turn end" $S/threads.ts 'yield* enforceBudgets(turn.missionId, threadId)' 'yield* Effect.succeed([] as Array<string>)'
mutate "M7 halted turns not cancelled" $S/threads.ts 'yield* cancel(halted.filter((id) => id !== threadId));' ''
mutate "M8 interrupted messages not delivered again" $S/budgets.ts 'yield* sql`UPDATE messages SET delivered_turn_id = NULL WHERE delivered_turn_id IN (' 'yield* sql`UPDATE messages SET delivered_turn_id = delivered_turn_id WHERE delivered_turn_id IN ('
mutate "M9 no hold at admit" $S/threads.ts 'if (yield* holdIfReached(threadId, thread.missionId)' 'if (false && (yield* holdIfReached(threadId, thread.missionId))'
mutate "M10 Stop releases instead" $S/budgets.ts "yield* sql\`UPDATE threads SET state = 'Stopped', blocker = NULL" "yield* sql\`UPDATE threads SET state = 'Idle', blocker = NULL"
mutate "M11 open_thread not refused" $S/tree.ts 'if (overBudget !== null) return' 'if (false) return'
mutate "M12 new missions not refused" $S/missions.ts 'if (isReached(global.limits, global.spent))' 'if (false)'
mutate "M13 lowering does not stop" $S/budgets.ts '? yield* enforceBudgets(missionId, mission.topThreadId)' '? []'
mutate "M14 no budget line" $S/threads.ts 'const budget = yield* budgetLineOf(turn.missionId)' 'const budget = null; yield* budgetLineOf(turn.missionId)'
mutate "M15 change not recorded" $S/budgets.ts 'if (text !== null) yield* insertEvent(missionId, text);' ''
mutate "M16 global not applied on settings" $S/service.ts 'Effect.tap(() => sql.withTransaction(applyGlobalBudget).pipe(Effect.tap(applyBudgetOutcome))),' 'Effect.tap(() => Effect.void),'
(cd "$W" && printf 'restored: ' && bun run test 2>&1 | grep -E "Tests ")
