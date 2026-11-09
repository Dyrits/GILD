#!/bin/sh
# Proof check for CHG-0072: lists brand uses of the former name in living files, ignoring dated records,
# the data migration's own references to the former name, and links to dated files named after it.
# Exits 1 when any remain. Usage: sh leftovers.sh <repository>
cd "$1" || exit 2
git grep --untracked -n -i -E 'canopy' -- . ':!bun.lock' ':!.agents/handoffs' ':!documentation/verification' \
  ':!documentation/changelog.md' ':!documentation/architecture-audit' ':!documentation/architecture-decision-record' \
  ':!documentation/art-direction' ':!documentation/brand' ':!.zcode' ':!.codegraph' ':!.playwright-cli' \
  ':!apps/desktop/dist' ':!apps/desktop/src/formerData.ts' ':!apps/desktop/test/formerData.test.ts' \
  > /tmp/gild-matches.txt
[ -s /tmp/gild-matches.txt ] || { echo "the search matched nothing at all: check the search itself"; exit 2; }
grep -v -E 'renamed-to-canopy\.md|canopy-rename' /tmp/gild-matches.txt > /tmp/gild-leftovers.txt
count=$(wc -l < /tmp/gild-leftovers.txt | tr -d ' ')
echo "brand uses of the former name: $count"
head -3 /tmp/gild-leftovers.txt | cut -c1-160
[ "$count" = 0 ]
