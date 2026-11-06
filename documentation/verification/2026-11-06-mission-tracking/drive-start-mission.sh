#!/bin/bash
# start.sh <folder|none> <text>: starts a mission from the dashboard of the attached window.
P=/tmp/om-run/pc.sh
E=(bun /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission/documentation/verification/2026-11-06-batch-4-drive/main-eval.ts 9336)
$P "const back = page.getByText('← Missions', { exact: true }); if (await back.count()) await back.click();"
if [ "$1" != none ]; then "${E[@]}" "globalThis.__nextFolder = '$1'" >/dev/null; $P "await page.getByText('Choose folder…', { exact: true }).click();"
else $P "const n = page.getByText('No workspace', { exact: true }); if (await n.count()) await n.click();"; fi
$P "await page.getByPlaceholder('Start a mission with one message…').fill(\`$2\`); await page.getByText('Send', { exact: true }).click();"
sleep 2
