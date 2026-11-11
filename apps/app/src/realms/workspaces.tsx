import type { MissionSummary, ThreadId, WorkspaceChoice } from "@iskios/contracts";
import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CrestBadge } from "../crest/crest";
import { messageOf, type ServiceClient } from "../foundation/client";
import { samePath } from "../foundation/paths";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { chooseFolder, folderNameOf, type NewRealm, NewRealmModal } from "./newRealmModal";
import { AddRealmCard, NoRealmButton, RealmCard } from "./realmCard";

/**
 * Chooses a mission's realm before it starts: the realms that exist, each under its own crest, then no realm for the
 * quest's scratch folder, then any other folder from Finder or Explorer. A folder that is not a realm yet opens a menu to name it
 * and give it a crest, and becomes a realm when imported, before any quest starts in it (workspace-attachment; CHG-0035).
 */
export function RealmChooser({
  isBig = false,
  missions = [],
  onChange,
  onCreate,
  realms,
  value,
}: {
  /** Large tiles in the middle of the screen, not a row of small chips under the message. */
  isBig?: boolean;
  /** The quests on the board, from which the large cards count each realm's own. */
  missions?: ReadonlyArray<MissionSummary>;
  onChange: (path: string | null) => void;
  /** Imports the folder as a realm, named and given a crest; rejects with the reason when refused. */
  onCreate: (realm: NewRealm) => Promise<unknown>;
  /** The realms that exist, by name. */
  realms: ReadonlyArray<WorkspaceChoice>;
  /** The chosen folder, or null for the quest's scratch folder. */
  value: string | null;
}) {
  const [chooseError, setChooseError] = useState<string | null>(null);
  // The folder being named in the menu that opens when one is chosen; null while the menu is closed.
  const [editing, setEditing] = useState<NewRealm | null>(null);
  const choose = () =>
    chooseFolder().then(
      (path) => {
        setChooseError(null);
        if (path === null) return;
        const known = realms.find((realm) => samePath(realm.path, path));
        if (known !== undefined) onChange(known.path);
        else setEditing({ crest: null, name: folderNameOf(path), path });
      },
      (reason) => setChooseError(messageOf(reason)),
    );
  const sorted = [...realms].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <View style={styles.section}>
      <View accessibilityLabel="Realm" style={[local.chips, isBig && local.chipsBig]}>
        {!isBig && <Text style={local.label}>Realm</Text>}
        {isBig ? (
          <View style={local.stack}>
            <View style={local.stackCards}>
              {sorted.map((realm) => (
                <RealmCard
                  isFluid
                  isSelected={samePath(realm.path, value)}
                  key={realm.id}
                  missions={missions}
                  // Pressing the chosen realm again unchooses it, and the quest starts with no realm.
                  onPress={() => onChange(samePath(realm.path, value) ? null : realm.path)}
                  realm={realm}
                />
              ))}
            </View>
            <View style={local.stackFoot}>
              <NoRealmButton isSelected={value === null} onPress={() => onChange(null)} />
              <AddRealmCard isFluid label="Choose a folder…" onPress={choose} />
            </View>
          </View>
        ) : (
          <>
            {sorted.map((realm) => (
              <Chip
                isBig={isBig}
                isSelected={samePath(realm.path, value)}
                key={realm.id}
                // Pressing the chosen realm again unchooses it, and the quest starts with no realm.
                onPress={() => onChange(samePath(realm.path, value) ? null : realm.path)}
              >
                <CrestBadge crest={realm.crest} id={realm.id} size={isBig ? 92 : 24} />
                <Text
                  numberOfLines={isBig ? 2 : 1}
                  style={[
                    local.chipText,
                    isBig && local.chipTextBig,
                    samePath(realm.path, value) && local.chipTextSelected,
                  ]}
                >
                  {realm.name}
                </Text>
              </Chip>
            ))}
            <Chip isBig={isBig} isSelected={false} onPress={choose}>
              <Text style={[local.chipPlus, isBig && local.chipPlusBig]}>+</Text>
              <Text style={[local.chipText, isBig && local.chipTextBig]}>Choose folder…</Text>
            </Chip>
          </>
        )}
      </View>
      {editing !== null && <NewRealmModal initial={editing} onCancel={() => setEditing(null)} onCreate={onCreate} />}
      {chooseError !== null && <Text style={styles.error}>{chooseError}</Text>}
    </View>
  );
}

/** One choice in the realm row: a pill that turns to parchment when chosen. */
function Chip({
  children,
  isBig = false,
  isSelected,
  onPress,
}: {
  children: ReactNode;
  isBig?: boolean;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={(state) => [
        local.chip,
        isBig && local.chipBig,
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
  // The large tiles have no outline: a tile is a quiet card, and the chosen one a lighter step.
  chipBig: {
    borderRadius: radii.xl,
    borderWidth: 0,
    flexDirection: "column",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 20,
    width: 176,
  },
  chipHovered: { backgroundColor: colors.controlHover },
  chipNew: { color: colors.highlight, fontFamily: fonts.sans, fontSize: fontSizes.sm, fontStyle: "italic" },
  chipPlus: { color: colors.highlight, fontFamily: fonts.sans, fontSize: 18, lineHeight: 20 },
  chipPlusBig: { fontSize: 44, lineHeight: 56 },
  chipSelected: { backgroundColor: colors.controlActive, borderColor: colors.highlight },
  chips: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chipsBig: { gap: 16, justifyContent: "center" },
  chipText: { color: colors.onGround, fontFamily: fonts.sans, fontSize: fontSizes.base },
  chipTextBig: { fontSize: fontSizes.lg, textAlign: "center" },
  chipTextSelected: { color: colors.text, fontWeight: "700" },
  label: { color: colors.onGround, fontFamily: fonts.sans, fontSize: fontSizes.md, marginRight: 4, opacity: 0.8 },
  // The large cards: two to a row while they fit, one when they do not, the add card and the no-realm sign beneath.
  stack: { gap: 16, maxWidth: 820, width: "100%" },
  stackCards: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  stackFoot: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 16 },
});
