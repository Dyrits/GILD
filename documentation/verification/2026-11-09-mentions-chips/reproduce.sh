#!/bin/sh
# Builds the message box alone (with a stub for its icons) and drives it in Chrome. Needs bun, Google Chrome, and playwright-core (npm i playwright-core in a scratch folder).
set -e
REPO=$(cd "$(dirname "$0")/../../.." && pwd)
SCRATCH=${1:-/tmp/gild-editor-check}
rm -rf "$SCRATCH" && mkdir -p "$SCRATCH/src"
cp "$REPO/apps/app/src/chipEditor.web.tsx" "$REPO/apps/app/src/chipEditorTypes.ts" "$REPO/apps/app/src/theme.ts" "$SCRATCH/src/"
sed -i.bak 's#import type { MissionState, ThreadState } from "@gild/contracts";#type MissionState = string; type ThreadState = string;#' "$SCRATCH/src/theme.ts"
cp "$REPO/documentation/verification/2026-11-09-mentions-chips/editor-chips-stub.ts" "$SCRATCH/src/chips.ts"
cp "$REPO/documentation/verification/2026-11-09-mentions-chips/editor-page.tsx" "$SCRATCH/src/main.tsx"
echo '<div id="root"></div><script src="main.js"></script>' > "$SCRATCH/index.html"
ln -s "$REPO/apps/app/node_modules" "$SCRATCH/node_modules"
(cd "$SCRATCH" && bun build src/main.tsx --outfile main.js --target browser >/dev/null)
PW=${PLAYWRIGHT_DIR:-/tmp/pw}
cp "$REPO/documentation/verification/2026-11-09-mentions-chips/editor-check.mjs" "$PW/editor-check.mjs"
cd "$PW" && node editor-check.mjs "$SCRATCH" "$REPO/documentation/verification/2026-11-09-mentions-chips"
