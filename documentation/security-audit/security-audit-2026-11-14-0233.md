# Security audit: Iskios, run 2

Timestamp: 2026-11-14 02:33 (local). Quest: Iskios security audit.

## 1. Status and reading guide

This audit is source-only. No target code was run, no OS-enforced runner was available, and no network use was needed. Every candidate below is `needs_validation`: the source supports it, but no run has confirmed it. Nothing is `confirmed`.

The verification step has not run yet. Each candidate still needs a fresh verifier, and the coverage critic has not run. Priorities in section 3 are provisional. They reflect the hunters' descriptions of impact and conditions, not verified severity.

Run 1 is the prior audit, at commit 49877734. Its `needs_validation` leads were re-checked against the current code. The sensitive-commands lead is now an owner decision (section 7, item 2). The other leads are covered by the candidates above or no longer apply, because the code they describe was rewritten or removed.

## 2. Scope and method

Source ref: `b6e0324` with a dirty worktree. The audit reads the files as they are on disk.

Coverage: 19 units in nine hunter groups (H1 to H9). The ledger and hunter prompts were generated from the skill's own text.

| Hunter | Area | Units: covered / candidate |
|---|---|---|
| H1 | Transport and MCP (owner socket, thread MCP endpoint) | 0 / 2 |
| H2 | Harness spawn, environment, install | 1 / 1 |
| H3 | Approval policy | 0 / 2 (questions.ts covered) |
| H4 | Guildmaster and rituals | 1 / 1 |
| H5 | Store, dispatch, isolation, thread reach | 1 / 1 |
| H6 | Files and credentials | 1 / 1 |
| H7 | Relay, channel, pairing | 2 / 1 |
| H8 | Electron and renderer | 1 / 1 |
| H9 | Updater and CI | 1 / 1 |

Total: 8 units covered with no finding, 11 units with at least one candidate.

## 3. Candidate summary

Provisional priority: High, Medium, or Low. Each candidate is `needs_validation`.

| ID | Priority (provisional) | Title | Source |
|---|---|---|---|
| SA-01 | High | Owner's named `create_ritual` approves only the title | H4 |
| SA-09 | High | OpenCode edit approval judges only the first path | H3 |
| SA-08 | Medium | Paired devices bypass browsable roots | H6, H7 (merged) |
| SA-03 | Medium | Retraction or narrative sentences still authorize Archive, Done, or Stop | H4 |
| SA-05 | Medium | One owner message authorizes unlimited Ritual creations | H4 |
| SA-06 | Medium | Thread-written suggestion text becomes owner words and grants `@` reach | H4, H5 (merged) |
| SA-07 | Medium | Dangling symlink counts as inside the workspace for file writes | H6 |
| SA-10 | Medium | Always allow saves a literal `*` as a wildcard | H3 |
| SA-11 | Medium | Owner token readable from the service process environment | H1 |
| SA-12 | Medium | `iskios:endpoint` returns the owner token with no sender check | H8 |
| SA-13 | Medium | Thread MCP token readable from sibling harness argv or environment | H1 |
| SA-14 | Medium | Threads can call `answer_prompt` on their own behalf (contested) | H1, H3 |
| SA-02 | Low | Realm folder ancestor passes the owner match | H4 |
| SA-04 | Low | Duplicate quest titles pass as an unambiguous target | H4 |
| SA-15 | Low | Sandboxed threads can write the owner's npm cache, which a later install trusts | H2 |
| SA-16 | Low | Floating third-party action tags in the release pipeline | H9 |

## 4. Candidate detail

### SA-01 Owner's named `create_ritual` approves only the title (High, provisional)

Location: `packages/service/src/work/guildmasterProvenance.ts:217, :237`; `policy/ownerRequests.ts:207`; `work/guildmaster.ts:418`; `work/rituals.ts:142`.

When the owner's current message names creating a Ritual with a title, the Guildmaster's `create_ritual` call runs at once with Owner authority. The named test checks only that the title and a create word appear. The model-supplied instruction, schedule, realm folder, and Companion are stored, and the Ritual runs unattended when due. The owner is not shown those fields on this path. The tool description says the question shows them, but the named path does not show them (`threadTools.ts:100`).

Conditions: the Guildmaster model must choose the fields. Content it reads (quest reports, journal briefings, dashboard lines) could steer those fields without the owner's words in the same turn. That is model behaviour.

