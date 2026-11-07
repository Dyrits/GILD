import type { ThreadId } from "@canopy/contracts";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { ServiceClient } from "./client";
import { styles } from "./styles";

/** Opens the system's folder dialog through the desktop shell; null when cancelled. */
const chooseFolder = () =>
  window.canopy === undefined
    ? Promise.reject(new Error("Choosing a folder needs the desktop app."))
    : window.canopy.chooseFolder();

/**
 * Chooses a mission's workspace before it starts: a folder picked in Finder or Explorer,
 * or none for the mission's scratch folder (workspace-attachment; CHG-0035).
 */
export function WorkspacePicker({
  onChange,
  value,
}: {
  onChange: (path: string | null) => void;
  value: string | null;
}) {
  const [chooseError, setChooseError] = useState<string | null>(null);
  const choose = () =>
    chooseFolder().then(
      (path) => {
        setChooseError(null);
        if (path !== null) onChange(path);
      },
      (reason: Error) => setChooseError(reason.message),
    );
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.muted}>
          Workspace: <Text style={styles.code}>{value ?? "none (the mission's scratch folder)"}</Text>
        </Text>
        <Pressable onPress={choose}>
          <Text style={styles.link}>Choose folder…</Text>
        </Pressable>
        {value !== null && (
          <Pressable onPress={() => onChange(null)}>
            <Text style={styles.link}>No workspace</Text>
          </Pressable>
        )}
      </View>
      {chooseError !== null && <Text style={styles.error}>{chooseError}</Text>}
    </View>
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
      <Text style={styles.error}>The workspace folder {path} no longer exists.</Text>
      <Text style={styles.muted}>Your messages wait. Put the folder back, then retry.</Text>
      <Pressable onPress={retry} style={styles.button}>
        <Text style={styles.buttonText}>Retry</Text>
      </Pressable>
      {retryError !== null && <Text style={styles.error}>{retryError}</Text>}
    </View>
  );
}
