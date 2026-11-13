import type { Crest } from "@iskios/contracts";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { CrestBadge } from "../crest/crest";
import { CrestStudio } from "../crest/crestStudio";
import type { ServiceClient } from "../foundation/client";
import { messageOf } from "../foundation/client";
import { colors, fontSizes, fonts, outline, radii } from "../foundation/theme";
import { FolderPicker } from "./folderPicker";

/** A realm being made: named and given a crest. The path is empty until a folder is chosen, and stays so for a realm tied to none. */
export type NewRealm = { crest: Crest | null; name: string; path: string };

/** The folder's name, as the last part of its path. */
export const folderNameOf = (path: string) =>
  path
    .split(/[\\/]/)
    .filter((part) => part !== "")
    .pop() ?? path;

/**
 * The menu that makes a realm: its folder, its name, and its crest. It opens with a folder chosen, or with none and a
 * button to choose one; the realm is made once a name is given, and a folder where one is required
 * (workspace-attachment; CHG-0035). Where the folder is optional, a realm made without one is tied to no folder (CHG-0161).
 * The folder is chosen in the folder picker, which shows the folders of the computer whose Iskios the window shows.
 */
export function NewRealmModal({
  client,
  isFolderRequired = true,
  initial,
  onCancel,
  onCreate,
}: {
  client: ServiceClient;
  /** Whether the realm must be tied to a folder; where it need not, the folder can be chosen, changed, or left out. */
  isFolderRequired?: boolean;
  initial: NewRealm;
  onCancel: () => void;
  /** Imports the folder as a realm, named and given a crest; rejects with the reason when refused. */
  onCreate: (realm: NewRealm) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(initial);
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const isReady = editing.name.trim() !== "" && (!isFolderRequired || editing.path !== "");
  const choose = (path: string) => {
    setIsPicking(false);
    setError(null);
    setEditing({ ...editing, name: editing.name.trim() === "" ? folderNameOf(path) : editing.name, path });
  };
  return (
    <Modal animationType="fade" onRequestClose={onCancel} transparent visible>
      <View style={local.backdrop}>
        <Pressable accessibilityLabel="Close" onPress={onCancel} style={StyleSheet.absoluteFill} />
        <View style={local.menu}>
          <Text style={local.menuTitle}>Travel to a new realm</Text>
          <View style={local.folderRow}>
            <Text numberOfLines={2} style={[local.menuPath, editing.path === "" && local.menuPathEmpty]}>
              {editing.path !== ""
                ? editing.path
                : isFolderRequired
                  ? "No folder chosen"
                  : "No folder: optional, the realm's quests then have none"}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => setIsPicking(true)} style={local.menuButton}>
              <Text style={local.menuButtonText}>{editing.path === "" ? "Choose folder…" : "Change folder…"}</Text>
            </Pressable>
            {!isFolderRequired && editing.path !== "" && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setEditing({ ...editing, path: "" })}
                style={local.menuButton}
              >
                <Text style={local.menuButtonText}>No folder</Text>
              </Pressable>
            )}
          </View>
          <View style={local.namingRow}>
            <CrestBadge crest={editing.crest} id={editing.path === "" ? "new-realm" : editing.path} size={72} />
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
          {error !== null && <Text style={local.error}>{error}</Text>}
          <View style={local.menuFooter}>
            <Pressable accessibilityRole="button" onPress={onCancel} style={local.menuButton}>
              <Text style={local.menuButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={!isReady}
              onPress={() =>
                onCreate({ ...editing, name: editing.name.trim() }).then(onCancel, (reason) =>
                  setError(messageOf(reason)),
                )
              }
              style={[local.menuDone, !isReady && local.menuDoneOff]}
            >
              <Text style={local.menuDoneText}>Create the realm</Text>
            </Pressable>
          </View>
        </View>
      </View>
      {isPicking && <FolderPicker client={client} onCancel={() => setIsPicking(false)} onChoose={choose} />}
      {isStudioOpen && (
        <CrestStudio
          id={editing.path === "" ? "new-realm" : editing.path}
          initial={editing.crest}
          name={editing.name.trim() || (editing.path === "" ? "New realm" : folderNameOf(editing.path))}
          onCancel={() => setIsStudioOpen(false)}
          onDone={(crest) => {
            setEditing({ ...editing, crest });
            setIsStudioOpen(false);
            return Promise.resolve();
          }}
        />
      )}
    </Modal>
  );
}

const local = StyleSheet.create({
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(5,10,18,0.7)",
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  error: { color: colors.dangerText, fontFamily: fonts.sans, fontSize: fontSizes.md },
  folderRow: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between" },
  menu: {
    ...outline,
    backgroundColor: colors.page,
    borderRadius: radii.xl,
    gap: 12,
    maxWidth: 480,
    padding: 20,
    width: "100%",
  },
  menuButton: {
    ...outline,
    alignSelf: "flex-start",
    backgroundColor: colors.canvas,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  menuButtonText: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.base, fontWeight: "600" },
  menuDone: { backgroundColor: colors.accent, borderRadius: radii.sm, paddingHorizontal: 18, paddingVertical: 8 },
  menuDoneOff: { opacity: 0.4 },
  menuDoneText: { color: colors.onAccent, fontFamily: fonts.sans, fontSize: fontSizes.base, fontWeight: "700" },
  menuFields: { flex: 1, gap: 8 },
  menuFooter: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  menuLabel: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: 12 },
  menuPath: { color: colors.textMuted, flex: 1, fontFamily: fonts.mono, fontSize: fontSizes.sm },
  menuPathEmpty: { fontFamily: fonts.sans, fontStyle: "italic" },
  menuTitle: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.xl, fontWeight: "700" },
  nameInput: {
    ...outline,
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
});