Validation: local check that `isNamedByOwner` returns true for "Create a ritual called Daily digest." with a null value, then drive `withProvenance` with a differing instruction and confirm the stored row. Owner-observed: in a disposable realm, ask for a Ritual with a plain title and check whether a question appears and what the saved Ritual shows.

### SA-09 OpenCode edit approval judges only the first path (High, provisional)

Location: `packages/service/src/harness/opencode.ts:188, :217-223, :270-289`; `work/threadToolHandlers.ts:62-68`; `work/approvals.ts:327-352`; `policy/containment.ts:32-47`. Contrast: `harness/codex.ts:203`.

At the default level, an OpenCode edit that lists several paths, with the first inside the thread folder and a later one outside, is correctly not auto-allowed by `isUnaskedEdit`, so the adapter asks. The question shown to the owner, and the decision in `answerPrompt`, use only the first path. That path is inside, so the call is auto-allowed. The adapter then sends `allow_once` for the whole tool call, including the outside path. The owner is never asked.

A second trigger: an edit that names no path falls back to the tool title as `file_path` (`opencode.ts:188, :221`). A title that is not an absolute path resolves inside the folder (`core/folders.ts:42-43`) and is auto-allowed.

Conditions: OpenCode must send one edit tool call that mixes inside and outside paths, which is external harness behaviour. Codex joins all paths and escapes at RiskyOnly, so it is not affected.

Validation: local stand-in OpenCode script that sends a permission request with an inside and an outside location. Assert that no question is inserted, that the auto-allow names only the inside path, and that `allow_once` is sent. Do not write the outside file. Owner-observed: with dummy files, ask OpenCode to change one file in the folder and one dummy file outside it, and check whether the approval card names both.

### SA-08 Paired devices bypass browsable roots (Medium, provisional)

Location: `packages/service/src/service.ts:250, :282, :300, :365-366, :479, :550-568`; `work/workspaces.ts:85-102`; `work/missions.ts:103`; `work/realmHandlers.ts:27`; `work/skills.ts:43-45`; `work/workspaceEntries.ts:82-84`; `remote/frames.ts:72`; `contracts/src/remote.ts:103`; `documentation/capabilities/device-pairing/specifications.md` lines 14 and 18.

The browsable roots limit a paired device only for browse, create-folder, and search. `StartMission`, `CreateRitual`, and `CreateRealm` pass the typed path to `attachWorkspace`, which checks only that the folder exists. `ListWorkspaceEntries` and `ListSkills` read any folder given. A paired phone can therefore start a quest in a folder outside the roots, or list file names and SKILL.md frontmatter there.

The device-pairing spec contradicts itself. Line 14 gives a paired device the owner's full authority, and line 18 says a typed path outside the roots is refused. The candidate assumes line 18 governs. If line 14 governs, this is intended behaviour. Owner decision required (section 7).

Validation: local service test with a temporary browsable root and a sibling folder, sending the paired-device source. Owner-observed: from a paired device, start a quest in a throwaway folder outside the roots and check whether the host accepts it.

### SA-03 Retraction or narrative sentences still authorize Archive, Done, or Stop (Medium, provisional)

Location: `packages/service/src/policy/ownerRequests.ts:73, :128, :207`; `work/guildmaster.ts:341-359`.

The named test passes when any single sentence of the owner's message holds the verb, the target, and no word from a short blocker list. It ignores the other sentences. "Archive Report. Actually, keep it." authorizes archiving Report. "Report is done." authorizes Done. The blocker list lacks words such as "rather", "actually", "keep", "leave", "skip", and "later".

Quests with threads still at work ask, so exposure is limited to quests with nothing running.

Validation: pure-function check of `isNamedByOwner` with those sentences. Expected result: true for both, which confirms the candidate.

### SA-05 One owner message authorizes unlimited Ritual creations (Medium, provisional)

Location: `work/guildmasterProvenance.ts:233, :268`; `work/guildmaster.ts:405`; `work/rituals.ts:142`; `work/threadTools.ts:100`.

Each `create_ritual` call re-derives authority from the same owner message in the same turn. The receipt is one-use per call. Nothing counts calls per turn or per message. The only guard against duplicates is prompt guidance ("so the same one is not made twice"). Each call inserts an enabled Ritual with its own quest and schedule.

