# Recording the README media

The GIFs and screenshots in `documentation/readme/` come from the real desktop app on isolated data, driven by Playwright over the Chrome DevTools Protocol.
The agents' replies are scripted: a temporary patch lets the echo harness answer from `demo.base.json` and run thread tools (side-quest reports, mentions, Iskios suggestions, a failed turn for the backup).
The patch is for recording only; never commit it.

Requirements: Bun, Python 3 with `playwright`, `ffmpeg`, and the repository's dependencies installed.

```sh
export ISKIOS_REPO="$PWD"                      # the repository root
git apply documentation/readme/recording/demo-harness.patch
sh documentation/readme/recording/prepare.sh
(cd apps/app && BROWSER=none CI=1 bunx expo start --web --port 8123 &)
bash /tmp/iskios-demo/scripts/all.sh           # every scene, from fresh data, in order
python3 /tmp/iskios-demo/scripts/hero.py       # light and dark stills, after all.sh
git apply -R documentation/readme/recording/demo-harness.patch
```

Results land in `/tmp/iskios-demo/out/`; copy them over the files in `documentation/readme/`.
Scenes depend on each other's state (the side-quest, the handover, the backup, the mention), so rerun `all.sh` whole after changing one.
