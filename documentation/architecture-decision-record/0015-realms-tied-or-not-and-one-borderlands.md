---
status: accepted
---

# A realm is tied to a folder or to none, and the Borderlands are every quest of no realm

A quest belongs to a Realm or to the Borderlands (CHG-0161). A Realm groups quests with lore shared across them and is tied to a workspace (a repository or folder) or to none; the Borderlands hold autonomous quests with no workspace and no shared lore. This replaces the three placements before it: workspace-backed Realms, workspace-free Free Realms (table `free_realms`, CHG-0149), and Realmless quests.

In storage a realm stays a `workspaces` row, whose `path` becomes nullable (migration `0039_realms_and_borderlands`): a null path is a realm tied to no folder. A quest's realm is its top thread's `workspace_id`, inherited by its side-quests, and realm lore stays keyed by that id, so a realm without a folder shares lore exactly as one with a folder does. A thread whose realm has no folder has no workspace to work in: `readThreadWorkspace` reads only rows with a path, so it uses its quest's scratch folder and its terminal starts in the owner's home folder. A quest with no realm is in the Borderlands. Free Realms and the `missions.free_realm_id` column are dropped without migrating them (the owner's decision, pre-release): their quests fall into the Borderlands.

Considered: a separate `realms` table with an optional workspace (cleaner names, but realm lore, crests, renaming, and the realm panel are all keyed by the workspace id, so every one of them and the owner's data would move); keeping `free_realms` and keying realm lore by a second id (two kinds of realm for one concept). Hard to reverse because existing threads, lore, and permissions now point at realms that may have no folder, and the dropped Free Realms cannot be restored.

Known limit: the Guildmaster and the realm chooser place a quest by its realm's folder, so they do not offer realms tied to no folder yet; a quest is placed in one from the sidebar's new-quest button.