Conditions: the turn runner's tool-call cap, if any, was not reviewed. A cap would bound the count. Model behaviour decides whether it repeats the call.

Validation: call `createRitualByGuildmaster` three times with one title in one turn, then count the `rituals` rows.

### SA-06 Thread-written suggestion text becomes owner words and grants `@` reach (Medium, provisional)

Merged from H4 (suggestion text as owner words in a Ritual thread) and H5 (reach from `@` tokens in suggestion text). Same root cause.

Location: `work/suggestions.ts:143` (Continue), `:158` (New quest), `:224` and `:275` (auto-open), `work/tree.ts:63` (Aside); `work/messaging.ts:111, :119, :185`; `work/matching.ts:44-47`; `work/mentions.ts:168, :197, :200`; `work/journalTools.ts:20, :29`; `work/reach.ts:48`; `work/threadToolHandlers.ts:269`.

`suggest_mission` text comes from the calling agent. On four answer paths it is stored as a null-sender message, which the service treats as the owner's words. Two effects follow.

First, on the Continue path, a Ritual thread can run `act_on_mission` or `change_setting` with Owner authority (H4).

Second, `@` tokens in that text grant the receiving turn mention reach: `read_journal` on the mentioned quest, `send_thread_message` to its top thread, and an appended note saying "The owner mentioned these with @" (H5). The specifications say a thread cannot widen its own reach this way (`thread-messaging/specifications.md` lines 15 and 94).

The worst variant is auto-open, which needs the owner's "open off-topic quests without asking" setting. That setting defaults to off (`core/settings.ts:30`). The click variants need the owner's choice, but the card may not show the full text (UI fact, not checked).

Validation: dummy-tenant service test with `shouldOpenOffTopicMissions` on and an `@quest:<id>` token in the suggestion text. Check the first message's note and whether `read_journal` succeeds from the new thread. Owner-observed: check whether a suggestion card shows the full text before Continue.

### SA-07 Dangling symlink counts as inside the workspace for file writes (Medium, provisional)

Location: `packages/service/src/core/folders.ts:29-36, :42-43`; `policy/containment.ts:35-39`; `policy/patterns.ts:104-105, :117`; `harness/threadFolder.ts:19-26` (sibling handles the case); `test/work/workspaces.test.ts:103-111` (no dangling case tested).

`realPathOf` falls back to the parent's real path when `realpath` fails. For a dangling symlink, `realpath` fails, so the link's name is treated as a regular path inside the folder. At RiskyOnly, a Write, Edit, MultiEdit, or NotebookEdit to that name is then auto-allowed, and the write follows the link to a target outside the workspace. The sibling check in `threadFolder.ts` handles this case with `lstat` and `readlink`; the per-file check does not. These file tools run outside any command sandbox (`patterns.ts:104`), so this check is their only containment.

Conditions: a lower-trust agent must create a symlink in the workspace (possible through a sandboxed Bash command), or the owner must clone a repository that contains one.

Validation: unit test beside the existing link tests. Create a dangling link whose target is outside, assert `isInsideFolder` is false (expected result today: true). Do not write through the link.

### SA-10 Always allow saves a literal `*` as a wildcard (Medium, provisional)

Location: `packages/service/src/policy/patterns.ts:13-18` (wildcard at :16-17), `:88-89`; `work/approvals.ts:259, :265-266, :357, :363-366, :383-387`; `policy/permissions.ts:37-48`; `harness/instructions.ts:36`.

When the owner chooses Always allow, the exact target is stored as the standing permission. `matchesPattern` then reads every literal `*` in that string as a wildcard. One approved command such as `rm -rf ./build/*` later covers any command with the same prefix and no shell operators, including ones with `..` segments that leave the folder. Covered escapes run with full computer access (`patterns.ts:88-89`). The owner was shown only the literal string. The instructions say standing permissions cover "these exact actions only".

Conditions: the owner must click Always allow on a command containing a literal `*`. Whether this happens in practice is owner behaviour.

Validation: local check of `matchesPattern('rm -rf ./build/*', 'rm -rf ./build/../../dummy-outside/x')` (expected true), then an approvals-layer check with a dummy thread. Owner-observed: after Always allow on such a command, check whether the standing-permissions list shows the literal pattern.

### SA-11 Owner token readable from the service process environment (Medium, provisional)

