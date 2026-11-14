#!/bin/sh
# Probes what a process under OpenCode's Seatbelt profile can see of a sibling that holds a dummy token.
# macOS only. Uses no real token, harness, or account, and prints only counts and yes/no, never the dummy value.
# Runs the read under two profiles copied from seatbeltProfileOf in packages/service/src/harness/openCodeSandbox.ts:
# "before", as it was at 7fd2869, and "after", with the process rules added for SA-11 and SA-13.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
work=$(mktemp -d /tmp/iskios-token-probe.XXXXXX)
trap 'kill "$standin" 2>/dev/null || true; wait "$standin" 2>/dev/null || true; rm -rf "$work"' EXIT
tail='(deny signal)
(allow signal (target same-sandbox))
(deny file-write*)
(allow file-write* (subpath (param "W0")) (literal "/dev/null") (literal "/dev/tty") (regex #"^/dev/(fd|ttys)"))'
printf '(version 1)\n(allow default)\n%s\n' "$tail" > "$work/before.sb"
printf '(version 1)\n(allow default)\n(deny process-info*)\n(allow process-info* (target same-sandbox))\n(deny sysctl-read (sysctl-name-prefix "kern.procargs"))\n%s\n' "$tail" > "$work/after.sb"
sandboxed() { /usr/bin/sandbox-exec -D "W0=$work" -f "$work/$profile.sb" "$@"; }
dummy="dummy-token-$(od -An -N8 -tx1 /dev/urandom | tr -d ' \n')"
# Stand-in for the service (dummy owner token in its environment) and a harness (dummy thread URL in its arguments).
ISKIOS_TOKEN="$dummy" node -e 'require("net").createServer().listen(0,"127.0.0.1",function(){console.error(this.address().port)})' \
  "mcp-url=http://127.0.0.1:1/mcp/$dummy" 2>"$work/port" &
standin=$!
sleep 1.5
port=$(cat "$work/port")
echo "outside the sandbox (control, must read yes):"
echo "  sibling environment and arguments readable: $(/usr/bin/python3 -I "$here/procargs.py" "$standin" "$dummy")"
for profile in before after; do
  echo "under OpenCode's profile, $profile:"
  echo "  sibling environment and arguments readable: $(sandboxed /usr/bin/python3 -I "$here/procargs.py" "$standin" "$dummy" 2>&1)"
  echo "  sibling found without its pid: $(sandboxed /usr/bin/python3 -I "$here/find.py" "$dummy" 2>&1)"
  echo "  /bin/ps runs (it is setuid): $(sandboxed /bin/ps -o pid= -p $$ >/dev/null 2>&1 && echo yes || echo no)"
  echo "  loopback listener found with netstat: $(sandboxed /usr/sbin/netstat -an -p tcp 2>&1 | grep -c "127.0.0.1.$port .*LISTEN") match(es)"
  echo "  listener's process found with lsof: $(sandboxed /usr/sbin/lsof -nP "-iTCP:$port" -sTCP:LISTEN 2>&1 | grep -c "$standin") match(es)"
done
