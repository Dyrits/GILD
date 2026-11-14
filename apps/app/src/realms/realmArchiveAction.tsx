import type { MissionId, RealmArchivePreview, WorkspaceId } from "@iskios/contracts";
import { useContext, useState } from "react";
import { Text, View } from "react-native";
import { ArchiveNavigation } from "../foundation/archiveNavigation";
import { messageOf, type ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { ArchiveButton } from "../ui/archiveButton";
import { Button } from "../ui/button";
import { RealmDialog } from "../ui/realmDialog";
import { QuestChecklist } from "./realmArchiveChoices";

/** Both realm archive entry points use the same counted confirmation and server-checked snapshot. */
export function RealmArchiveAction({
  client,
  isIcon = false,
  workspaceId,
}: {
  client: ServiceClient;
  isIcon?: boolean;
  workspaceId: WorkspaceId;
}) {
  const navigation = useContext(ArchiveNavigation);
  const [preview, setPreview] = useState<RealmArchivePreview | null>(null);
  const [isBusy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The quests the owner chose to carry to the Borderlands; everything else is archived with the realm.
  const [moved, setMoved] = useState<ReadonlySet<MissionId>>(new Set());
  const toggle = (id: MissionId) =>
    setMoved((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const show = (next: RealmArchivePreview | null) => {
    setPreview(next);
    // A choice only stands for a quest the refreshed preview still offers, and is not at work now.
    setMoved((current) => {
      const offered = new Set(next?.quests.filter((quest) => !quest.isWorking).map((quest) => quest.id));
      return new Set([...current].filter((id) => offered.has(id)));
    });
  };
  const load = async () => {
    if (isBusy) return;
    setBusy(true);
    try {
      show(await client.request({ _tag: "PreviewRealmArchive", workspaceId }));
      setError(null);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    if (preview === null || isBusy) return;
    setBusy(true);
    try {
      await client.request({
        _tag: "ArchiveRealm",
        movedQuestIds: [...moved],
        snapshot: preview.snapshot,
        workspaceId,
      });
      show(null);
      navigation.realm();
    } catch (reason) {
      setError(messageOf(reason));
      try {
        show(await client.request({ _tag: "PreviewRealmArchive", workspaceId }));
      } catch (refresh) {
        setError(messageOf(refresh));
        show(null);
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <View>
      {isIcon ? (
        <ArchiveButton
          isDisabled={isBusy}
          label="Archive realm"
          onPress={() => {
            void load();
          }}
        />
      ) : (
        <Button
          isDisabled={isBusy}
          label="Archive realm…"
          onPress={() => {
            void load();
          }}
        />
      )}
      {preview === null && error !== null && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {preview !== null && (
        <RealmDialog isBusy={isBusy} onCancel={() => show(null)} title={`Archive "${preview.realm.name}"?`}>
          <Text style={styles.body}>
            This realm leaves the active lists. Its lore, conversations, journals, and folder association are kept, and
            no workspace files are deleted. You can restore it from the Archive.
          </Text>
          {preview.quests.length > 0 && (
            <>
              <Text style={styles.body}>
                {preview.quests.length - moved.size} of its {preview.quests.length} quests will be archived with it.
                Check a quest to move it to the Borderlands instead. It keeps its conversation, journal, and its own
                lore, but can no longer see this realm's lore, and restoring the realm does not bring it back.
              </Text>
              <QuestChecklist isBusy={isBusy} moved={moved} onToggle={toggle} quests={preview.quests} />
            </>
          )}
          {preview.rituals.length > 0 && (
            <Text style={styles.body}>
              {preview.rituals.length === 1
                ? `The Ritual "${preview.rituals[0]?.title}" will be switched off.`
                : `${preview.rituals.length} Rituals (${preview.rituals.map((ritual) => `"${ritual.title}"`).join(", ")}) will be switched off.`}{" "}
              They stay in Rituals with their instructions and history, marked as belonging to an archived realm, and
              stay off after the realm is restored until you switch them on.
            </Text>
          )}
          {preview.workingCount > 0 && (
            <Text style={styles.body}>{preview.workingCount} threads are still running. They will be stopped.</Text>
          )}
          {error !== null && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}
          <View style={styles.inlineRow}>
            <Button isDisabled={isBusy} label="Cancel" onPress={() => show(null)} />
            <Button
              isDisabled={isBusy}
              isPrimary
              label={archiveLabelOf(preview.workingCount, moved.size)}
              onPress={() => {
                void confirm();
              }}
            />
          </View>
        </RealmDialog>
      )}
    </View>
  );
}

/** The confirming button says what it does beyond archiving. */
const archiveLabelOf = (workingCount: number, movedCount: number) =>
  `${workingCount > 0 ? "Stop and archive realm" : "Archive realm"}${movedCount > 0 ? `, move ${movedCount}` : ""}`;
