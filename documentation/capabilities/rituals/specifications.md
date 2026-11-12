# Rituals

Status: built on 2026-11-10 from the owner's answers (instruction, schedule and models; fallback models shown explicitly; a place of their own, apart from the quests; runs in the main quest; schedule presets; one quest per Ritual; missed runs skipped; manual run) (CHG-0098; made a place apart from the quests in CHG-0100). Everything the owner did not decide is **provisional** until the owner reviews it.

## Problem and outcome

The owner repeats the same request: a morning digest, a weekly dependency check. A Ritual is that request with a schedule, a Companion (model), and fallback Companions. It runs by itself in its own quest and the owner can also run it by hand at any time. Rituals are the "routine" of the glossary, under its guild name.

## Agreed behavior

- **A Ritual** has a title, an instruction, a schedule, a harness with account, Companion (model) and effort, an ordered list of fallback Companions, an optional realm (workspace), and an on or off switch.
- **One quest per Ritual**: creating a Ritual creates its quest. Each run is a turn in that quest's main thread, so the quest holds the whole history of the Ritual. The owner opens side-quests beneath it as in any quest.
- **Schedule presets only** (no cron): every day at a time; weekdays at a time; every week on a day at a time; every month on a day at a time; every N hours. Times are the computer's local time.
- **Where the scheduler runs**: the local service. It sleeps until the next Ritual is due, wakes on any change and at least hourly. A run that starts more than 5 minutes after its time (the app was closed or the computer asleep) is skipped, not caught up; the quest says nothing for it, and the Ritual moves to its next time.
- **Run now**: a button on the Ritual's card and in its quest's panel starts a run at any moment, whatever the schedule and the switch. A run is refused while the quest's main thread is at work (Running, Awaiting word, or Summons) or Stopped, with the reason for a manual run; a scheduled one is skipped.
- **What a run does**: the thread takes the primary Companion again (a handover line if it had fallen back), then receives the instruction as a message under its trigger (first line "Ritual · scheduled 07:00" or "Ritual · run by you"). It is stored as an owner message, but marked as the run's own: it never counts as the owner's words (CHG-0208). The thread runs it with its approval level: commands run unasked in the sandbox, and an escape or an action the thread judges consequential asks, whatever the instruction says (action-approval).
- **Reviewed scope** (CHG-0208): a Ritual's runs have no owner turn, so the structural actions they may take without asking are listed in its scope: each entry an operation (stop a quest's threads, mark a quest Done, archive a quest, rename a quest, change a setting), its exact target (a quest's title or id, or a setting's name), and its exact new value where it has one (the new title, or the setting's value as JSON). The scope is empty by default, reviewed in the Ritual's form, and revoked by removing entries; a Ritual created by Guildmaster starts with none. During a run, an action exactly in scope runs and leaves a line; anything else asks once. A setting kept for the owner (approval level, budgets, price fetching) cannot be in a scope. The scope holds no commands: protected commands need none.
- **Fallback Companions**: when a run's turn fails (usage limit, overload, model unavailable, harness signed out), the run is handed over to the next Companion of the list, which may be on another harness, and the instruction is run again with the conversation so far (thread-handover, ADR 0006). Each switch is a visible line in the quest's conversation, for example "Fell back to Codex · gpt-6.1-sol · default effort · Usage limit reached · 07:00" (the failure's first line, then the time the conversation shows), and the replies keep their own author. A Companion that is already the thread's, or whose account was removed, is passed over. When the list is used up the run fails and the quest shows Failed (Summons if it asks). The quest then carries on with the Companion that finished the run.
- **A place of their own**: Rituals are not among the quests. The rail has a **Rituals** category (a moon) after Quests, listing each Ritual as a row (dimmed while off, a dot while a run is underway); the category leads to the Rituals place, a screen of violet dashed cards, each with its schedule, next run, last run, Companion and fallback count, Run now, the switch, Open, and Edit, and a **+ New Ritual** button that opens the form above them. A Ritual's quest stays off the Quests board, the realms' counts, the Archives, and the dashboard prompts; opening a Ritual (its card or its rail row) opens that quest's conversation under the path "Rituals › name", whose panel holds the Ritual's controls and no Mark as done or Archive.
- **Edit and delete**: every field can be edited, from the card or the quest's panel; a change applies to the next run, and the next time is worked out again only when the schedule or the switch changed. Delete is on the Ritual's card and in its quest's panel; deleting a Ritual asks once (with Cancel) and keeps its quest, which becomes an ordinary quest; the quest is deleted separately, as any quest is.
- **Budget**: runs draw on the Ritual quest's budget; under a reached budget the run's message waits and the thread is in Summons, as for any quest (budget-control).

## Not built (out of the first version)

- Webhook and event triggers (they need the relay Worker).
- Catching up missed runs, jitter, and time zones other than the computer's.
- Opening a new quest on each run (the Ritual's quest is the only target).
- A Ritual created by a thread tool, except by the Guildmaster, whose `create_ritual` makes one at the owner's request ([quest coordination](../mission-coordination/specifications.md#rituals)).

## Provisional choices to review

- Fallback happens on a failed turn only, not on a slow or poor answer.
- The Ritual form starts on Sonnet 5.5 (`startingModel`), not on the last quest's Companion.
- A run's state is Underway, Fulfilled (a turn completed, even after a fallback), Interrupted (a Stopped thread, or a service restart mid-run), or Failed (every Companion failed).
- A run is an owner message, so the thread's chatter and ended-quest rules treat it as the owner writing.
- A run waits behind a running turn only by being skipped (scheduled) or refused (manual).

## Acceptance

- A Ritual due runs in its quest's main thread with its trigger line; one not due, or off, does not (`rituals.test.ts`, test clock).
- A run missed beyond the grace is skipped and the Ritual moves to its next time (`rituals.test.ts`).
- Run now works with the switch off and is refused during a turn (`rituals.test.ts`).
- A failed turn falls back to the next Companion, shows the switch line, and finishes there; every failure fails the run; the next run starts on the primary Companion again (`rituals.test.ts`, fake harness).
- Deleting a Ritual removes it from the Rituals and puts its quest on the Quests list (`rituals.test.ts`).
- Each schedule preset's next time (`ritualSchedule.test.ts`); the labels and the form's time check (`ritualLabels.test.ts`).
- A Ritual's quest is listed with the Rituals (`ListRituals`) and not by `ListMissions` (`rituals.test.ts`).
- In the running app on the fake harness: the Rituals category, the form, the card, Run now, the Quests board without the Ritual, the quest under "Rituals ›", the fallback line ([proof](../../verification/2026-11-10-rituals.md)).
- In the running app on the fake harness: Delete on the card, Cancel keeps it, Confirm removes it and the quest appears on the Quests board ([proof](../../verification/2026-11-10-ritual-delete.md)).
- Not run: a Ritual left to fire on a live harness; the look at other widths.
