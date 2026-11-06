# Inspirations

Products OpenMission follows for ideas. For each: what it does well, what OpenMission took or may take, and what to check on at the next review. Ideas are written independently and follow [Respect upstream licenses](requirements.md); code is reused only where a decision record allows it.

Review this list when starting a capability, and every few weeks: read each product's changelog, releases, or documentation, and add what is new below with its date. Record a taken idea in the capability's specifications and the changelog; put a candidate in the [backlog](backlog.md).

## Agent workspaces and harnesses

### OpenBot

- **Good ideas**: an agent panel per agent; installing and updating each harness's command-line tool from its official package, checked against the published hash; how permissions are asked of casual users.
- **Taken**: harness installs and updates ([architecture](architecture.md)); the thread panel idea ([backlog](backlog.md)); built-in safe git (CHG-0032 in the [changelog](changelog.md)).
- **License**: PolyForm Noncommercial 1.0.0. Ideas only, no code ([0001](architecture-decision-record/0001-new-codebase-not-a-fork.md)).
- **Check on**: its memory, routine, and approval features, as the closest product to OpenMission.

### MausBot

- **Good ideas**: runtime event and driver contracts, an ACP client and vendor adapters, Claude Code and Codex drivers, a delegation-tree state machine, process and recovery helpers.
- **Taken**: these modules may be cherry-picked under Apache 2.0 with their notices ([0001](architecture-decision-record/0001-new-codebase-not-a-fork.md)).
- **License**: Apache 2.0, except its `enterprise/` folder, which is not used. Its brand is not reused.
- **Check on**: new versions of the drivers OpenMission takes code from.

### Paseo

- **Good ideas**: a relay Worker with end-to-end encryption; an Electron window that loads the Expo app's web build.
- **Taken**: the relay and its encryption ([0001](architecture-decision-record/0001-new-codebase-not-a-fork.md), [0003](architecture-decision-record/0003-per-user-relay-carrying-all-traffic.md)); the desktop shell approach ([0004](architecture-decision-record/0004-electron-desktop-shell.md)). Its shared, project-run relay was rejected.
- **License**: Apache 2.0.
- **Check on**: relay and encryption changes.

### Delta and Zed's DeltaDB

- **Good ideas**: a handover that replays the full history to the new harness; version control for agent edits and conversations (DeltaDB).
- **Taken**: full-history handover ([0006](architecture-decision-record/0006-handover-replays-full-history.md)).
- **License**: Delta is closed, so ideas only. DeltaDB is not open source as of 2026-11-04.
- **Check on**: whether DeltaDB is published as open source; it could replace OpenMission's own copies ([backlog](backlog.md)).

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
