#!/usr/bin/env bash
# Breaks each CHG-0034/CHG-0035 behavior in turn inside a disposable worktree and shows a check fails.
# Usage: mutations.sh <worktree with the batch applied and node_modules linked>. Never run it on your checkout.
set -u
W="$1"; S="$W/packages/service/src"
run() { (cd "$W" && bun run test 2>&1 | grep -E "^ *×|Tests " | head -8); }
mutate() { # name, file, perl expression
  echo "== $1"; cp "$S/$2" "/tmp/mutation.bak"; perl -0pi -e "$3" "$S/$2"
  cmp -s "$S/$2" /tmp/mutation.bak && echo "MUTATION DID NOT APPLY"
  run; cp /tmp/mutation.bak "$S/$2"
}
mutate "M1 missing folder not held in Attention" threads.ts 's/if \(workspace\?\.isMissing === true\) \{/if (false) {/'
mutate "M2 restart releases a waiting thread" approvals.ts "s/WHERE state = 'Attention' AND blocker IS NULL/WHERE state = 'Attention'/"
mutate "M3 Stop keeps the blocker" threads.ts "s/SET state = 'Stopped', blocker = NULL/SET state = 'Stopped'/"
mutate "M4 workspace sandbox not widened" claude.ts 's/return access\.isInWorkspace/return false/'
mutate "M5 every prompt asks at the default level" approvals.ts 's/approvalLevel === "RiskyOnly" && sensitivity === null/false/'
mutate "M6 nothing is sensitive" patterns.ts 's/return sensitiveCommands\.find/return null; sensitiveCommands.find/'
mutate "M7 push not recognized" patterns.ts 's/git\(String\.raw`push\\b`\)/git(String.raw`pushx\\b`)/'
mutate "M8 secrets not recognized" patterns.ts 's/if \(secretPath\.test\(text\) \|\| secretCommand\.test\(text\)\) return secrets;//'
mutate "M9 consequence dropped from the question" approvals.ts 's/\$\{reason \?\? sensitivity\.permission\}\. \$\{sensitivity\.consequence\}/\${reason ?? sensitivity.permission}./'
mutate "M10 hidden folders never listed" folders.ts 's/\(shouldIncludeHidden \|\| !entry\.name\.startsWith\("\."\)\)/!entry.name.startsWith(".")/'
mutate "M11 folders outside home refused" workspaces.ts 's/if \(real === null\) return yield\* invalid\(`No folder at \$\{path\}\.`\);/if (real === null || !real.includes("home")) return yield* invalid(`No folder at \${path}.`);/'
mutate "M12 Retry accepted for any thread" threads.ts 's/if \(thread\?\.blocker !== "MissingWorkspace"\) return false;//'
echo "== restored"; run