Location: `apps/desktop/src/main.ts:55, :120`; `packages/service/src/main.ts:56-57`; `packages/service/src/server.ts:37, :111`; `packages/service/src/harness/lineProcess.ts:31-34` (strips `ISKIOS_*` from children only).

The per-launch 256-bit owner token is in the environment of the service utility process. Any same-user process that can read that environment and find the random loopback port can open the owner socket, which accepts owner requests. Harness children are protected because `harnessEnvironmentOf` strips `ISKIOS_*`, but the service process keeps the variable.

Conditions: an agent thread's shell command, running as the same OS user, can read another process's environment (`ps -E`, or `/proc/<pid>/environ` on Linux). The sandbox profile decides this, and source does not show it. The port must also be discoverable from a process listing.

Validation: in the same sandbox profile a thread uses, start a stand-in process with a dummy `ISKIOS_TOKEN` and check whether a shell command can read it. Record only yes or no, never the value.

### SA-12 `iskios:endpoint` returns the owner token with no sender check (Medium, provisional)

Location: `apps/desktop/src/main.ts:64, :120, :122, :126-134`; `apps/desktop/src/preload.ts:8`; `apps/app/src/conversation/markdown.tsx:59`; `apps/app/src/conversation/markdownRules.ts:5-7`; react-native-web `Linking/index.js:99`.

The `iskios:endpoint` handler returns `ws://127.0.0.1:<port>/?token=<token>` with no sender, main-frame, or origin check. Every sibling handler that exposes capability has one (`checkTerminalSender`, `setTheme`, the updater predicate). `preload.ts` exposes the result as `iskios.endpoint()`.

The reach depends on Electron runtime behaviour, which source does not settle. The chain: a link in an agent reply (scheme limited to http, https, or mailto) is opened on the owner's click with `Linking.openURL`, which calls `window.open`. The main window has no `setWindowOpenHandler` and no `will-navigate` guard. Whether the child window receives the preload bridge is the open fact (`electron.d.ts:22671` does not name preload).

The missing check is proven in source. Its exploitability is not.

Validation: throwaway build with a loopback fixture page that links to a second page. Record only two booleans: whether `window.iskios` exists in the second page, and whether `endpoint()` resolves. Never record the value.

### SA-13 Thread MCP token readable from sibling harness argv or environment (Medium, provisional)

Location: `packages/service/src/core/endpoints.ts:27-40`; `work/threads.ts:163, :182`; `harness/claudeArgs.ts:186, :199-200`; `harness/openCodeLaunch.ts:107-110`; `harness/opencode.ts:155-165`; `work/mcp.ts:86-87`. Codex receives the URL over JSON-RPC and is not on this path.

Each thread's MCP endpoint URL embeds its bearer token. Claude Code receives the URL in `--mcp-config` in argv. OpenCode receives it in `OPENCODE_CONFIG_CONTENT` in its environment. Tokens last for the service lifetime, so a token read during one turn stays valid afterwards. A same-user process that reads those values could call thread tools as the victim thread. The impact is bounded by that thread's reach and approval state.

Conditions: a sibling shell or any same-user process must read another process's argv or environment. The sandbox profile decides this, and source does not show it.

Validation: two stand-in processes under the same sandbox profile, one with a dummy URL. Check whether the other can list the dummy argv, then confirm a dummy token resolves in a fixture. Use no real tokens or harnesses.

### SA-14 Threads can call `answer_prompt` on their own behalf (Medium, provisional, contested)

Location: `work/threadTools.ts:64, :381-385, :388, :397-408`; `work/threadToolHandlers.ts:31, :180-193`; `work/approvals.ts:316-352`.

`answer_prompt` is dispatched for any thread token, including Codex and OpenCode threads, for which it is not listed. Its handler runs the approval decision for a model-chosen tool name and input. The only restriction is the tool description, "Never call it yourself". A thread can obtain an allow decision and an `AllowedAutomatically` record attributed to Harness.

The hunters disagree. H1 says the thread can create those records and raise owner prompts. H3 says no allowance is created and nothing executes, because Claude Code still judges the real call with its own prompt. The verifier must settle this, including whether an `AllowedAutomatically` record changes later decisions (`approvals.ts:330`, `takeAllowance`, which is peer-owned).

Validation: fixture test with a dummy thread at work. Call `answer_prompt` with `tool_name` Bash and a dummy command, once as a Codex-style thread and once as a Claude-style thread. Check the returned text and whether a Harness-sourced activity row appears. Run no commands.

