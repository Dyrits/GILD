// OpenMission's own folder browser and the browsable roots, kept for phone browsing
// (workspace-attachment). Not shown on the desktop, which uses the system's folder dialog (CHG-0035).
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import type { ServiceClient } from "./client";
import { styles } from "./styles";
import { useServiceQuery } from "./useServiceQuery";

/** Browses folders under the browsable roots, with New folder and Show hidden. */
export function FolderBrowser({ client, onChoose }: { client: ServiceClient; onChoose: (path: string) => void }) {
  const [path, setPath] = useState<string | null>(null);
  const [shouldIncludeHidden, setShouldIncludeHidden] = useState(false);
  const { data: listing, error } = useServiceQuery(
    client,
    { _tag: "BrowseFolders", path, shouldIncludeHidden },
    `folders-${shouldIncludeHidden}-${path ?? ""}`,
  );
  const current = listing?.path ?? null;
  return (
    <View style={styles.details}>
      {error !== null && <Text style={styles.error}>{error}</Text>}
      {listing && (
        <>
          <View style={styles.header}>
            {current !== null && (
              <Pressable onPress={() => setPath(listing.parent)}>
                <Text style={styles.link}>↑ Up</Text>
              </Pressable>
            )}
            <Text numberOfLines={1} style={[styles.code, styles.flex]}>
              {current ?? "Browsable roots"}
            </Text>
            {current !== null && (
              <Pressable onPress={() => setShouldIncludeHidden(!shouldIncludeHidden)}>
                <Text style={styles.link}>{shouldIncludeHidden ? "Hide hidden" : "Show hidden"}</Text>
              </Pressable>
            )}
            {current !== null && (
              <Pressable onPress={() => onChoose(current)} style={styles.button}>
                <Text style={styles.buttonText}>Use this folder</Text>
              </Pressable>
            )}
          </View>
          {listing.folders.length === 0 && <Text style={styles.muted}>No folders here.</Text>}
          {listing.folders.map((folder) => (
            <Pressable key={folder.path} onPress={() => setPath(folder.path)}>
              <Text style={styles.body}>📁 {folder.name}</Text>
            </Pressable>
          ))}
          {current !== null && <NewFolder client={client} onCreated={setPath} parent={current} />}
        </>
      )}
    </View>
  );
}

/** Makes a folder inside the one being browsed, then opens it. */
function NewFolder({
  client,
  onCreated,
  parent,
}: {
  client: ServiceClient;
  onCreated: (path: string) => void;
  parent: string;
}) {
  const [name, setName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const create = () =>
    client.request({ _tag: "CreateFolder", name, parent }).then(
      (folder) => {
        setName("");
        setCreateError(null);
        onCreated(folder.path);
      },
      (reason: Error) => setCreateError(reason.message),
    );
  return (
    <>
      <View style={styles.header}>
        <TextInput onChangeText={setName} placeholder="New folder name" style={styles.flex} value={name} />
        <Pressable disabled={name.trim() === ""} onPress={create}>
          <Text style={styles.link}>New folder</Text>
        </Pressable>
      </View>
      {createError !== null && <Text style={styles.error}>{createError}</Text>}
    </>
  );
}

/** The browsable roots in Settings, with Add root. */
export function BrowsableRoots({ client }: { client: ServiceClient }) {
  const { data: roots, error } = useServiceQuery(
    client,
    { _tag: "BrowseFolders", path: null, shouldIncludeHidden: false },
    "browsable-roots",
  );
  const [path, setPath] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const add = () =>
    client.request({ _tag: "AddBrowsableRoot", path }).then(
      () => {
        setPath("");
        setAddError(null);
      },
      (reason: Error) => setAddError(reason.message),
    );
  return (
    <View style={styles.section}>
      <Text style={styles.label}>Browsable roots</Text>
      <Text style={styles.muted}>Workspaces are chosen from folders under these.</Text>
      {error !== null && <Text style={styles.error}>{error}</Text>}
      {roots?.folders.map((root) => (
        <Text key={root.path} style={styles.code}>
          {root.path}
        </Text>
      ))}
      <View style={styles.header}>
        <TextInput onChangeText={setPath} placeholder="/Volumes/Drive/Code" style={styles.flex} value={path} />
        <Pressable disabled={path.trim() === ""} onPress={add}>
          <Text style={styles.link}>Add root</Text>
        </Pressable>
      </View>
      {addError !== null && <Text style={styles.error}>{addError}</Text>}
    </View>
  );
}
