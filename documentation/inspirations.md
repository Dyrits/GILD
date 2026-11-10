# Inspirations

Products Gild follows for ideas. For each: what it does well, what Gild took or may take, and what to check on at the next review. Ideas are written independently and follow [Respect upstream licenses](requirements.md); code is reused only where a decision record allows it.

Review this list when starting a capability, and every few weeks: read each product's changelog, releases, or documentation, and add what is new below with its date. Record a taken idea in the capability's specifications and the changelog; put a candidate in the [backlog](backlog.md).

## Agent workspaces and harnesses

### OpenBot

- **Good ideas**: an agent panel per agent; installing and updating each harness's command-line tool from its official package, checked against the published hash; how permissions are asked of casual users.
- **Taken**: harness installs and updates ([architecture](architecture.md)); the thread panel idea ([backlog](backlog.md)); built-in safe git (CHG-0032 in the [changelog](changelog.md)); (2026-11-07) the window's look: a sidebar on a grey frame beside a raised panel, a neutral palette with one blue accent, tinted state pills, and a composer with its pickers inside (CHG-0056).
- **Attachments** (2026-11-10, from its source `nightly-labs/openbot`): a file added to a message is first written to a managed drafts folder; sending moves it to a transfers folder with a manifest (name, type, size, sha256), and the message carries cards that survive the file's deletion ("file not found"); limits of 10 files, 100 MB each, 250 MB in all; Codex-style `localImage` items turned into base64 `image` blocks for ACP; Claude Code receives only a text list of local files; image or plain file is told by extension, so HEIC and TIFF are never sent as images. Taken: upload first then reference, and cards that outlive the file (CHG-0102).
- **License**: PolyForm Noncommercial 1.0.0. Ideas only, no code ([0001](architecture-decision-record/0001-new-codebase-not-a-fork.md)).
- **Check on**: its memory, routine, and approval features, as the closest product to Gild.

### MausBot

- **Good ideas**: runtime event and driver contracts, an ACP client and vendor adapters, Claude Code and Codex drivers, a delegation-tree state machine, process and recovery helpers.
- **Taken**: these modules may be cherry-picked under Apache 2.0 with their notices ([0001](architecture-decision-record/0001-new-codebase-not-a-fork.md)).
- **Attachments** (2026-11-10, from `milind-soni/OpenMausBot`): paste, drop, and a picker; Electron's native `clipboard.readImage()` keeps the Paste item enabled for images; uploaded over HTTP, the message carries `<attached-image path>` tags; Claude Code gets a base64 block, Codex an `image` item with a data URL (its box could not see paths), ACP an `image` block only when `promptCapabilities.image` is true, with a clear error otherwise; 10 MB per image, 10 per turn.
- **License**: Apache 2.0, except its `enterprise/` folder, which is not used. Its brand is not reused.
- **Check on**: new versions of the drivers Gild takes code from.

### Paseo

- **Good ideas**: a relay Worker with end-to-end encryption; an Electron window that loads the Expo app's web build.
- **Taken**: the relay and its encryption ([0001](architecture-decision-record/0001-new-codebase-not-a-fork.md), [0003](architecture-decision-record/0003-per-user-relay-carrying-all-traffic.md)); the desktop shell approach ([0004](architecture-decision-record/0004-electron-desktop-shell.md)). Its shared, project-run relay was rejected.
- **Attachments** (2026-11-10): paste listener on web and Electron, a native paste module on mobile; the image travels as base64 inside the WebSocket message (the same path serves the phone through the relay); Claude Code gets a base64 block, Codex a temp file (mode 0600) as `localImage`; no capability check for ACP, so an unsupported type reaches Claude as a silent skip.
- **License**: Apache 2.0.
- **Check on**: relay and encryption changes.

### Delta and Zed's DeltaDB

- **Good ideas**: a handover that replays the full history to the new harness; version control for agent edits and conversations (DeltaDB).
- **Taken**: full-history handover ([0006](architecture-decision-record/0006-handover-replays-full-history.md)).
- **License**: Delta is closed, so ideas only. DeltaDB is not open source as of 2026-11-04.
- **Check on**: whether DeltaDB is published as open source; it could replace Gild's own copies ([backlog](backlog.md)).

### intentic ([intentic.dev](https://intentic.dev), [source](https://github.com/intentic/intentic))

