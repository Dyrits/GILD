import type { Crest, RealmArchivePreview } from "@iskios/contracts";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { CrestBadge } from "../crest/crest";
import { crestOf, shuffledCrest } from "../crest/crestShapes";
import { CrestStudio } from "../crest/crestStudio";
import type { ServiceClient } from "../foundation/client";
import { messageOf } from "../foundation/client";
import { allMissions } from "../foundation/queries";
import { colors, fontSizes, fonts, outline, radii } from "../foundation/theme";
import { FolderPicker } from "./folderPicker";
import { newRealmCrestIdOf, shownCrestOf } from "./newRealmCrest";
import { folderNameOf, hasRealmNameCollision } from "./realmLabels";
import { proposedRealmOf } from "./realmRecovery";
import { creationStepOf } from "./realmRecoveryFlow";
import { RealmRecoveryModal } from "./realmRecoveryModal";

/** A realm being made: named and given a crest. The path is empty until a folder is chosen, and stays so for a realm tied to none. */
export type NewRealm = { crest: Crest | null; name: string; path: string };

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
  onCreated,
}: {
  client: ServiceClient;
  /** Whether the realm must be tied to a folder; where it need not, the folder can be chosen, changed, or left out. */
  isFolderRequired?: boolean;
  initial: NewRealm;
  onCancel: () => void;
  /** Selects the successfully created or recovered realm in the calling form. */
  onCreated?: (realm: NewRealm) => void;
}) {
  const [editing, setEditing] = useState(() => ({ ...initial, crest: initial.crest ?? shuffledCrest() }));
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [isBusy, setBusy] = useState(false);
  const [isDuplicate, setDuplicate] = useState(false);
  const [archived, setArchived] = useState<RealmArchivePreview | null>(null);
  // The realm is made wearing exactly the crest the menu shows (an undesigned one is drawn from the folder, not the new id).
  const proposed = proposedRealmOf({ ...editing, crest: shownCrestOf(editing) });
  const isReady = proposed.name !== "" && (!isFolderRequired || editing.path !== "") && !isBusy;
  const complete = () => {
    onCreated?.(proposed);
    onCancel();
  };
  const cancel = () => {
    if (!isBusy) onCancel();
  };
  const create = async (shouldAllowDuplicateName = false) => {
    if (!isReady) return;
    setBusy(true);
    setError(null);
    try {
      const previous =
        proposed.path === "" ? null : await client.request({ _tag: "FindArchivedRealm", path: proposed.path });
      const active = previous === null ? await client.request(allMissions.request) : null;
      const known = active?.workspaces.find((realm) => realm.path === proposed.path);
      const step = creationStepOf({
        hasArchivedRealm: previous !== null,
        hasDuplicateName: hasRealmNameCollision(proposed.name, active?.workspaces ?? [], known?.id ?? null),
        shouldAllowDuplicateName,
      });
      if (step === "recover") {
        setArchived(previous);
        return;
      }
      if (step === "duplicate") {
        setDuplicate(true);
        return;
      }
      await client.request({
        _tag: "CreateRealm",
        allowDuplicateName: shouldAllowDuplicateName,
        crest: proposed.crest,
        name: proposed.name,
        path: proposed.path === "" ? null : proposed.path,
      });
      complete();
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  };
  const choose = (path: string) => {
    setIsPicking(false);
    setError(null);
    setEditing({ ...editing, name: editing.name.trim() === "" ? folderNameOf(path) : editing.name, path });
  };
  if (archived !== null)
    return (
      <RealmRecoveryModal
        client={client}
        initial={archived}
        onCancel={() => setArchived(null)}
        onRecovered={complete}
        proposed={proposed}
      />
    );
  return (
    <Modal animationType="fade" onRequestClose={cancel} transparent visible>
      <View style={local.backdrop}>
        <Pressable accessibilityLabel="Close" disabled={isBusy} onPress={cancel} style={StyleSheet.absoluteFill} />
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
            <CrestBadge crest={editing.crest} id={newRealmCrestIdOf(editing.path)} size={72} />
            <View style={local.menuFields}>
              <Text style={local.menuLabel}>Name</Text>
              <TextInput
                accessibilityLabel="Realm name"
                autoFocus
                editable={!isBusy}
                maxLength={80}
                onChangeText={(name) => {
                  setEditing({ ...editing, name });
                  setDuplicate(false);
                }}
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
          {isDuplicate && (
            <Text style={local.error}>Another active realm is named "{proposed.name}". Use this name too?</Text>
          )}
          {error !== null && <Text style={local.error}>{error}</Text>}
          <View style={local.menuFooter}>
            <Pressable accessibilityRole="button" disabled={isBusy} onPress={cancel} style={local.menuButton}>
              <Text style={local.menuButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={!isReady}
              onPress={() => {
                void create(isDuplicate);
              }}
              style={[local.menuDone, !isReady && local.menuDoneOff]}
            >
              <Text style={local.menuDoneText}>{isDuplicate ? "Use this name" : "Create the realm"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
      {isPicking && <FolderPicker client={client} onCancel={() => setIsPicking(false)} onChoose={choose} />}
      {isStudioOpen && (
        <CrestStudio
          id={newRealmCrestIdOf(editing.path)}
          initial={editing.crest}
          name={editing.name.trim() || (editing.path === "" ? "New realm" : folderNameOf(editing.path))}
          onCancel={() => setIsStudioOpen(false)}
          onDone={(crest) => {
            setEditing({ ...editing, crest: crestOf(crest, editing.path || "new-realm") });
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
