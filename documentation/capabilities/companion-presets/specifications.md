# Companion presets

Status: **the three tier stacks are implemented; appearance and the provisional choices below await the owner** (2026-11-13, CHG-0260). The primary-only implementation in CHG-0258 was rejected by the owner: a preset is a Companion and its backups, and choosing it puts the whole stack in place. Custom presets and Save as a preset remain deferred. Everything the owner did not decide is **provisional** until they review it; the points the implementation decided alone are listed under Provisional choices. See [verification](../../verification/2026-11-13-companion-stacks.md) for checks and limits.

## Problem and outcome

Choosing a Companion means picking a harness, an account, a model, an effort, and often a list of backup Companions, again for each quest, side-quest, and Ritual. A **Companion preset** is a name for such a choice, so the owner picks "Heavy" or "Cheap digest" instead of redoing the whole choice. The Workshop's tiers (Light, Balanced, Heavy) are already presets in all but name; this makes them one kind of thing with the owner's own.

## Agreed behavior

- **What a preset is** (CHG-0242): a name, one Companion (harness, provider account, model, effort), and optionally an ordered list of backup Companions (at most five, as everywhere, [thread-panel](../thread-panel/specifications.md#backup-companions)). Preset names are unique.
- **Tiers are presets**: the Workshop's Light, Balanced, and Heavy tiers become presets of one list with those names. Iskios still picks a Companion by the request's complexity among Light, Balanced, and Heavy only (an unset one is not offered), and never picks a preset the owner made otherwise ([mission-coordination](../mission-coordination/specifications.md)). The owner may add presets of their own, rename or delete those, and set, change, or clear the three tiers as today.
- **Where a preset is chosen** (CHG-0242; CHG-0258 answered for the first build: the three tiers, in the Companions tab for a quest, a side-quest and its draft, and Iskios, and in each backup fold): with one chooser, everywhere a Companion is chosen: the Companions tab for a quest, a side-quest, and Iskios (right-hand column); the forms that start a quest or a side-quest; a Ritual's Companion and each of its fallbacks; and the card Iskios proposes a quest with, in place of "Customize the Companion". What the build covers so far is under Not built, and excluded.
- **Choosing copies the whole stack** (owner correction, 2026-11-13): a preset is its primary Companion and its ordered backup list together. Choosing it replaces both, in one operation (whether an empty preset list clears the thread's backups is provisional, below). Editing or deleting the preset later leaves every quest, side-quest, and Ritual that already used it as it is.
- **Choosing on an existing thread** is a handover with the same rules as choosing its Companion by hand: between turns, refused while the thread runs or waits for an answer, and the line in the conversation when a turn starts on the new Companion ([thread-handover](../thread-handover/specifications.md)). A refusal leaves the primary and backups unchanged. Whether a preset with no backups clears the thread's list or leaves it as it is is provisional (see below).
- **Where presets are made**: a **Presets** card in the Workshop (add, rename, change a preset's Companion and backups, delete), and **Save as a preset** in the Companions tab, which names the Companion in use, with its backups when the thread has any, as a new preset. Every change is saved at once.
- **A preset that cannot be used** (it names a removed or signed-out provider account, or a model its harness no longer lists) is shown as unavailable with the reason and cannot be chosen, as a backup that cannot be taken is passed over. It stays in the list so the owner can repair or delete it.
- **Hosts**: presets live on the host, with its provider accounts, and are shared by the devices paired with it ([device-pairing](../device-pairing/specifications.md)); a preset names accounts by their Iskios identity, never by a credential.

## Edge cases

- Saving as a preset under a name in use asks for another name; it never replaces a preset silently.
- Deleting a preset that is a tier clears that tier; Iskios then falls back to the default Companion as it does for a tier not set.
- A preset whose primary Companion equals the thread's current one still replaces its backups, without a handover line. A preset is marked selected only when its primary and ordered backups match.
- A preset's backup list is checked as a thread's is (at most five, none equal to its own Companion is not required).

## Acceptance

Checks an agent can perform:

- The Workshop's three tiers appear as presets named Light, Balanced, and Heavy, and Iskios's proposals still use them as before.
- A preset made in the Workshop is offered in the Companions tab, the new-quest and side-quest forms, a Ritual's pickers, and Iskios's card; choosing it fills harness, account, model, effort, and backups.
- Editing a preset after a quest used it leaves the quest's Companion and backups unchanged.
- Choosing a preset on an idle quest hands it over and leaves the line in the conversation; on a running one it is refused.
- Provisional: choosing a preset with no backups clears the old list. The same primary with different backups still updates the list and is not marked as the same preset beforehand.
- Provisional: a new side-quest copies the chosen preset's backups instead of inheriting its parent's; the parent stays unchanged.
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

## Provisional choices

The owner's correction (2026-11-13, "selecting a preset should do a full stack of companions") settles that choosing a preset puts a Companion and its backups in place together. The implementation decided the following alone, so each awaits the owner's confirmation; none is attributed to the owner:

- **A preset with no backups clears the thread's list.** CHG-0242 said it leaves the list as it is.
- **A backup fold offers no presets.** Choosing a Companion for one backup is by hand, because a preset there would have to discard the rest of its stack; CHG-0258's answer put presets in each backup fold.
- **Iskios's proposal card carries the tier's whole stack**, and a quest opened from it starts with the tier's backups instead of the Workshop's default list. CHG-0258 said the card's chooser stayed unbuilt. This contradicts [thread-panel](../thread-panel/specifications.md#backup-companions), which says a quest's top thread starts with a copy of the Workshop's list.
- **A Ritual Iskios creates on a tier takes the tier's backups as fallbacks**, shown in the approval summary; naming an effort, harness, or model for it gives no fallbacks. [Rituals](../rituals/specifications.md) carries a pointer to this.
- **A side-quest opened with a chosen preset starts with its stack**, not a copy of its parent's list, as [thread-panel](../thread-panel/specifications.md#backup-companions) says it does.
- **The Workshop saves one tier at a time** (a change names only the tiers it changes); two quick edits of one tier's Companion and its backups can still overwrite each other until the settings are read again.
- **"Customize the Companion" on Iskios's card keeps the chosen chip's backups**, and the card sends the list it shows: the service leaves the Workshop's default list unchecked when the card sends exactly that list.
- **A settings change naming a preset without `backups` is refused**, so an older paired device cannot wipe a preset's backups; stored presets saved before presets had backups still read with none.
- **A preset whose backup names a removed account** cannot be chosen, and a quest opened from a card without a stack keeps the Workshop's default list unchecked; removing an account does not scrub it from the Workshop's lists.

## Not built, and excluded

- Built (CHG-0260): Light, Balanced, Heavy each hold a primary and up to five ordered backups; the Workshop edits and counts those backups. Choosing a tier on an existing thread or a draft side-quest copies the complete stack. The Companions tab shows the presets in a card of their own above the thread's Companion, whose fold keeps the by-hand model choice (the owner's request, 2026-11-13, after seeing the presets inside the Companion fold). Iskios's quest card carries the tier's full stack, even when its primary equals Default; a Ritual created by Iskios on a tier takes its backups as fallbacks.
- Not built: the owner's own named presets, Save as a preset, unavailable-preset explanations, and the preset chooser in the owner's Ritual form. Real provider execution, paired-device use, dark mode, and phone layout were not driven in this batch.
- Sharing presets between hosts or exporting them; presets that change by themselves (a preset follows no model release); Iskios choosing presets of the owner's own; a preset that also sets the budget or the approval level.
