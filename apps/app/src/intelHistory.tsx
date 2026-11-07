import type { DeletedIntel, IntelHistoryEntry, IntelHistoryEntryId, IntelId } from "@openmission/contracts";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { ServiceClient } from "./client";
import { timeOf } from "./formatting";
import { intelHistoryLineOf } from "./labels";
import { styles } from "./styles";
import { useServiceQuery } from "./useServiceQuery";

// An intel's history with Undo, and deleted intel with Undo deletion (scoped-intel, History and undo).

/** Undoes one history entry, showing the refusal when there is one. */
function useUndo(client: ServiceClient) {
  const [error, setError] = useState<string | null>(null);
  const undo = (entryId: IntelHistoryEntryId) =>
    client.request({ _tag: "UndoIntelChange", entryId }).then(
      () => setError(null),
      (reason: Error) => setError(reason.message),
    );
  return { error, undo };
}

/** One history entry: who or what made it and when, the text before and after, and Undo. */
function HistoryEntry({ entry, onUndo }: { entry: IntelHistoryEntry; onUndo: () => void }) {
  return (
    <View style={styles.section}>
      <View style={styles.row}>
        <Text style={[styles.muted, styles.flex]}>
          {intelHistoryLineOf(entry)} · {timeOf(entry.at)}
        </Text>
        {entry.canUndo && (
          <Pressable accessibilityLabel={`Undo: ${intelHistoryLineOf(entry)}`} onPress={onUndo}>
            <Text style={styles.link}>Undo</Text>
          </Pressable>
        )}
      </View>
      {entry.previousText !== null && entry.previousText !== entry.text && (
        <Text style={styles.muted}>Was: {entry.previousText}</Text>
      )}
      {entry.text !== null && entry.text !== entry.previousText && <Text style={styles.body}>{entry.text}</Text>}
    </View>
  );
}

/** An intel's history, newest first, each entry with Undo while it stands. */
export function IntelHistoryScreen({
  client,
  intelId,
  onBack,
}: {
  client: ServiceClient;
  intelId: IntelId;
  onBack: () => void;
}) {
  const { data, error } = useServiceQuery(client, { _tag: "ReadIntelHistory", intelId }, `intel-history:${intelId}`);
  const undoing = useUndo(client);
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.link}>← Back</Text>
        </Pressable>
        <Text numberOfLines={1} style={[styles.heading, styles.flex]}>
          Intel history{data?.isDeleted === true ? " · deleted" : ""}
        </Text>
      </View>
      {error !== null && <Text style={styles.error}>{error}</Text>}
      {undoing.error !== null && <Text style={styles.error}>{undoing.error}</Text>}
      {data && (
        <ScrollView style={styles.flex}>
          {data.entries.map((entry) => (
            <HistoryEntry entry={entry} key={entry.id} onUndo={() => undoing.undo(entry.id)} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

/** A deleted intel under the Deleted filter, with Undo deletion and its history. */
export function DeletedIntelRow({
  client,
  intel,
  onHistory,
}: {
  client: ServiceClient;
  intel: DeletedIntel;
  onHistory: () => void;
}) {
  const undoing = useUndo(client);
  return (
    <View style={styles.section}>
      <Text style={styles.muted}>
        {intel.scopeLabel} · {intel.kind} · deleted {timeOf(intel.deletedAt)}
      </Text>
      <View style={styles.row}>
        <Text style={[styles.body, styles.flex]}>{intel.text}</Text>
        <Pressable onPress={() => undoing.undo(intel.entryId)}>
          <Text style={styles.link}>Undo deletion</Text>
        </Pressable>
        <Pressable onPress={onHistory}>
          <Text style={styles.link}>History</Text>
        </Pressable>
      </View>
      {undoing.error !== null && <Text style={styles.error}>{undoing.error}</Text>}
    </View>
  );
}
