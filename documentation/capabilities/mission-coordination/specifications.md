# Quest coordination

## Problem and outcome

A user who is new to agents does not know which harness, model, or quest fits a request, and loses track of what is running.
In the Guild Hall, the user talks with Iskios, the app's assistant, to learn how the app works, find information, and manage realms and quests.

### Iskios, the assistant (CHG-0173)

From 2026-11-11 the entity formerly called Guildmaster is **Iskios**, a janitor of the app more than a dispatcher; the Guild Hall keeps its name. Everywhere below, "Guildmaster" reads as Iskios; the interface and the text the assistant reads say Iskios (CHG-0177); only the code identifiers, stored columns, request names, and settings keys keep the old name.

- Iskios never opens a quest on its own. When a request calls for one, it proposes it in the conversation as a card: title, realm (and its folder), and the Companion it would use, with a **Create** button; the owner picks the realm on the card (the proposed one preselected, or the Borderlands) before creating; realms tied to no folder are not offered yet.
  The card also offers the Companion by tier: Default and each of Light, Balanced, and Heavy the owner set in the Workshop, the one Iskios proposed preselected; with no tier set it only says the quest starts on the default Companion. The harness, model, and effort pickers stay behind "Customize the Companion" (CHG-0179). Nothing starts until the owner presses it.
- Iskios explains how the app works, and manages realms and quests at the owner's request, each operation under its existing rules and confirmations.
- The delegation below (matching with `find_missions`, tiers, hearing back from a quest it opened) is kept, but the opening of a quest follows the proposal above.
- Scope over time: Iskios is meant to be able to do everything the app does, usually asking the owner to delegate the work to a quest. Realms can be deleted; quests are never deleted, only archived. First batch: Iskios creates and renames realms, and proposes quests; deleting realms and the rest follow in later batches.
- Guild Hall as a hub (agreed 2026-11-11, CHG-0176; not built): one page with the hub above and Iskios's message box fixed at the foot, the conversation opening when the owner writes. The hub shows recent activity (the latest quests touched, with their state), what waits for the owner (quests in Attention, failed, or with a result to confirm), and a recap of the period (to define: quests finished, spending, Rituals run, since the last visit or today). Quick links and Iskios as a side panel on every screen are set aside for later.
- Not in this batch: explaining the app from its own documentation (to settle in a later batch).

## Agreed behavior

### Place

- Guild Hall contains one permanent thread outside every quest, where the user talks with Guildmaster.
  Its entry is pinned at the top of the dashboard, on the desktop and on the phone, and its thread cannot be deleted, archived, or ended.
- Guild Hall is the place the rail's first entry leads to: its conversation fills the screen, with the message box at the foot.
  There is no side panel (CHG-0179): the owner picks the realm on the proposal card, and a message sent from a realm's page still carries that realm.
  Every action Guildmaster takes shows in the conversation as a card: the quest or Ritual it opened, created, or continued, with a link, and the Companion it chose.
  A button beside Guildmaster's confirmation names the action and opens the quest or Ritual.
  It wraps below the confirmation in narrow windows and appears on its own until the confirmation is written.
  Each report from a quest it opened (a result, a Summons, a failure) likewise puts a button that opens that quest on the right of Guildmaster's reply to it.
- A setting hides Guild Hall, which is shown by default.
  Guildmaster's spending appears on the dashboard like a quest's, and it can have its own [budget](../budget-control/specifications.md).

### What Guildmaster does itself

- Guildmaster can access all information and resources managed by Iskios: Realms, the Borderlands, side-quests, conversations, journals, lore, Rituals, and app configuration, including retained archived information.
- It answers information requests and manages the app directly in the Guild Hall.
- It manages resources at the owner's request, including moving quests, changing their state, renaming them, and managing lore, Rituals, settings, and budgets.
  Each operation keeps its existing rules and confirmations.
- It delegates work by opening quests rather than threads beneath itself.
  Since it belongs to no quest, it does not show the off-topic suggestion.

The owner agreed to this expanded role on 2026-11-10 (CHG-0132).
The additional search and management operations still need design, implementation, and verification.

### Rituals

- A request to do something repeatedly on a schedule (every hour, every morning) is a [Ritual](../rituals/specifications.md), not a quest. Guildmaster creates it with `create_ritual`, on a preset schedule, and its reply says what it will do and when. It lists the existing Rituals in its context so it does not make one twice. A Ritual's quest stays in the Rituals place, and Guildmaster does not hear back from its runs.

### Opening a quest