### SA-02 Realm folder ancestor passes the owner match (Low, provisional)

Location: `work/realmActions.ts:28`; `work/realmChecks.ts:38-51`; `policy/ownerRequests.ts:124-125, :172-176`; `work/guildmasterRealms.ts:35`.

The owner writes a realm name and a folder path. The Guildmaster can pass an ancestor such as `/dummy/root` for `/dummy/root/projects/app`. The phrase match accepts the ancestor because the next character is a path separator, which the lookahead does not exclude. The realm is then created with no question, tied to a broader folder. The same phrase rule applies to a shorter title for `rename_realm` and `change_setting`. Realm duplicate names do ask, which is the right control.

Blocker: whether `createRealm` accepts an ancestor with no existing realm was not reviewed. Whether the model picks an ancestor is model behaviour.

### SA-04 Duplicate quest titles pass as an unambiguous target (Low, provisional)

Location: `work/guildmasterProvenance.ts:107-155` (rivals at :114); `policy/ownerRequests.ts:169, :179`; `work/missions.ts:107` (no title uniqueness).

Quest titles are not unique. An identical rival span is treated as covered, so when two quests share a title the named test passes for whichever quest the model picked by id. `actOnMission` (`guildmaster.ts:356-359`) then archives, stops, or marks Done that quest. Realm duplicate names do ask (`realmActions.ts:27`), so quests are the inconsistent case.

Validation: pure check of `isNamedByOwner` with two rivals sharing the target title, expecting an ambiguity-aware result of false. Local store test that two quests can share a title.

### SA-15 Sandboxed threads can write the owner's npm cache, which a later install trusts (Low, provisional)

