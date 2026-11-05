#!/usr/bin/env bash
# Breaks each workspace behavior in turn inside a disposable worktree and shows a check fails.
# Usage: mutations.sh <worktree with the batch applied and node_modules linked>. Never run it on your checkout.
set -u
W="$1"; S="$W/packages/service/src"
run() { (cd "$W" && bun run test 2>&1 | grep -E "^ *×|Tests:|Tests " | head -6); }
mutate() { # name, file, perl expression
  echo "== $1"; cp "$S/$2" "/tmp/mutation.bak"; perl -0pi -e "$3" "$S/$2"
  cmp -s "$S/$2" /tmp/mutation.bak && echo "MUTATION DID NOT APPLY"
  run; cp /tmp/mutation.bak "$S/$2"
}
mutate "M1 containment ignored" workspaces.ts 's/const root = roots\.find\(\(candidate\) => isWithin\(candidate, real\)\);/const root = roots[0];/'
mutate "M2 instructions dropped" workspaces.ts 's/const instructions = yield\* readInstructions\(workspace\.path\);/const instructions: Array<string> = [];/'
mutate "M3 always scratch cwd" workspaces.ts 's/cwd: workspace\.path \}/cwd: scratchFolder }/'
mutate "M4 permission saved for mission only" permissions.ts 's/CASE WHEN workspace_id IS NULL THEN mission_id END, workspace_id,/mission_id, NULL,/'
mutate "M5 nested workspace inherits" permissions.ts 's/OR \(t\.workspace_id IS NOT NULL AND p\.workspace_id = t\.workspace_id\)/OR (t.workspace_id IS NOT NULL AND p.workspace_id IS NOT NULL)/'
mutate "M6 missing folder ignored" threads.ts 's/if \(workspace\?\.isMissing === true\)/if (false)/'
echo "== restored"; run
