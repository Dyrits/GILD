#!/bin/sh
# Runs a Playwright snippet against the attached window: pc.sh '<body using page>'
cd /Volumes/APFS-G-DRIVE/Codelab/Dyrits/OpenMission && playwright-cli run-code "async page => { $1 }" 2>&1 | grep -E "^### Result" -A3 | grep -v "^###" | grep -v "^--"
