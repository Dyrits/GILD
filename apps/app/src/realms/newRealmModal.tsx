import type { Crest } from "@iskios/contracts";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { CrestBadge } from "../crest/crest";
import { CrestStudio } from "../crest/crestStudio";
import { messageOf } from "../foundation/client";
import { colors, fontSizes, fonts, outline, radii } from "../foundation/theme";

/** Opens the system's folder dialog through the desktop shell; null when cancelled. */
export const chooseFolder = () =>
  window.iskios === undefined
    ? Promise.reject(new Error("Choosing a folder needs the desktop app."))
    : window.iskios.chooseFolder();

/** A folder being imported as a realm: named and given a crest. The path is empty until a folder is chosen. */
export type NewRealm = { crest: Crest | null; name: string; path: string };

/** The folder's name, as the last part of its path. */
export const folderNameOf = (path: string) =>
  path
    .split(/[\\/]/)
    .filter((part) => part !== "")
    .pop() ?? path;

/**
 * The menu that makes a realm: its folder, its name, and its crest. It opens with a folder chosen, or with none and a
 * button to choose one; the realm is made only once both a folder and a name are given (workspace-attachment; CHG-0035).
 */
export function NewRealmModal({
  hasFolder = true,
  initial,
  onCancel,
  onCreate,
}: {
  /** Whether the realm is tied to a folder; a Borderland is not, and the menu leaves the folder out. */
  hasFolder?: boolean;
  initial: NewRealm;
  onCancel: () => void;
  /** Imports the folder as a realm, named and given a crest; rejects with the reason when refused. */
  onCreate: (realm: NewRealm) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(initial);
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isReady = editing.name.trim() !== "" && (!hasFolder || editing.path !== "");
  const choose = () =>
    chooseFolder().then(
      (path) => {
        setError(null);
        if (path !== null)
          setEditing({ ...editing, name: editing.name.trim() === "" ? folderNameOf(path) : editing.name, path });
      },
      (reason) => setError(messageOf(reason)),
    );
  return (
    <Modal animationType="fade" onRequestClose={onCancel} transparent visible>
      <View style={local.backdrop}>
        <Pressable accessibilityLabel="Close" onPress={onCancel} style={StyleSheet.absoluteFill} />
        <View style={local.menu}>
          <Text style={local.menuTitle}>{hasFolder ? "Travel to a new realm" : "Travel to a new borderland"}</Text>
          {hasFolder && (
            <View style={local.folderRow}>
              <Text numberOfLines={2} style={[local.menuPath, editing.path === "" && local.menuPathEmpty]}>
                {editing.path === "" ? "No folder chosen" : editing.path}
              </Text>
              <Pressable accessibilityRole="button" onPress={choose} style={local.menuButton}>
                <Text style={local.menuButtonText}>{editing.path === "" ? "Choose folder…" : "Change folder…"}</Text>
              </Pressable>
            </View>
          )}
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
