import type { ThreadId, WorkspaceChoice } from "@iskios/contracts";
import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CrestBadge } from "../crest/crest";
import { messageOf, type ServiceClient } from "../foundation/client";
import { samePath } from "../foundation/paths";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { FolderPicker } from "./folderPicker";
import { folderNameOf, type NewRealm, NewRealmModal } from "./newRealmModal";
import { tiedRealmsOf } from "./tiedRealms";

/**
 * Chooses a mission's realm before it starts: the realms that exist, each under its own crest, then no realm for the
 * quest's scratch folder, then any other folder from Finder or Explorer. A folder that is not a realm yet opens a menu to name it
 * and give it a crest, and becomes a realm when imported, before any quest starts in it (workspace-attachment; CHG-0035).
 */
export function RealmChooser({
  client,
  onChange,
  onCreate,
  realms,
  value,
}: {
  client: ServiceClient;
  onChange: (path: string | null) => void;
  /** Imports the folder as a realm, named and given a crest; rejects with the reason when refused. */
  onCreate: (realm: NewRealm) => Promise<unknown>;
  /** The realms that exist, by name. */
  realms: ReadonlyArray<WorkspaceChoice>;
  /** The chosen folder, or null for the quest's scratch folder. */
  value: string | null;
}) {
  const [isPicking, setIsPicking] = useState(false);
  // The folder being named in the menu that opens when one is chosen; null while the menu is closed.
  const [editing, setEditing] = useState<NewRealm | null>(null);
  const choose = (path: string) => {
    setIsPicking(false);
    const known = realms.find((realm) => samePath(realm.path, path));
    if (known !== undefined) onChange(known.path);
    else setEditing({ crest: null, name: folderNameOf(path), path });
  };
  const sorted = tiedRealmsOf(realms);
  return (
    <View style={styles.section}>
      <View accessibilityLabel="Realm" style={local.chips}>
        <Text style={local.label}>Realm</Text>
        {sorted.map((realm) => (
          <Chip
            isSelected={samePath(realm.path, value)}
            key={realm.id}
            // Pressing the chosen realm again unchooses it, and the quest starts with no realm.
            onPress={() => onChange(samePath(realm.path, value) ? null : realm.path)}
          >
            <CrestBadge crest={realm.crest} id={realm.id} size={24} />
            <Text numberOfLines={1} style={[local.chipText, samePath(realm.path, value) && local.chipTextSelected]}>
              {realm.name}
            </Text>
          </Chip>
        ))}
        <Chip isSelected={false} onPress={() => setIsPicking(true)}>
          <Text style={local.chipPlus}>+</Text>
          <Text style={local.chipText}>Choose folder…</Text>
        </Chip>
      </View>
      {isPicking && <FolderPicker client={client} onCancel={() => setIsPicking(false)} onChoose={choose} />}
      {editing !== null && (
        <NewRealmModal client={client} initial={editing} onCancel={() => setEditing(null)} onCreate={onCreate} />
      )}
    </View>
  );
}

/** One choice in the realm row: a pill that turns to parchment when chosen. */
function Chip({ children, isSelected, onPress }: { children: ReactNode; isSelected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={(state) => [
        local.chip,
        (state.pressed || (state as { hovered?: boolean }).hovered === true) && local.chipHovered,
        isSelected && local.chipSelected,
      ]}
    >
      {children}
    </Pressable>
  );
}

/**
 * Says a thread waits because its workspace folder is gone, with Retry
 * (workspace-attachment, Missing folder; Relocate is staged).
 */
export function MissingFolderNotice({
  client,
  path,
  threadId,
}: {
  client: ServiceClient;
  path: string;
  threadId: ThreadId;
}) {
  const [retryError, setRetryError] = useState<string | null>(null);
  const retry = () =>
    client.request({ _tag: "RetryThread", threadId }).then(
      () => setRetryError(null),
      (reason) => setRetryError(messageOf(reason)),
    );
  return (
    <View style={styles.failure}>
      <Text style={styles.error}>The realm folder {path} no longer exists.</Text>
      <Text style={styles.muted}>Your messages wait. Put the folder back, then retry.</Text>
      <Pressable onPress={retry} style={styles.button}>
        <Text style={styles.buttonText}>Retry</Text>
      </Pressable>
      {retryError !== null && <Text style={styles.error}>{retryError}</Text>}
    </View>
  );
}

const local = StyleSheet.create({
  chip: {
    alignItems: "center",
    backgroundColor: colors.control,
    borderColor: colors.edge,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipHovered: { backgroundColor: colors.controlHover },
  chipNew: { color: colors.highlight, fontFamily: fonts.sans, fontSize: fontSizes.sm, fontStyle: "italic" },
  chipPlus: { color: colors.highlight, fontFamily: fonts.sans, fontSize: 18, lineHeight: 20 },
  chipSelected: { backgroundColor: colors.controlActive, borderColor: colors.highlight },
  chips: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chipText: { color: colors.onGround, fontFamily: fonts.sans, fontSize: fontSizes.base },
  chipTextSelected: { color: colors.text, fontWeight: "700" },
  label: { color: colors.onGround, fontFamily: fonts.sans, fontSize: fontSizes.md, marginRight: 4, opacity: 0.8 },
});
