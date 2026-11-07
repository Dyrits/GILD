# Proof: harnesses and provider accounts (batch 18)

- **Verdict:** a mission runs on Claude Code, Codex, or OpenCode with the model chosen for it, a thread on one harness opens a thread on another and gets its result, and accounts can be added beside the computer's own sign-in, each with its own folder. Built by an agent without questions; the owner has neither agreed nor accepted it.
- **Work:** working tree on `ab85b66`, committed after this proof.
- **Agreement:** the owner's instruction of 2026-11-07: "I'd like OpenMission to be able to be used to build OpenMission. I want to be able to use different providers in it, using my Claude subscription (and even register more than one account like OpenBot does). I want to be able to use Codex as well and OpenCode. Focus on that first. I'll be AFK, don't ask any question."
- **Environment:** macOS 26; Claude Code 2.1.302, codex-cli 0.160.1, OpenCode 2.2.0, each signed in on this computer. Metro `BROWSER=none bunx expo start --port 8087` in `apps/app`; Electron `env -i HOME PATH USER TMPDIR LANG OPENMISSION_DATA_DIR=/tmp/om-acc/data OPENMISSION_APP_URL=http://localhost:8087 bunx electron dist/main.js --remote-debugging-port=9352` in `apps/desktop`, with the real harnesses (no `OPENMISSION_HARNESS`); `playwright-cli attach --cdp=http://localhost:9352`, clicks through DOM `click()` as in earlier proofs.
- **Date:** 2026-11-07

Screenshots of Settings have the owner's email covered.

## Protocol probes

Before building, each tool was driven by hand (scripts kept outside the repository):

- `codex app-server`: `initialize`, `model/list` (8 models for the ChatGPT plan), `thread/start` with `approvalPolicy`, `sandbox`, `developerInstructions`, and dotted `config` overrides, `turn/start`; notifications `item/started`, `item/agentMessage/delta`, `item/completed`, `thread/tokenUsage/updated` (per call in `last`), `turn/completed`. TypeScript bindings from `codex app-server generate-ts` gave the request and approval shapes.
- `opencode acp`: `initialize`, `session/new`, `session/set_config_option` for the model (no `session/set_model`), `session/prompt` answered at the turn's end with `stopReason` and `usage`, `session/update` chunks, `session/request_permission` with allow and reject options. `OPENCODE_CONFIG_CONTENT` in OpenCode's v2 shape (`permissions` list, `mcp.servers`, `instructions`) reaches the ACP server; `opencode debug config --standalone` showed it merged.
- Sign-in status: `claude auth status --json`, `codex login status` (on standard error), `opencode auth list`. `XDG_DATA_HOME` moves OpenCode's data and sign-ins (`opencode debug paths`).

## Evidence

| Check | Result |
| --- | --- |
| Settings lists each harness's version and the computer's sign-in from the tools themselves | [settings](2026-11-07-harnesses-and-accounts/settings.png): "Signed in · <email> · Claude pro", "Signed in · ChatGPT", "Signed in · OpenCode Go, GitHub Copilot, OpenCode Console" |
| An added Claude Code account "Work" has its own folder and reads Signed out | [settings-added-account](2026-11-07-harnesses-and-accounts/settings-added-account.png); `/tmp/om-acc/data/accounts/<id>` created. The account chips in the defaults row of this screenshot were removed after it (Settings holds no default account) |
| The composer offers harness, model, and effort; Codex lists its own models | [dashboard](2026-11-07-harnesses-and-accounts/dashboard.png), [composer-codex-models](2026-11-07-harnesses-and-accounts/composer-codex-models.png) |
| A Codex mission (GPT-6-Luna, low) calls `set_mission_title` and replies | [codex-thread](2026-11-07-harnesses-and-accounts/codex-thread.png): title "Codex from OpenMission", "I'm running on the Codex harness.", usage counted |
| A thread beneath it on OpenCode (`opencode-go/deepseek-v4.1-flash`) replies and reports to the Codex thread | [open-thread-opencode](2026-11-07-harnesses-and-accounts/open-thread-opencode.png), [open-thread-opencode-menu](2026-11-07-harnesses-and-accounts/open-thread-opencode-menu.png): "Result from …: I run on the OpenCode harness." in the parent |
| A Claude Code mission (Haiku) still runs through the router | [claude-thread](2026-11-07-harnesses-and-accounts/claude-thread.png): title set, reply "ok" |
| Removing "Work" deletes the account and its folder | the accounts list back to "This computer"; `/tmp/om-acc/data/accounts/` empty |
| Live checks: `OPENMISSION_LIVE_HARNESSES=1 OPENMISSION_LIVE_OPENCODE_MODEL=opencode-go/deepseek-v4.1-flash bun run test packages/service/test/liveHarnesses.test.ts` | 3 passed: harness listing with sign-ins and models; a Codex turn and an OpenCode turn that each call `set_mission_title` |

## Automated checks

`packages/service/test/harnesses.test.ts` (21 checks on stand-ins `stand-in-codex.mjs` and `stand-in-opencode.mjs`): runner rules; Codex settings, usage, approval asked and answered (allow, deny, unasked), resume after idle close, steering, interrupt, failure; OpenCode configuration, permission refusal, session load without the replayed reply, cancel; accounts listing, the account folder as `CODEX_HOME` and `CLAUDE_CONFIG_DIR`, refusal of another harness's account, refused and allowed removal, sign-in pointed at the folder, `open_thread` across harnesses.

## Checks shown able to fail

- **Before and after:** `harnesses.test.ts` with its stand-ins, copied onto `ab85b66` in a separate worktree, fails to load (`Cannot find module '../src/runners.ts'`); on the end state, 21 pass.
- **Mutations** (separate worktree of the end state, each restored after): 12 of 12 caught by `harnesses.test.ts`: account kept across harnesses (1 failed), model kept across harnesses (2), router ignoring the harness (12), Codex accepting a denied command (1), Codex usage counting the cache twice (1), Codex steering without the message id (1), OpenCode allowing a denied command (1), OpenCode keeping the replayed reply (1), OpenCode subagents left on (1), the wrong Codex home variable (1), account removal not refused (1), another harness's account accepted (1). The owner's checkout was unchanged afterwards (`git status --porcelain` identical).

## Regressions

`bun run test` (332 passed, 8 skipped), `bun run typecheck`, `bun run check`, `git diff --check`, the desktop build, and `CI=1 bunx expo export --platform web` passed, and passed again just before the commit.

## Not verified

- Signing in an added account: **Sign in** opens a Terminal window running the harness's own login; it was not clicked, since the owner was away. The `.command` file it writes and opens was not run.
- A live Claude Code turn on an added account (needs that account signed in).
- Live Codex escalation (a command leaving the sandbox), live Codex steering, and live OpenCode permission prompts: covered by stand-ins only.
- Linux and Windows: sign-in tells the owner the command to run instead of opening a terminal; not run.
- No fresh-context agent reran this proof; the regression set was rerun from a clean shell before the commit.
- The look of the new pickers and the Accounts section awaits the owner's judgment.
