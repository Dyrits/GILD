# Companion presets

Status: **specified on 2026-11-12 from the owner's answers (CHG-0242); not built, and not to be built yet.** The owner kept the idea for later ("a bit like the presets of Light, Balanced, and Heavy in the settings", CHG-0240). The points below are agreed; the build waits for the owner's go-ahead. Everything the owner did not decide is **provisional** until they review it.

## Problem and outcome

Choosing a Companion means picking a harness, an account, a model, an effort, and often a list of backup Companions, again for each quest, side-quest, and Ritual. A **Companion preset** is a name for such a choice, so the owner picks "Heavy" or "Cheap digest" instead of redoing the whole choice. The Workshop's tiers (Light, Balanced, Heavy) are already presets in all but name; this makes them one kind of thing with the owner's own.

## Agreed behavior

- **What a preset is** (CHG-0242): a name, one Companion (harness, provider account, model, effort), and optionally an ordered list of backup Companions (at most five, as everywhere, [thread-panel](../thread-panel/specifications.md#backup-companions)). Preset names are unique.
- **Tiers are presets**: the Workshop's Light, Balanced, and Heavy tiers become presets of one list with those names. Iskios still picks a Companion by the request's complexity among Light, Balanced, and Heavy only (an unset one is not offered), and never picks a preset the owner made otherwise ([mission-coordination](../mission-coordination/specifications.md)). The owner may add presets of their own, rename or delete those, and set, change, or clear the three tiers as today.
- **Where a preset is chosen**: with one chooser, everywhere a Companion is chosen: the Companions tab for a quest, a side-quest, and Iskios (right-hand column); the forms that start a quest or a side-quest; a Ritual's Companion and each of its fallbacks; and the card Iskios proposes a quest with, in place of "Customize the Companion".
- **Choosing copies**: choosing a preset copies its values into what is being set. Editing or deleting the preset later leaves every quest, side-quest, and Ritual that already used it as it is, as the Workshop's default backups already do for a quest that started from them.
- **Choosing on a thread already running** is a handover with the same rules as choosing its Companion by hand: between turns, refused while the thread runs or waits for an answer, and the line in the conversation when a turn starts on the new Companion ([thread-handover](../thread-handover/specifications.md)). It replaces the thread's backup list when the preset has one, and leaves it as it is when the preset has none.
- **Where presets are made**: a **Presets** card in the Workshop (add, rename, change a preset's Companion and backups, delete), and **Save as a preset** in the Companions tab, which names the Companion in use, with its backups when the thread has any, as a new preset. Every change is saved at once.
- **A preset that cannot be used** (it names a removed or signed-out provider account, or a model its harness no longer lists) is shown as unavailable with the reason and cannot be chosen, as a backup that cannot be taken is passed over. It stays in the list so the owner can repair or delete it.
- **Hosts**: presets live on the host, with its provider accounts, and are shared by the devices paired with it ([device-pairing](../device-pairing/specifications.md)); a preset names accounts by their Iskios identity, never by a credential.

## Edge cases

- Saving as a preset under a name in use asks for another name; it never replaces a preset silently.
- Deleting a preset that is a tier clears that tier; Iskios then falls back to the default Companion as it does for a tier not set.
- A preset whose Companion equals a thread's current one changes nothing when chosen (no handover line).
- A preset's backup list is checked as a thread's is (at most five, none equal to its own Companion is not required).

## Acceptance

Checks an agent can perform:

- The Workshop's three tiers appear as presets named Light, Balanced, and Heavy, and Iskios's proposals still use them as before.
- A preset made in the Workshop is offered in the Companions tab, the new-quest and side-quest forms, a Ritual's pickers, and Iskios's card; choosing it fills harness, account, model, effort, and backups.
- Editing a preset after a quest used it leaves the quest's Companion and backups unchanged.
- Choosing a preset on an idle quest hands it over and leaves the line in the conversation; on a running one it is refused.
- **Save as a preset** makes a preset equal to the Companion in use and its backups; a name in use is refused.
- A preset naming a signed-out account is listed as unavailable with its reason and cannot be chosen.
- On a paired device, the host's presets are the ones shown.

Human acceptance: the owner reviews the look of the Presets card and of the chooser in the Companions tab, and that choosing "Heavy" in a quest feels as quick as the by-hand choice it replaces.

## Requirements covered

- Provider credentials are never stored, collected, or relayed ([requirements](../../requirements.md#privacy-and-data)): a preset names an account by its identity only.
- Bring your own provider, and the cost of running Iskios, are unchanged: a preset only names choices the owner could make by hand.
- Paired-device traffic stays end-to-end encrypted ([device-pairing](../device-pairing/specifications.md)): presets reach a device over the same channel as other host data.

## Dependencies

[thread-handover](../thread-handover/specifications.md), [thread-panel](../thread-panel/specifications.md) (the Companions tab and backups), [mission-coordination](../mission-coordination/specifications.md) (tiers), [rituals](../rituals/specifications.md), [provider-accounts](../provider-accounts/specifications.md), [device-pairing](../device-pairing/specifications.md).

## Not built, and excluded

- Everything above: nothing is built.
- Sharing presets between hosts or exporting them; presets that change by themselves (a preset follows no model release); Iskios choosing presets of the owner's own; a preset that also sets the budget or the approval level.