- **What it is**: an open-source workspace that runs several coding agents in parallel, each in its own Docker sandbox and git branch, nothing landing until approved. Desktop app, terminal install, self-hosted server, or paid hosted sandbox. Several harnesses (Claude, Codex, Gemini, Cursor, Devin, Grok, Kimi, GLM), each through the user's plan or key.
- **Good ideas** (from its site, 2026-11-07):
  - the UI, which the user likes: a board with Attention, Active, and Finished columns beside a docked chat; whatever needs the user comes first;
  - cards showing model, branch, cost so far, and diff stats;
  - a plan with an Approve button in the chat; a review view with changes grouped by repository, a diff per file, the agent's report beside it, and a Land now button;
  - a left rail of sandboxes and the Claude and Codex plan usage on the home view; a Devices page listing machines, status, resources, and mirrored ports;
  - an integrations catalogue grouped by purpose, with connected services checked;
  - automations started by a git push, Sentry, Stripe, email, Slack, Discord, or cron, with an optional filter command deciding whether to wake an agent;
  - secrets injected only into turns that may use them, never written to disk.
- **Taken**: none yet. Several ideas are already planned for Gild; compare before adding to the [backlog](backlog.md).
- **Attachments** (2026-11-10): paste, drop, and a paperclip all call one `attach()`; chips with thumbnails and upload progress; files uploaded at once to the workspace and the message carries paths; Claude Code reads them through a path note, Codex takes `localImage`, ACP an `image` block only when `promptCapabilities.image` is true; abandoned uploads leave files on disk. Taken: one step for paste, drop, and picker (CHG-0102).
- **License**: MIT (sandbox, CLI, workspace, platform). Code may be reused with its notice where a decision record allows it.
- **Check on**: its [changelog](https://intentic.dev/changelog/), [releases](https://github.com/intentic/intentic/releases), and [docs](https://intentic.dev/docs/), especially UI changes and whether it adds nested agents or threads. Its name is close to "Intent", a candidate for Gild's mission term.

### Rakazo ([rakazo.com](https://rakazo.com), [source](https://github.com/elie222/rakazo))

- **What it is**: an open-source platform of AI agents ("bots") that each hold a job, such as Inbox Manager, Sales Outbound, Coding Agent, Bug Triage, or Chief of Staff. It comes as a web, desktop (macOS, Windows, Linux), and mobile (iOS, Android) app. It can be self-hosted for free with every feature, or hosted with a cloud computer billed in computer hours. Models come from the user's own Claude or ChatGPT subscription, an API key, OpenRouter, or a local server (Ollama, LM Studio). From the team behind Inbox Zero.
- **Good ideas** (from its site, 2026-11-09):
  - a bot learns a task by watching the user do it once, then saves the steps as a reusable skill;
  - memory a bot keeps and shares with the team, such as a preference ("Prefers short replies");
  - work started by a schedule, a webhook, a GitHub event, or a change the bot watches, carrying on while the user's computer is off;
  - bots handing work to each other and working in groups;
  - the user choosing which actions need sign-off; a "held pile" of drafts awaiting approval; a bot that calls the user in the app when it needs them;
  - a different model per bot;
  - reachable from Slack, and when self-hosted from iMessage or SMS, WhatsApp, and Telegram;
  - a summary per run (archived, replied, drafted, flagged) and a mobile inbox showing which rows wait on the user.
- **Taken**: none yet. Its approvals, a model per agent, and delegation are already in Gild. Learning by demonstration, event triggers, and the held pile of drafts are candidates; compare them before adding to the [backlog](backlog.md).
- **Attachments** (2026-11-10): paste only when `clipboardData.files` is not empty, so text paste is untouched; 10 MB and 4 files per message; jpeg and png shrunk to 1600 px at quality 0.7 on web and mobile; the server refuses an image for a model without vision, and the client offers to send it as a file. Taken: the paste check and the refusal for a model without vision (CHG-0102).
- **License**: Apache 2.0 according to its site; not checked in the repository. Ideas only until it is checked.
- **Check on**: its [docs](https://rakazo.com/docs/), [releases](https://github.com/elie222/rakazo/releases), and [integrations](https://rakazo.com/integrations/), especially how skills learned by demonstration are stored and how approvals are configured.

### Turnstone ([myturnstone.ai](https://myturnstone.ai))

- **What it is**: a Mac app (Apple silicon and Intel) of AI teammates ("Agents") that run on the subscriptions the user already pays for: OpenAI, Claude, Gemini, Grok, OpenRouter, Cursor, or Ollama. Free on the Mac; Turnstone Cloud, announced as coming soon at $49 a month, keeps Agents running while the Mac is closed and reachable from a phone.
- **Good ideas** (from its site, 2026-11-09):
  - a first Agent, the Chief of Staff, that sets up the other Agents for each part of the work;
  - switching models in the middle of a conversation while the Agent keeps its context;
  - memory of how the user likes the work done, and a writing style learned from sent emails;
  - recurring jobs saved from plain language, such as "every weekday at 9";
  - any Agent handing a task to another, with the result coming back to the user's chat;
  - each Agent working in its own tab of a built-in browser;
  - drafts reviewed before sending: "Nothing goes out until you send it";
  - connected apps (Gmail, Slack, Granola, Google Calendar, WhatsApp) read on a schedule the user chooses, with updates shared across Agents;
  - Agents, chats, and memory kept on the Mac "in a folder you can open".
- **Taken**: none yet. Results coming back to the opener's chat, a model per agent, and local data are already in Gild. A model switch keeping context is close to the staged thread-handover ([0006](architecture-decision-record/0006-handover-replays-full-history.md)); a setup agent, plain-language schedules, and scheduled context sync are candidates; compare them before adding to the [backlog](backlog.md).
- **License**: closed, as far as its site shows: no source or license is published. Ideas only.
- **Check on**: its [changelog](https://myturnstone.ai/changelog), [how-to](https://myturnstone.ai/howto) and [academy](https://myturnstone.ai/academy) pages, especially how a model switch carries context and how the Chief of Staff sets up Agents; and whether Cloud ships.

### Cindy ([cindy.app](https://www.cindy.app), [source](https://github.com/makecindy/cindy))

- **What it is**: an open-source AI agent running on the user's own computers and phone (macOS, Windows, Linux, iOS, Android), bringing existing agents and subscriptions together. Harnesses: Claude Code, Codex, or Pi; "A harness is an execution engine; models are a separate choice." Models from the user's subscriptions or keys (Claude, ChatGPT, SuperGrok, Kimi Code, MiniMax, GitHub Copilot…), Cindy's paid model service, or local models (beta: Ollama, llama.cpp, LM Studio). Free with every capability when bringing one's own key; Plus from $20 a month for its model service; Team and Enterprise coming.
- **Good ideas** (from its site, 2026-11-09):
  - one task carried across screens: the same task, conversation, and files on every device, with file preview and transfer, and remote desktop to operate a connected computer from the phone;
  - harness and model chosen separately, in one place;
  - a task split into planning, parallel workers, and a review step, each on its own harness and model;
  - requests needing confirmation waiting for the user, on the phone too; diffs, Git worktrees, checkpoints, and stopping a task;
  - memory of preferences, project context, and methods; installable skills from a SkillHub; plugins and MCP;
  - named teammates with a role, memory, and skills, scheduled routines, and teammates called from Slack or Feishu;
  - usage controls and cost attribution for teams;
  - an honest local-first statement: "Local-first does not mean no data ever leaves your device", naming what leaves (model requests, sync, remote access, plugins).
- **Taken**: none yet. Separate harness and model choice, a thread per worker on its own runner, approvals answered from the phone, and budgets are already in Gild. A planning, workers, and review split as a mission template, checkpoints, and its local-first statement are candidates; compare them before adding to the [backlog](backlog.md).
- **Attachments** (2026-11-10): a pasted bitmap is written to disk as `clipboard-<time>.png`; Claude Code gets a base64 block after a magic-byte check and a resize to 1568 px (webp, 85), under 5 MB encoded, else an `@path` mention; Codex a `localImage`; its vision-bridge design records that a model such as GLM drops images silently, so only an up-front check catches it. Taken: the 1568 px reduction and the signature check (CHG-0102).
- **License**: Apache 2.0 according to its site; not checked in the repository. Code may be reused with its notice where a decision record allows it, once checked.
- **Check on**: its [docs](https://github.com/makecindy/cindy/tree/main/docs) and [releases](https://github.com/makecindy/cindy/releases), especially its Pi harness, how it moves a task between devices, and how the review step is wired; as the open-source product closest to Gild's multi-harness tree.

## Interface and design

### Crest ([crestbrowser.com](https://crestbrowser.com), [source](https://github.com/pauljoda/Crest))

- **What it is**: an open-source browser for Mac, iPhone, and iPad (SwiftUI; Chromium and WebKit on Mac). Its main idea is **Spaces**: work, home, research, or a private session, each with its own cookies, history, tabs, credentials, settings, and sync identity, and **Sub-Spaces** that share sign-ins within a group.
- **Good ideas** (from its README, 2026-11-09):
  - **Crest Studio**: each Space has a crest on its sidebar background, designed from a template through steps (shape, field, band, emblem, border, finish, sidebar), each step choosing among previews of the user's own crest, with Shuffle and Undo;
  - every part of the crest has its own color, named by what it paints;
  - emblems from heraldic artwork, emoji, monograms, or a searchable symbol picker;
  - an Appearance page with presets, live preview, and per-setting reset.
- **Taken** (2026-11-09): the crest system for realms and Crest Studio: a plate cut to a shape, a field with a second color, a band, an edge, a trim, and an emblem, drawn on a 100 by 100 grid ([`crestShapes.ts`](../apps/app/src/crest/crestShapes.ts)); the heraldic emblems, which reach Gild through Crest Studio and are credited in [`crest-credits.md`](../apps/app/src/crest-credits.md) (game-icons.net, CC BY 3.0). The idea of giving each context a visible identity matches Gild's realms.
- **License**: MPL-2.0. Ideas are written independently; the crest figures carry their own CC BY 3.0 credits. Check the license's file-level terms before copying any of its files.
- **Check on**: its [releases](https://github.com/pauljoda/Crest/releases) and [guides](https://crestbrowser.com/guides/), especially new Crest Studio steps or emblem sources, and whether Sub-Spaces (shared sign-ins across a group) suggest grouping realms.

## Memory and long-running agents

### Rerun ([rerun.build](https://rerun.build), [source](https://github.com/rerun-build/rerun))

- **Good ideas**:
  - a shared "brain" of pages (offering, market, voice, team, stack) that every coworker reads before each run, plus a private memory per coworker;
  - memories that fade by kind unless used, each use slowing the fading, dormant below a strength of 0.15 and archived to a file below 0.05, never deleted;
  - only an index of memories in context, with full text read on demand and new lines added at the end so the cached prompt stays valid;
  - duplicates merged on save after comparing with the closest five memories, conservatively;
  - tests for memory behaviour, such as a greeting not refreshing every memory;
  - each scheduled run starting a fresh session, so what carries over must be written down; templates never include memories or credentials.
- **Taken** (2026-11-06): fading by kind, the global index in context, replacing duplicates, and its fading tests ([scoped-intel](capabilities/scoped-intel/specifications.md)).
- **Check on**: changes to its memory code (`apps/engine/src/memory/`), its [second brain](https://rerun.build/features/second-brain) page, and its [concepts](https://docs.rerun.build/concepts.md) and [automations](https://docs.rerun.build/agents/automations.md) documentation.

### souls.house and its hearth guide ([souls.house](https://souls.house), [hearth](https://github.com/swombat/hearth))

- **Good ideas**:
  - journals compressed in steps: days into weeks, weeks into months, months into years, keeping the raw entries;
  - append-only writes, so several instances can write at once;
  - honest skips: when nothing is worth keeping, the agent keeps nothing;
  - a memory node as a pointer: a one-line summary, why it mattered, an importance set when created, and a link to the journal entry;
  - recall that strengthens what it finds; the closest match always first, and rare words (in three memories or fewer) pulling their memories forward;
  - capsules: sealed notes that come back on a date or condition, which the agent then raises, holds, or dismisses;
  - model changes never silent, memory export, nightly backups, and a public [decisions](https://souls.house/decisions) page explaining each choice and what would change it.
- **Taken** (2026-11-06): honest skips, recording an intel's origin, rare-word ranking, and history with undo ([scoped-intel](capabilities/scoped-intel/specifications.md)). Journal compression and capsules are in the [backlog](backlog.md).
- **License**: not checked. Ideas only until it is.
- **Check on**: its [features](https://souls.house/features) and decisions pages, and the hearth guide's narrative memory (`docs/05-narrative-memory.md`) and mnemodyne (`docs/12-mnemodyne.md`) notes.

### Timon ([timon-ai.com](https://timon-ai.com))

- **Good ideas** (from its marketing site only): every lesson becomes a rule for the next run; agents read a local notes vault before they act; every run leaves a trace that can be replayed step by step.
- **Taken**: none yet. Rules as a never-fading intel kind match its first idea.
- **Check on**: whether it publishes documentation on how lessons and the vault are stored, and its [pricing](https://timon-ai.com/pricing) page for new features.

### Delta conversation terminals, checked 2026-11-10

Delta's [terminal documentation](https://delta.dev/docs/agents/terminals) describes `!` on an empty composer line opening a shell, ordinary exclamation marks staying text, and sending a frozen terminal snapshot while its process continues.
The owner's screenshot shows that snapshot as a terminal block inside the owner's message, with accompanying text beneath it.
Gild takes that interaction independently, using the owner's home folder without a realm and the realm root with one, as the owner requested.
No Delta code was copied.