Location: `harness/claudeArgs.ts:146-152` (allowWrite includes `~/.npm`, `~/.bun/install/cache`); `harness/openCodeSandbox.ts:34-40`; `test/harness/claude.test.ts:196-203` (pins the grant); `work/accounts.ts:120-131`; `harness/harnessInstallation.ts:15-17`; `documentation/changelog/0.1.0-Prototype.md:2661` (CHG-0208 residual, which does not mention the owner's unsandboxed npm reading the same cache).

The Claude Code thread sandbox can write the owner's real npm cache. Iskios's harness install (`npm install --global`, `@latest`, lifecycle scripts enabled, outside any sandbox) reads packument metadata from that cache. From source, npm does not check packument integrity, and the tarball integrity comes from the same packument. A sandboxed thread that writes a poisoned packument for a harness package could therefore choose what the owner's install runs. The install only runs when the harness is not installed (`accounts.ts:122-125`), or when the owner runs an npm command.

Conditions: an owner Install of a missing harness, or an owner npm command, after the write. Whether a poisoned entry survives a registry answer (a 304 or a fresh 200) is npm runtime behaviour. Npm facts come from npm 11.20.0 outside the repository. Iskios does not pin the owner's npm version.

Validation: run only inside an OS-enforced sandbox with no external network, a scratch HOME and cache, and a loopback fixture registry serving a dummy package. Owner-observed: run `npm config get cache` and check whether a sandboxed thread can create and delete one dummy file there.

### SA-16 Floating third-party action tags in the release pipeline (Low, provisional)

Location: `.github/workflows/package.yml:29, :72` (`oven-sh/setup-bun@v2`, plus `actions/checkout@v7`, `actions/upload-artifact@v7`, `actions/download-artifact@v8`); `:86` (build); `:116-130` (uploads); `:139` (release job, `contents: write`); `:141-150` (downloads); `:166` (SHA512SUMS recomputed); `:176-177` (upload and publish).

The package job runs third-party actions pinned to movable tags. The installers and `latest*.yml` it builds are uploaded as artifacts. The release job, which has write access, downloads them, recomputes `SHA512SUMS` over the downloaded files, and publishes. Those checksums match whatever was uploaded, so they do not detect tampering before upload.

Conditions: an upstream action tag must be moved or compromised. That is an external fact, and the source does not show it. Repository rulesets and environment protection on the release job are hosted settings, also not visible.

Validation: owner-observed, without triggering a run. Read the latest tag run log for the resolved SHAs, and list the rulesets for tags and `main`.

## 5. Uncovered boundaries (gaps for the critic)

1. Harness launch argv and environment carrying the MCP URL (raised by H1 and H2). Each harness's sandbox process visibility is not checked. This may be merged with SA-13, but it needs its own unit.
2. `suggest_mission` answer paths: Continue, New quest, Aside, and auto-open, with their match, realm, and budget checks (H5). These paths carry SA-06.
3. `deployOwnRelay` and the Cloudflare API token: scrubbing, redirect refusal, and the relay origin built from API output (H7). The stored relay origin also lacks validation (section 7, item 14).
4. Remote-debugging port on the packaged app (H9). `check-package.ts` launches with `--remote-debugging-port=0`. No source disables that switch, and the renderer exposes the owner token through `window.iskios.endpoint()`. This overlaps SA-11 and SA-12 and needs its own review.

## 6. Covered units with no finding

1. Harness spawn and environment, argv injection (H2): no flag injection found; `ISKIOS_*` stripped from children.
2. Ritual run and scheduling (H4): beginRun, budgets, archived realms, DST-safe scheduling.
3. Store, dispatch, and usage SQL (H5): request values bound as parameters; no request text spliced into SQL.
4. Cryptography and secrets (H6): settings, accounts, harness detail, price fetch. One hardening note (section 7).
5. Noise_NK handshake and pairing secret (H7): matches Noise NK; secret is single use, hashed, and consumed atomically.
6. Relay room access control (H7): host claim checked in constant time; clients get no authority from the room name.
7. Renderer injection (H8): no HTML sink; markdown links limited to http, https, and mailto; app-file traversal not found.
8. Self-update: download, checksum, stage, and swap (H9): swap restores the old app on failure; paths are argv-only.

Also covered: the Codex approval path (H3) and `questions.ts` (read-only).

## 7. Hardening and design decisions

The owner needs to decide the items marked "Decision".

1. Decision: the device-pairing spec contradicts itself on folder reach (lines 14 and 18). This decides SA-08.
2. Decision: does outbound data from sandboxed commands need a deterministic gate? Run 1 flagged this lead. The word-based classifier was removed. Inside the sandbox, any network host is allowed, and the sandbox is documented as containing damage, not data (`claudeArgs.ts:86-88`, `instructions.ts:23`). Outbound data is gated only by the model's judgment.
3. Decision: should Always allow store the exact target as a literal, with no wildcard reading of `*`? See SA-10.
4. Decision: should the Ritual named-approval path show schedule, realm, instruction, and Companion? See SA-01.
5. Decision: should briefings of other quests stay behind an owner mention? `find_missions` returns up to three other quests' briefings to any thread whose request shares words with them. The mission-journal spec (line 25) agrees; `journalTools.ts:23` and `reach.ts:43-44` say otherwise.
6. Decision: should `answer_prompt` be accepted only on the Claude permission channel, or bound to the pending request id? See SA-14.
7. Decision: should the sandbox deny reads of `~/.ssh` and `~/.aws`? Iskios's settings set no `denyRead`. `architecture.md` lists these as protected, while CHG-0208 accepts that the sandbox contains damage, not data. Those two documents disagree.
8. Environment allowlist for agent threads. Harness processes inherit the whole service environment except `ISKIOS_*` keys (`lineProcess.ts:31-34`). Sandboxed Claude threads can read it through Bash. Each harness needs its own provider key, so this is the owner's decision.
9. Settings decode fallback: an unreadable saved settings row resets every choice, including approval level and budgets, to defaults without a log line (`core/settings.ts:61-65`). Merge per key and report the failure.
10. Account folders are created with default permissions (`work/accounts.ts:152`). Use `0o700`, as `openCodeSandbox.ts:147` does.
11. Workspace skills shadow global skills of the same name (`work/skills.ts`, `work/messaging.ts:105`). Show the skill's source path to the owner when that happens. Also, `readSkillFolder` follows symlinks (`skills.ts:29-31`); check with `lstat`.
12. Thread tokens are never revoked. A deleted thread's token keeps resolving (`endpoints.ts:27-36`). Prune on delete.
13. The owner socket and the MCP endpoint do not check Origin or Host (`server.ts:37`, `mcp.ts:86-91`). Hardening only, since the token is held by the renderer.
14. Remote relay origin: `setRelayOrigin` stores any string (`hostAccess.ts:140-145`), and the host claim is sent in the relay URL query (`relay/src/client.ts:80`, `route.ts:30`). Apply the same origin check used for pairing codes, and move the claim out of the URL.
15. The relay's first host claim is trust on first use (`relay/src/roomCore.ts:201-210`). The room name alone yields denial of service, not pairing.
16. The device stores its own token in plaintext in `remote_hosts` (`controller.ts:143`, `knownHosts.ts:61-63`). The device must present the token, so only OS file protection applies.
17. The pairing checksum is an unkeyed truncated SHA-256 (`pairingCode.ts:97-99`). It detects typing errors only, which is by design.
18. `cipherState` passes plaintext through when the key is null (`cipherState.ts:39, :45`). No current caller reaches this. Throw instead.
19. Thread-written text is stored as owner text with its `@` tokens intact (see SA-06). Strip the tokens, or mark the source on the stored message.
20. `find_missions` and `update_journal` (`journalTools.ts:33-39`): any thread can rewrite a quest's briefing, guarded by `basedOn` only.
21. Updates: verify the download again before install (`stage.ts:16` and `macUpdater.ts:84` use `hdiutil -noverify`). Allow-list download hosts (`macUpdater.ts:54, :62`, `network.ts:52` follows redirects). Use the same trust root for checksums, or sign the checksum file. Mac identity is ad hoc (`electron-builder.yml`), and `stage.ts:26` removes quarantine, so Gatekeeper never assesses an update.
22. `ISKIOS_UPDATE_URL` and `ISKIOS_UPDATE_OPENER` take effect whenever `ISKIOS_DATA_DIR` is set (`setup.ts:40-42`). Gate them behind a build-time flag.
23. Electron version mismatch: `electron-builder.yml:5` pins 45.2.3, but the installed version is 45.3.1 (`package.json:21`). Pin one value.
24. Release job: no GitHub environment with required reviewers (`package.yml:132-139`). Publish authority equals repository write access. Confirm rulesets in repository settings.
25. Upload steps have no `name:` (`package.yml:116-130`), while the release job expects named `Iskios-*` artifacts (`:143`). Confirm in a recent tag run. This is functional, not a security finding.
26. Terminal `cwd` accepts any absolute folder, despite a "realm folder" comment (`terminals.ts:47-48`). The shell runs with the owner's access, so this is hardening.
27. Setting-theme IPC checks sender and origin but not `senderFrame === mainFrame` (`main.ts:171-179`). Impact is the icon only.
28. Agent-reply links open with no confirmation (`markdown.tsx:59`), unlike terminal links, which ask first.
29. Packaged-app origin check: `URL.origin` is the string `'null'` for `iskios-app://` (`main.ts:149, :174, :186`), so the test accepts any opaque-origin main-frame URL. Compare scheme and host instead. The same predicate guards the updater.
30. `appFiles.ts:10-12`: keep normalization before the root join if the function is refactored.
31. The `Ritual` run is not re-checked for staleness after admission (`rituals.ts`). A held run starts later when released. This is visible behaviour, not a boundary failure.

## 8. Cross-hunter overlaps (for the critic to merge)

1. SA-06 (H4 and H5): the same root cause, thread text stored as owner words.
2. SA-08 (H6 and H7): the same paired-device roots bypass.
3. SA-11, SA-12, and the uncovered debug port (H1, H8, H9): the owner token in three places, each with a different exposure.
4. SA-14 (H1 and H3): contested. H1 says a thread creates authority; H3 says it creates no allowance.
5. SA-02 and SA-04 (H4): both name-matching weaknesses in the owner-named check. They share a root cause with SA-03.

## 9. Not yet done

1. The post-wave coverage critic has not run. It should add the uncovered boundaries in section 5 and check the merges in section 8.
2. Verification has not run. Each candidate needs a fresh adversarial verifier, which tries to refute it and must reach a verdict.
3. The bounded local checks listed under each candidate have not been executed. There is no OS-enforced runner, so none can run here.
4. `findings.json` and the skill-format reports have not been written. Run 2's folder under `~/security-audit-skill/iskios/run-2` holds the ledger and hunter prompts only.
5. Owner decisions in section 7 (items marked Decision) remain open.

## 10. Hunter reports

All nine hunters have reported. Their full JSON results are in the quest journal (entries 4 to 12) and in the hunter threads. None wrote files, and none ran target code.
