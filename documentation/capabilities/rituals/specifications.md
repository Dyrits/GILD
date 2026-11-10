# Rituals

Status: drafted on 2026-11-10 from the owner's answers (instruction, schedule and models; fallback models; a card of its own on the board; runs in the main quest; schedule presets; one quest per Ritual; missed runs skipped; manual run). Not built. Everything the owner did not decide is **provisional** until the owner reviews it.

## Problem and outcome

The owner repeats the same request: a morning digest, a weekly dependency check. A Ritual is that request with a schedule, a Companion (model), and fallback Companions. It runs by itself in its own quest and the owner can also run it by hand at any time. Rituals are the "routine" of the glossary, under its guild name.

## Agreed behavior

- **A Ritual** has a title, an instruction, a schedule, a harness with account, Companion (model) and effort, an ordered list of fallback Companions, an optional realm (workspace), and an on or off switch.
- **One quest per Ritual**: creating a Ritual creates its quest. Each run is a turn in that quest's main thread, so the quest holds the whole history of the Ritual. The owner opens side-quests beneath it as in any quest.
- **Schedule presets only** (no cron): every day at a time; weekdays at a time; every week on a day at a time; every month on a day at a time; every N hours. Times are the computer's local time.
- **Where the scheduler runs**: the local service. A run missed because the app was closed or the computer asleep is skipped, not caught up; the quest says nothing for it.
- **Run now**: a button on the Ritual's quest and card starts a run at any moment, whatever the schedule and the switch. A scheduled or manual run is refused while the previous run is still in a turn (the manual one says why); a scheduled one is skipped.
- **What a run does**: it sends the instruction to the main thread as a message from the Ritual, marked with its trigger ("Ritual · scheduled 07:00" or "Ritual · run by you"). The thread runs it on the Ritual's Companion with its approval level; actions the instruction names are approved, others ask and the thread goes to Summons (action-approval).
- **Fallback Companions**: when a run's turn fails (usage limit, overload, model unavailable, harness signed out), the run is handed over to the next Companion of the list, which may be on another harness, and the instruction is run again with the conversation so far (thread-handover, ADR 0006). Each switch is a visible line in the quest's conversation and on the run, for example "Fell back to Codex · gpt-6.1-sol: Claude Code hit its usage limit · 07:00", and the replies keep their own author. When the list is used up the run fails and the quest shows Failed (Summons if it asks). The quest then carries on with the Companion that finished the run.
- **The board**: a Ritual shows as a card in its quest's column with a style of its own (a ritual mark, its schedule, "Next run" and the last run's result) so the owner tells it from a quest at a glance. An off Ritual is dimmed.
- **Edit and delete**: every field can be edited; a change applies to the next run. Deleting a Ritual asks whether to keep its quest, which then becomes an ordinary quest.
- **Budget**: runs draw on the Ritual quest's budget; a run is refused, with the reason, when it is exhausted.

## Not built (out of the first version)

- Webhook and event triggers (they need the relay Worker).
- Catching up missed runs, jitter, and time zones other than the computer's.
- Opening a new quest on each run (the Ritual's quest is the only target).
- A Ritual created by a thread tool.

## Provisional choices to review

- Fallback happens on a failed turn only, not on a slow or poor answer.
- The Ritual's starting model is the Settings default.
- A run waits behind a running turn only by being skipped (scheduled) or refused (manual).

## Acceptance (to build)

- A Ritual due now runs in its quest's main thread with its trigger line; one not due does not (service test on a fake clock).
- A missed run is skipped after a restart (service test).
- Run now works with the switch off and is refused during a turn.
- A failed turn falls back to the next Companion, shows the switch line, and keeps earlier replies' authors; the last failure fails the run (service test on the fake harness).
- The board shows a Ritual card in its own style; the form creates, edits, and deletes (app drive on the fake harness).
