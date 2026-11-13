import type { Folder, FolderListing } from "@iskios/contracts";
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { messageOf, type ServiceClient } from "../foundation/client";
import { useActiveHost } from "../foundation/hostContext";
import { colors, fontSizes, fonts, outline, radii } from "../foundation/theme";
import { Button } from "../ui/button";
import { parentLabelOf } from "./folderPickerLabels";

/** How long typing pauses before the host is asked, so a fast typist sends one search and not one per key. */
const searchDelayMs = 180;

/**
 * The folder picker (device-pairing, CHG-0253), one for this computer and for a paired host: a search field taking a
 * name or a typed path, the folders quests already used when nothing is typed, step-in browsing, and New folder. The
 * host answers every request, so it shows its own folders, and a paired device sees only those under the host's
 * browsable roots.
 */
export function FolderPicker({
  client,
  onCancel,
  onChoose,
}: {
  client: ServiceClient;
  onCancel: () => void;
  /** Called with the chosen folder's path. */
  onChoose: (path: string) => void;
}) {
  const host = useActiveHost();
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<ReadonlyArray<Folder>>([]);
  const [listing, setListing] = useState<FolderListing | null>(null);
  const [browsed, setBrowsed] = useState<string | null>(null);
  const [isHiddenShown, setIsHiddenShown] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  // The search follows the field; a stale answer is dropped.
  useEffect(() => {
    let isCurrent = true;
    const timer = setTimeout(() => {
      client.request({ _tag: "SearchFolders", query }).then(
        (folders) => {
          if (!isCurrent) return;
          setFound(folders);
          setError(null);
        },
        (reason) => {
          if (isCurrent) setError(messageOf(reason));
        },
      );
    }, searchDelayMs);
    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [client, query]);

  // The folder being browsed follows the browsed path and Show hidden.
  useEffect(() => {
    let isCurrent = true;
    client.request({ _tag: "BrowseFolders", path: browsed, shouldIncludeHidden: isHiddenShown }).then(
      (next) => {
        if (!isCurrent) return;
        setListing(next);
        setError(null);
      },
      (reason) => {
        if (isCurrent) setError(messageOf(reason));
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [client, browsed, isHiddenShown]);

  const stepInto = (path: string) => {
    setQuery("");
    setBrowsed(path);
  };
  const current = listing?.path ?? null;
  const makeFolder = () => {
    if (current === null) return;
    client.request({ _tag: "CreateFolder", name: newName, parent: current }).then(
      (folder) => {
        setNewName("");
        setError(null);
        setBrowsed(folder.path);
      },
      (reason) => setError(messageOf(reason)),
    );
  };

  const isSearching = query.trim() !== "";
  return (
    <Modal animationType="fade" onRequestClose={onCancel} transparent visible>
      <View style={local.backdrop}>
        <Pressable accessibilityLabel="Close" onPress={onCancel} style={StyleSheet.absoluteFill} />
        <View style={local.menu}>
          <Text style={local.title}>Choose a folder</Text>
          <Text style={local.muted}>
            On {host.name}.{" "}
            {host.hostId === null
              ? "Type a name or a path."
              : "Only the folders its Workshop lists as browsable roots can be chosen."}
          </Text>
          <TextInput
            accessibilityLabel="Search folders"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            onChangeText={setQuery}
            placeholder="Search by name, or type a path such as ~/Code"
            placeholderTextColor={colors.placeholder}
            style={local.input}
            value={query}
          />
          {error !== null && <Text style={local.error}>{error}</Text>}
          <ScrollView style={local.list}>
            <Text style={local.heading}>{isSearching ? "Matches" : "Used before"}</Text>
            {found.length === 0 && (
              <Text style={local.muted}>{isSearching ? "No folder matches." : "No folders used yet."}</Text>
            )}
            {found.map((folder) => (
              <Row folder={folder} key={folder.path} onOpen={stepInto} onUse={onChoose} />
            ))}
            {!isSearching && (
              <>
                <View style={local.browseHeader}>
                  <Text style={local.heading}>Browse</Text>
                  {listing?.parent !== undefined && current !== null && (
                    <Pressable accessibilityRole="button" onPress={() => setBrowsed(listing.parent)}>
                      <Text style={local.link}>↑ Up</Text>
                    </Pressable>
                  )}
                  <Text numberOfLines={1} style={[local.path, local.flex]}>
                    {current ?? "Browsable roots"}
                  </Text>
                  {current !== null && (
                    <Pressable accessibilityRole="button" onPress={() => setIsHiddenShown(!isHiddenShown)}>
                      <Text style={local.link}>{isHiddenShown ? "Hide hidden" : "Show hidden"}</Text>
                    </Pressable>
                  )}
                </View>
                {listing !== null && listing.folders.length === 0 && <Text style={local.muted}>No folders here.</Text>}
                {listing?.folders.map((folder) => (
                  <Row folder={folder} key={folder.path} onOpen={stepInto} onUse={onChoose} />
                ))}
              </>
            )}
          </ScrollView>
          {!isSearching && current !== null && (
            <View style={local.newFolder}>
              <TextInput
                accessibilityLabel="New folder name"
                onChangeText={setNewName}
                placeholder="New folder in this one"
                placeholderTextColor={colors.placeholder}
                style={[local.input, local.flex]}
                value={newName}
              />
              <Button isDisabled={newName.trim() === ""} isPrimary={false} label="New folder" onPress={makeFolder} />
            </View>
          )}
          <View style={local.footer}>
            <Button isPrimary={false} label="Cancel" onPress={onCancel} />
            <Button
              isDisabled={current === null}
              label="Use this folder"
              onPress={() => current !== null && onChoose(current)}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** One folder: its name and where it lies; pressing the row steps into it, Use chooses it. */
function Row({
  folder,
  onOpen,
  onUse,
}: {
  folder: Folder;
  onOpen: (path: string) => void;
  onUse: (path: string) => void;
}) {
  return (
    <View style={local.row}>
      <Pressable accessibilityRole="button" onPress={() => onOpen(folder.path)} style={local.flex}>
        <Text numberOfLines={1} style={local.rowName}>
          📁 {folder.name}
        </Text>
        <Text numberOfLines={1} style={local.rowPath}>
          {parentLabelOf(folder.path)}
        </Text>
      </Pressable>
      <Pressable
        accessibilityLabel={`Use ${folder.name}`}
        accessibilityRole="button"
        onPress={() => onUse(folder.path)}
      >
        <Text style={local.link}>Use</Text>
      </Pressable>
    </View>
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
  browseHeader: { alignItems: "center", flexDirection: "row", gap: 10, marginTop: 12 },
  error: { color: colors.dangerText, fontFamily: fonts.sans, fontSize: fontSizes.md },
  flex: { flex: 1 },
  footer: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  heading: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: 12, marginBottom: 4 },
  input: {
    ...outline,
    backgroundColor: colors.canvas,
    borderRadius: radii.sm,
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: fontSizes.base,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  link: { color: colors.accent, fontFamily: fonts.sans, fontSize: fontSizes.base, fontWeight: "600" },
  list: { maxHeight: 320 },
  menu: {
    ...outline,
    backgroundColor: colors.page,
    borderRadius: radii.xl,
    gap: 12,
    maxWidth: 560,
    padding: 20,
    width: "100%",
  },
  muted: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.base },
  newFolder: { alignItems: "center", flexDirection: "row", gap: 10 },
  path: { color: colors.textMuted, fontFamily: fonts.mono, fontSize: fontSizes.sm },
  row: { alignItems: "center", flexDirection: "row", gap: 10, paddingVertical: 6 },
  rowName: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.base },
  rowPath: { color: colors.textMuted, fontFamily: fonts.mono, fontSize: fontSizes.sm },
  title: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.xl, fontWeight: "700" },
});
