import type { Crest, MissionSummary, ThreadId, WorkspaceChoice } from "@gild/contracts";
import { type ReactNode, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ServiceClient } from "./client";
import { CrestBadge } from "./crest";
import { CrestStudio } from "./crestStudio";
import { samePath } from "./paths";
import { AddRealmCard, NoRealmButton, RealmCard } from "./realmCard";
import { styles } from "./styles";
import { colors, fontSizes, fonts, ink, radii } from "./theme";

/** Opens the system's folder dialog through the desktop shell; null when cancelled. */
const chooseFolder = () =>
  window.gild === undefined
    ? Promise.reject(new Error("Choosing a folder needs the desktop app."))
    : window.gild.chooseFolder();

/** A folder being imported as a realm: named and given a crest. */
export type NewRealm = { crest: Crest | null; name: string; path: string };

/** The folder's name, as the last part of its path. */
export const folderNameOf = (path: string) =>
  path
    .split(/[\\/]/)
    .filter((part) => part !== "")
    .pop() ?? path;

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
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const choose = () =>
    chooseFolder().then(
      (path) => {
        setChooseError(null);
        if (path === null) return;
        const known = realms.find((realm) => samePath(realm.path, path));
        if (known !== undefined) onChange(known.path);
        else setEditing({ crest: null, name: folderNameOf(path), path });
      },
      (reason: Error) => setChooseError(reason.message),
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
      {editing !== null && (
        <Modal animationType="fade" onRequestClose={() => setEditing(null)} transparent visible>
          <View style={local.backdrop}>
            <Pressable accessibilityLabel="Close" onPress={() => setEditing(null)} style={StyleSheet.absoluteFill} />
            <View style={local.menu}>
              <Text style={local.menuTitle}>A new realm</Text>
              <Text numberOfLines={2} style={local.menuPath}>
                {editing.path}
              </Text>
              <View style={local.namingRow}>
                <CrestBadge crest={editing.crest} id={editing.path} size={72} />
                <View style={local.menuFields}>
                  <Text style={local.menuLabel}>Name</Text>
                  <TextInput
                    accessibilityLabel="Realm name"
                    autoFocus
                    maxLength={80}
                    onChangeText={(name) => setEditing({ ...editing, name })}
                    placeholder="Name the realm"
                    placeholderTextColor={colors.placeholder}
                    style={local.nameInput}
                    value={editing.name}
                  />
                  <Pressable accessibilityRole="button" onPress={() => setIsStudioOpen(true)} style={local.menuButton}>
                    <Text style={local.menuButtonText}>Customize the crest</Text>
                  </Pressable>
                </View>
              </View>
              <View style={local.menuFooter}>
                <Pressable accessibilityRole="button" onPress={() => setEditing(null)} style={local.menuButton}>
                  <Text style={local.menuButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={editing.name.trim() === ""}
                  onPress={() =>
                    onCreate({ ...editing, name: editing.name.trim() }).then(
                      () => setEditing(null),
                      (reason: Error) => setChooseError(reason.message),
                    )
                  }
                  style={[local.menuDone, editing.name.trim() === "" && local.menuDoneOff]}
                >
                  <Text style={local.menuDoneText}>Import the realm</Text>
                </Pressable>
              </View>
            </View>
          </View>
          {isStudioOpen && (
            <CrestStudio
              id={editing.path}
              initial={editing.crest}
              name={editing.name.trim() || folderNameOf(editing.path)}
              onCancel={() => setIsStudioOpen(false)}
              onDone={(crest) => {
                setEditing({ ...editing, crest });
                setIsStudioOpen(false);
                return Promise.resolve();
              }}
            />
          )}
        </Modal>
      )}
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
      (reason: Error) => setRetryError(reason.message),
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
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(20,10,6,0.6)",
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  chip: {
    alignItems: "center",
    backgroundColor: "rgba(248,237,210,0.08)",
    borderColor: colors.gold,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  // The large tiles have no outline: a tile is a dim card, and the chosen one is parchment.
  chipBig: {
    borderRadius: radii.xl,
    borderWidth: 0,
    flexDirection: "column",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 20,
    width: 176,
  },
  chipHovered: { backgroundColor: "rgba(248,237,210,0.18)" },
  chipNew: { color: colors.goldHi, fontFamily: fonts.sans, fontSize: fontSizes.sm, fontStyle: "italic" },
  chipPlus: { color: colors.goldHi, fontFamily: fonts.sans, fontSize: 18, lineHeight: 20 },
  chipPlusBig: { fontSize: 44, lineHeight: 56 },
  chipSelected: { backgroundColor: "#efdcae", borderColor: colors.goldHi },
  chips: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chipsBig: { gap: 16, justifyContent: "center" },
  chipText: { color: colors.onWood, fontFamily: fonts.sans, fontSize: fontSizes.base },
  chipTextBig: { fontSize: fontSizes.lg, textAlign: "center" },
  chipTextSelected: { color: colors.text, fontWeight: "700" },
  label: { color: colors.onWood, fontFamily: fonts.sans, fontSize: fontSizes.md, marginRight: 4, opacity: 0.8 },
  menu: {
    ...ink,
    backgroundColor: colors.paper,
    borderRadius: radii.xl,
    gap: 12,
    maxWidth: 480,
    padding: 20,
    width: "100%",
  },
  menuButton: {
    ...ink,
    alignSelf: "flex-start",
    backgroundColor: colors.canvas,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  menuButtonText: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.base, fontWeight: "600" },
  menuDone: { backgroundColor: colors.gold, borderRadius: radii.sm, paddingHorizontal: 18, paddingVertical: 8 },
  menuDoneOff: { opacity: 0.4 },
  menuDoneText: {
    color: colors.text,
    fontFamily: fonts.hand,
    fontSize: fontSizes.base,
    fontWeight: "700",
    letterSpacing: 1,
  },
  menuFields: { flex: 1, gap: 8 },
  menuFooter: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  menuLabel: {
    color: colors.textMuted,
    fontFamily: fonts.hand,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  menuPath: { color: colors.textMuted, fontFamily: fonts.mono, fontSize: fontSizes.sm },
  menuTitle: {
    color: colors.text,
    fontFamily: fonts.hand,
    fontSize: fontSizes.xl,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  nameInput: {
    ...ink,
    backgroundColor: colors.canvas,
    borderRadius: radii.sm,
    color: colors.text,
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: fontSizes.base,
    minWidth: 160,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  namingRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 10 },
  // The large cards: two to a row while they fit, one when they do not, the add card and the no-realm sign beneath.
  stack: { gap: 16, maxWidth: 820, width: "100%" },
  stackCards: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  stackFoot: { alignItems: "center", flexDirection: "row", gap: 16 },
});
