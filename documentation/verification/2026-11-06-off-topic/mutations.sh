#!/bin/sh
# Breaks one batch 10 (off-topic requests) rule at a time in a disposable worktree and runs the checks; each must fail.
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
mutate "M1 own mission offered" $S/matching.ts 'AND m.id <> (SELECT mission_id FROM threads WHERE id = ${callerId})' ''
mutate "M2 briefing not matched" $S/matching.ts '+ (briefing.has(word) ? 1 : 0)' ''
mutate "M3 more than 3 offered" $S/matching.ts '.slice(0, maxMatches);' ';'
mutate "M4 any mission accepted for Continue" $S/suggestions.ts 'if (!suggestion.matches.some((match) => match.missionId === missionId))' 'if (false)'
mutate "M5 continued mission not woken" $S/suggestions.ts 'if (resolution.targetThreadId !== null) yield* waker.wake(resolution.targetThreadId);
        return (yield* readSuggestion' 'return (yield* readSuggestion'
mutate "M6 new mission keeps the proposed title off" $S/suggestions.ts 'if (titleOf(title) !== "") yield* proposeTitle(started.missionId, title);' ''
mutate "M7 new mission changes the prefill" $S/suggestions.ts 'insertMission(text, model, effort, null, false)' 'insertMission(text, model, effort, null, true)'
mutate "M8 aside updates the journal" $S/journalTools.ts 'if (yield* isAside(threadId)) return { _tag: "Aside" } as const;' ''
mutate "M9 aside result recorded" $S/tree.ts 'if (thread.isAside === 0 && !isNothingToRecord(journal)) {' 'if (!isNothingToRecord(journal)) {'
mutate "M10 aside has no rules" $S/instructions.ts '...(position.isAside ? asideInstructions : [offTopicInstructions]),' '...[offTopicInstructions],'
mutate "M11 setting ignored" $S/suggestions.ts 'if (shouldOpenOffTopicMissions && matches.length === 0) {' 'if (false) {'
mutate "M12 stop leaves the suggestion open" $S/lifecycle.ts 'yield* suggestions.withdraw(id);' ''
mutate "M13 no Attention while asking" $S/suggestions.ts 'yield* sql`UPDATE threads SET state = '"'"'Attention'"'"' WHERE id = ${threadId} AND state = '"'"'Running'"'"'`;' ''
(cd "$W" && printf 'restored: ' && bun run test 2>&1 | grep -E "Tests ")
