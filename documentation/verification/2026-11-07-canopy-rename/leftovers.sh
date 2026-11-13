#!/bin/sh
# Proof check for CHG-0061: lists brand uses of the former name in living files, ignoring dated records and
# the words that mean opening a mission. Exits 1 when any remain. Usage: sh leftovers.sh <repository>
cd "$1" || exit 2
git grep --untracked -n -i -E 'open.?mission' -- . ':!bun.lock' ':!.agents/handoffs' ':!documentation/verification' \
  ':!documentation/changelog' ':!documentation/architecture-audit' ':!documentation/architecture-decision-record' \
  ':!.zcode' ':!apps/desktop/src/formerData.ts' ':!apps/desktop/test/formerData.test.ts' ':!.agents/ai-tooling.md' \
  > /tmp/canopy-matches.txt
[ -s /tmp/canopy-matches.txt ] || { echo "the search matched nothing at all: check the search itself"; exit 2; }
grep -v -E 'setOpenMission|onOpenMission|openMissionFromAnywhere|reopenMission|ReopenMission|open_mission|openMission\(|const \[openMission|openMission[,:=)} ]|openMission ===|the open mission|onOpen\(mission' \
  /tmp/canopy-matches.txt > /tmp/canopy-leftovers.txt
count=$(wc -l < /tmp/canopy-leftovers.txt | tr -d ' ')
echo "brand uses of the former name: $count"
head -3 /tmp/canopy-leftovers.txt | cut -c1-160
[ "$count" = 0 ]
