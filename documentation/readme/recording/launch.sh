pkill -f "dist/main.js --remote-debugging-port=9377"; sleep 2
rm -rf /tmp/iskios-demo/data; mkdir -p /tmp/iskios-demo/data
cd "${ISKIOS_REPO:?Set ISKIOS_REPO to the repository root}/apps/desktop"
bun run build >/dev/null 2>&1 || echo BUILD FAILED
ZDOTDIR=/tmp/iskios-demo/zdot ISKIOS_DEMO_SHELL=/bin/zsh ISKIOS_DEMO_SCRIPT=/tmp/iskios-demo/demo.json ISKIOS_HARNESS=fake ISKIOS_DATA_DIR=/tmp/iskios-demo/data ISKIOS_APP_URL=http://localhost:8123 nohup ../../node_modules/.bin/electron dist/main.js --remote-debugging-port=9377 > /tmp/iskios-demo/electron.log 2>&1 &
for i in $(seq 1 60); do curl -s http://127.0.0.1:9377/json >/dev/null && break; sleep 1; done; sleep 6; echo up