- The owner can start a quest through Guildmaster or [directly from a Realm or the Borderlands](../mission-tracking/specifications.md#starting-a-mission).
  Direct creation starts a new quest without Guildmaster's matching or tier-selection turn (CHG-0133).
- When a realm page sends a request to Guildmaster, it includes the selected realm.
  Guildmaster checks for matching quests and places any new quest in that realm.
  The selected realm determines the initial placement; later changes follow the [quest move confirmation](../mission-tracking/specifications.md#quest-placement-and-moves).

- Guildmaster first looks for quests that fit the request with `find_missions`, which searches each quest's title, briefing, and opening request, and weighs an exact ticket key or link above plain words, so two requests about one ticket meet and offers **Continue in** for up to 3 matches, as the [off-topic suggestion](../thread-tree/specifications.md#off-topic-requests) does. When nothing matches, it still proposes a new quest as a card (CHG-0173); it opens none itself.
- Settings hold a default model and up to three optional tiers (Light, Balanced, Heavy), each a harness, model, and effort. Guildmaster picks a tier from how complex the request is, or the default when no tiers are set.
- Guildmaster picks the workspace the request implies, for example "fix the login bug in Iskios" picks the Iskios workspace, or none. Given a repository link, it clones the repository with `clone_repository`, or reuses its earlier clone, and proposes the quest there (see [workspace-attachment](../workspace-attachment/specifications.md#cloning-a-repository)).
- Its reply says in one sentence what it proposed, naming the tier only when it passed one, for example "Proposed on Balanced"; the card shows the realm and Companion, and the quest links from the card once the owner opened it.
  The user can change the harness, agent, model, and effort afterwards through a handover, or change the workspace through a [whole-quest move](../mission-tracking/specifications.md#quest-placement-and-moves).
- The new quest's top thread starts as **Open as new quest** does: with the request, global skills and intel, and nothing from another quest.

### Hearing back

- A quest that Guildmaster opened tells Guildmaster when it reports its result, enters Attention, or fails, and Guildmaster relays that to the user.
- Guildmaster reads the state of other quests only when the user asks.

### References between quests

- The owner references a quest, side-quest, or realm with `@` from any message box, Iskios's included, as [thread-messaging](../thread-messaging/specifications.md#mentions-with-) describes (CHG-0181, built in CHG-0182). For the turn it reaches, the receiving thread may read the mentioned quest's journal and message its top thread, or the mentioned side-quest; the message goes straight to it and the reply comes straight back, without Iskios. A mention is context: the thread decides from the owner's words whether to use it. A thread's own `@` in a message opens nothing.
- Without a reference, a thread, or the user writing in a quest's thread, can write to `@Guildmaster`. Guildmaster finds the quest that fits with `find_missions` and forwards the message there, or answers that none fits.
- Every message between quests shows in both threads as a normal message labelled with the sender's quest. Guildmaster shows it as a compact event line, not a chat bubble, for example "Release notes › Draft → Read my emails › Triage", and it stays out of Guildmaster's context.
- The [chatter guard](../thread-messaging/specifications.md#chatter-guard) applies to each pair of threads, across quests too.

### Context

- Guildmaster has no journal.
- Each turn, Guildmaster starts with its instructions, global intel, the dashboard as text, and its 20 latest messages. The local service summarizes older messages.
- The dashboard as text lists each quest that is not archived on one line: title, state, workspace, the first sentence of its briefing, and last activity. The local service builds it from stored data; Guildmaster never maintains it.
- Guildmaster can retrieve full journals, conversations, its own older messages, and other app information as needed to answer the owner's request.
  It retrieves information when needed instead of loading all app data into every turn.

### Lore

- Guildmaster follows the access exception in [lore scopes](../scoped-intel/specifications.md#scopes) and the save, change, widening, and deletion rules in that capability.

### Guildmaster's own settings

- The user chooses Guildmaster's harness, agent, model, and effort like any thread's. They are prefilled with the cheapest model available on the first installed harness, and the user can hand Guildmaster over at any time.

## External contract

Guildmaster uses these thread tools in addition to `find_missions`, `suggest_mission`, `send_thread_message`, the intel tools, and `read_journal`, which for Guildmaster takes the quest to read (another thread may pass a quest only when the owner mentioned it in the current turn, CHG-0181) (see [0005](../../architecture-decision-record/0005-thread-tools-over-mcp.md)):

| Tool | Purpose | Arguments | Answer |
| --- | --- | --- | --- |
| `suggest_mission` | Propose a quest as a card, or continue a matching one | The request, a title, the ids of matching quests (none when nothing fits); optionally a realm and a tier | What the owner chose, or a refusal when the realm named has no folder or does not exist (no card is made). There is no tool that opens a quest without the owner's choice (CHG-0173) |
| `create_realm` | Make a realm | A name, optionally a folder, and the user's exact words as `quote` | Done, or a refusal: no quote, a name or a folder a realm already has, a folder that does not exist |
| `rename_realm` | Rename a realm | The realm's name or folder, the new name, and the user's exact words as `quote` | Done, or a refusal: no quote, an unknown realm, a name another realm has |
| `create_ritual` | Create a [Ritual](../rituals/specifications.md) for a repeating request | The instruction, a title, a schedule preset; optionally a tier, harness, model, effort, and realm | The Ritual's title, schedule, and Companion, or a refusal and its reason |
| `act_on_mission` | Stop threads, archive, or rename, at the user's request | A quest, an action, the user's exact words asking for it as `quote`, for renaming a title, and for a confirmed ending the snapshot it was given | Done, or the confirmation the user must give first, or a refusal |
| `read_control_history` | Read Guildmaster's older messages | A query or a starting point | The matching messages |

Only Guildmaster can call these tools, except `suggest_mission`, which any thread calls for an off-topic message. Any thread can address Guildmaster with `send_thread_message`.
Direct creation uses the app's service interface; it does not grant ordinary threads access to Guildmaster-only tools.

The table covers the existing coordination tools.
The additional search and management tools for CHG-0132 need a contract and service-enforced access checks, following [ADR 0005](../../architecture-decision-record/0005-thread-tools-over-mcp.md).

## Acceptance and validation

- **Automated, with a fake harness**:
  - Guild Hall pinned, its conversation never deletable or archivable, and its entry hidden by the setting;
  - app-wide information requests answered in the Guild Hall without creating a quest;
  - retrieving information from conversations, journals, archived quests, and lore across all scopes and realm placements;
  - managing app resources at the owner's request with the same operation-specific rules and confirmations as the interface;
  - Guildmaster's app-wide access leaving ordinary threads' scoped visibility unchanged;
  - matching quests offered as Continue in before a new quest opens;
  - direct realm creation bypassing Guildmaster, while requests addressed to Guildmaster retain quest matching;
  - the tier picked from the request's complexity, the default when no tiers are set, and the choice shown in the reply;
  - the result, Attention, and Failed of a quest Guildmaster opened reaching Guildmaster, and nothing from quests it did not open;
  - Guildmaster acting on a quest only at the user's request, with the dashboard's confirmations;
  - a referenced thread in another quest receiving a message and replying directly, a quest reference reaching its top thread, and a message to another quest without a reference refused unless sent to Guildmaster;
  - `@Guildmaster` forwarding a message to the matching quest, or answering that none fits;
  - cross-quest messages labelled in both threads, shown as event lines in Guildmaster, and kept out of its context;
  - the chatter guard pausing two threads in different quests;
  - Guildmaster's starting context: the dashboard as text, global intel, and its 20 latest messages, with older ones summarized and retrieved when needed;
  - Guildmaster saving global intel only after approval.
- **Human acceptance**: on the desktop and on the phone web app, the user asks Guildmaster for 3 different tasks, sees one continue an existing quest and two proposed as new quests on different tiers, which the user opens from the cards, gets told in Guildmaster when one needs them, and has a thread in one quest ask a thread in another a question with `@`.

## Requirements

- [Approval per action](../../requirements.md): Guildmaster's global intel saves and its actions on quests each need the user, and an approval never carries over.
- [Single user](../../requirements.md): one Guildmaster per installation.
- [Local data](../../requirements.md): Guildmaster's history stays on the user's computer.

## Dependencies

- [quest-tracking](../mission-tracking/specifications.md): the dashboard, quest states, and ending quests.
- [thread-tree](../thread-tree/specifications.md): `find_missions`, Continue in, and how a new quest starts.
- [thread-messaging](../thread-messaging/specifications.md): messages, references, and the chatter guard.
- [quest-journal](../mission-journal/specifications.md): the briefings Guildmaster reads.
- [scoped-intel](../scoped-intel/specifications.md): lore access and changes at each scope.
- **thread-handover**: changing a quest's or Guildmaster's harness and model.

## Exclusions

- Work delegated to quest threads, which Guildmaster coordinates from the Guild Hall.
- Guildmaster acting on quests on its own initiative.
- More than one Guildmaster.

## Provisional choices to review

- **The owner's words authorize an action.** `act_on_mission` is refused unless the `quote` appears in the owner's message that started Guildmaster's current turn; an archive with threads at work first answers with the dashboard's question and goes ahead only with that question's snapshot and the owner's agreement quoted in a later message. A quote cannot prove that the owner meant it for this action.
- **Stop** takes no confirmation, as the dashboard's Stop does not.
- **A quest reports once its turn has ended**, so its closing reply travels with the report; a quest that stands in the same report is not told twice, and one that leaves it is told again later.
- **Hiding Guild Hall** removes its rail entry and opens the window on the quests; the screen is still where a realm page's message goes.
- **Tiers** are optional Companions; a tier not set, or no tier, starts on the Settings default, never on Guildmaster's own cheap Companion. Guildmaster's own Companion starts on Claude Code's cheapest model (Haiku) when the default harness is Claude Code, and on the harness's own default otherwise.
- **Not built**: the 20-message window with older messages summarized (the harness session carries the conversation); the event lines in Guildmaster for messages between quests (the `@` references themselves are built, CHG-0182); Guildmaster's spending on the quests' dashboard (it shows on its own screen).
