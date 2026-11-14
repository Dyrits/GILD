# Proof: token isolation under the harness sandboxes (SA-11, SA-13)

- **Verdict:** at `7fd2869`, a command under **OpenCode's** sandbox on macOS could read another process's environment and arguments: the service's owner token (SA-11) and every other thread's tool server address (SA-13). The profile now hides outside processes (CHG-0277), and the same probe reads nothing. **Claude Code's** and **Codex's** sandboxes allow process information only within themselves; this was read from their profiles, not run.
- **Environment:** macOS 26 (Darwin 25.6.0), Apple silicon, Electron 45.3.1 from the repository's `node_modules`, `/usr/bin/sandbox-exec`, OpenCode 2.2.0, Claude Code 2.1.322, Codex 0.169.0. Runs on 2026-11-14 at `d0aa8eb` plus this batch.
- **Method:** [probe-opencode.sh](2026-11-14-token-isolation/scripts/probe-opencode.sh) starts a stand-in that holds a dummy token in its environment and a dummy tool server address in its arguments. It reads the stand-in from outside any sandbox (the control) and from inside OpenCode's Seatbelt profile, before and after the fix. It prints only counts and yes/no. It used no real token, thread, harness, account or model. A second run used Electron's own binary (`ELECTRON_RUN_AS_NODE=1`) as the stand-in, since the service is an Electron utility process; the result was the same.
- **Durable check:** `openCodeSandbox.test.ts`, "stops a Seatbelt-wrapped process from reading the arguments and environment of one outside, not of its own child", runs the same read on macOS with the control on both sides.

## Results

| Check | Outside (control) | OpenCode's profile, before | OpenCode's profile, after |
| --- | --- | --- | --- |
| Read a process's environment and arguments by its pid (`sysctl kern.procargs2`) | yes | **yes** | no |
| Find the process without its pid (process list, then the same read) | yes | **yes** | no (empty list) |
| Map a loopback port to its process (`lsof`) | yes | **yes** | no |
| See that a loopback port listens (`netstat`) | yes | yes | yes |
| Read the arguments and environment of a child the sandbox started | yes | yes | yes |
| `/bin/ps` runs | yes | no | no |
| `node`, `git`, `python3`, `opencode --version` run | yes | yes | yes |

## Findings along the way

- The first probe used `ps -E` and `/bin/sleep`, and both gave false negatives. `/bin/ps` does not run under the profile, since setuid binaries cannot, and macOS hides the environment of protected system binaries such as `/bin/sleep`. Any non-setuid reader gets the data `ps` would, so the blocked `ps` was no protection. Only the control row makes the result meaningful.
- `(deny process-info*)` with `(allow process-info* (target same-sandbox))` alone hides the process list and `lsof`'s mapping. It still lets `kern.procargs2` read a process named by its pid, and pids are easy to guess. `(deny sysctl-read (sysctl-name-prefix "kern.procargs"))` closes that; `(sysctl-name "kern.procargs2")` did not.
- The listening port stays visible through `netstat`. Without a token, the port alone gives no access.
- A token is the whole credential. Source shows `endpoints.threadOf(token)` is the only check on a tool server request ([mcp.ts](../../packages/service/src/work/mcp.ts) `handle`), and the owner socket accepts a request carrying the owner token. This batch did not exercise either at run time.

## Claude Code and Codex, read from their profiles

The session's permission classifier declined, twice, to run the probe under the published `@anthropic-ai/sandbox-runtime` (0.0.83), so it was not worked around. Reading that package's `macos-sandbox-utils.js` and Codex's embedded `seatbelt_base_policy` instead:

- Both start with `(deny default)` and allow `process-info*` only `(target same-sandbox)`.
- Claude Code's `sysctl-read` allow list has `kern.proc.all`, `kern.proc.pid.` and `kern.proc.pgrp.`, but not `kern.procargs`. Its commands should therefore see the process list but not other processes' arguments or environment. A run would settle it.
- Codex 0.169.0 has the same `process-info*` rule; its `sysctl-read` list was not read in full.

## Claims and verdicts

| Claim (CHG-0277) | Evidence | Shown able to fail | Verdict |
| --- | --- | --- | --- |
| A sandboxed OpenCode command cannot read an outside process's arguments or environment, even by its pid | The test's macOS run; the probe's "after" row | The test failed before the fix ("seen", expected "hidden"), with its outside control reading "seen"; the probe's "before" row reads it | proven |
| It cannot list outside processes or map a port to one | The probe's "after" row | The probe's "before" row lists and maps them | proven |
| The sandbox's own children stay readable | The test's own-child check | Unchanged by the fix (ran before and after); a failing control would read "hidden" | proven (not shown failing) |
| Ordinary work still runs: `git`, `node`, `python3`, `opencode --version` | Run under the new profile | Fails if the profile blocked them; the same commands ran under the old profile | proven |
| Nothing else regressed | `bun run check`, `bun run typecheck` (6 packages), `bun run test` (1539 passed, 14 skipped) | Not applicable | proven |
| Claude Code's and Codex's sandboxes already hide outside processes | Their profiles, read | Not run | unproven |

Reproduction, 2026-11-14 at 12:22, from a clean shell in the same environment: the probe, the ordinary-work run, Biome, typecheck and the full suite all repeated the results above. The checkout's `git status` was unchanged afterwards. No independent agent reran it.

## Not checked

- A run under Claude Code's or Codex's sandbox.
- Linux. Bubblewrap's `--unshare-pid` and fresh `/proc` should hide outside processes; unverified.
- A live OpenCode turn under the new profile. The harness tests that start real sandboxed processes passed, and `opencode --version` runs under it.
- Same-user processes outside any sandbox, such as a command the owner allowed to escape it. They can still read the owner token from the service's environment. That is the operating system's same-user boundary, which this batch does not change.
