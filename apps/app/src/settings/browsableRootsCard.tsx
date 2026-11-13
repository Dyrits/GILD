import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { messageOf, type ServiceClient } from "../foundation/client";
import { useActiveHost } from "../foundation/hostContext";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { Button } from "../ui/button";
import { SettingsCard, SettingsRule } from "./settingsParts";

/**
 * The folders open to Iskios (device-pairing, CHG-0253): the host's browsable roots, where the folder picker searches
 * by name. A paired device searches, browses, and makes folders only under them; the host's own window may also type
 * any full path. They start with the home folder, and only the host itself adds or removes one, so a paired device
 * cannot widen its own reach.
 */
export function BrowsableRootsCard({ client }: { client: ServiceClient }) {
  const host = useActiveHost();
  const isOnHost = host.hostId === null;
  const { data: roots, error: readError } = useServiceQuery(
    client,
    { _tag: "BrowseFolders", path: null, shouldIncludeHidden: false },
    "browsable-roots",
  );
  const [path, setPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const attempt = (work: Promise<unknown>) =>
    work.then(
      () => setError(null),
      (reason) => setError(messageOf(reason)),
    );
  return (
    <SettingsCard icon="monitor" summary="Where Iskios looks for folders" title="Folders open to Iskios">
      <Text style={styles.muted}>
        Iskios searches these when you choose a folder. A paired device can search, browse, and make folders only under
        them. In this computer's own window, a full path typed in the folder picker works anywhere.
      </Text>
      {readError !== null && <Text style={styles.error}>{readError}</Text>}
      {roots?.folders.length === 0 && (
        <Text style={styles.muted}>No folder is open: name searches find nothing, and paired devices see none.</Text>
      )}
      {roots?.folders.map((root) => (
        <View key={root.path} style={local.root}>
          <Text selectable style={[styles.code, local.rootPath]}>
            {root.path}
          </Text>
          {isOnHost && (
            <Button
              isPrimary={false}
              label="Remove"
              onPress={() => void attempt(client.request({ _tag: "RemoveBrowsableRoot", path: root.path }))}
            />
          )}
        </View>
      ))}
      {isOnHost ? (
        <>
          <SettingsRule />
          <View style={local.root}>
            <TextInput
              accessibilityLabel="Folder to open to Iskios"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setPath}
              placeholder="/Volumes/Drive/Code"
              placeholderTextColor={colors.placeholder}
              style={local.input}
              value={path}
            />
            <Button
              isDisabled={path.trim() === ""}
              label="Add folder"
              onPress={() => void attempt(client.request({ _tag: "AddBrowsableRoot", path }).then(() => setPath("")))}
            />
          </View>
        </>
      ) : (
        <Text style={styles.muted}>
          These are set on {host.name} itself. Switch to this computer in the host menu to change them.
        </Text>
      )}
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </SettingsCard>
  );
}

const local = StyleSheet.create({
  input: {
    backgroundColor: colors.page,
    borderColor: colors.edge,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: fontSizes.md,
    padding: 8,
  },
  root: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between" },
  rootPath: { flex: 1 },
});
