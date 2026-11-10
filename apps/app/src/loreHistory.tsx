import type { DeletedLoreEntry, LoreEntryId, LoreHistoryEntry, LoreHistoryEntryId } from "@gild/contracts";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { messageOf, type ServiceClient } from "./client";
import { timeOf } from "./formatting";
import { loreHistoryLineOf, scopeNameOf } from "./labels";
import { styles } from "./styles";
import { useServiceQuery } from "./useServiceQuery";

// Stored and wire names keep `intel` so existing data and agents still work: request tags (`"ListIntel"`, ...).

// A lore entry's history with Undo, and deleted lore with Undo deletion (scoped-intel, History and undo).

/** Undoes one history entry, showing the refusal when there is one. */
function useUndo(client: ServiceClient) {
  const [error, setError] = useState<string | null>(null);
  const undo = (entryId: LoreHistoryEntryId) =>
    client.request({ _tag: "UndoIntelChange", entryId }).then(
      () => setError(null),
      (reason) => setError(messageOf(reason)),
    );
  return { error, undo };
}

/** One history entry: who or what made it and when, the text before and after, and Undo. */
function HistoryEntry({ entry, onUndo }: { entry: LoreHistoryEntry; onUndo: () => void }) {
  return (
    <View style={styles.section}>
      <View style={styles.row}>
        <Text style={[styles.muted, styles.flex]}>
          {loreHistoryLineOf(entry)} · {timeOf(entry.at)}
        </Text>
        {entry.canUndo && (
          <Pressable accessibilityLabel={`Undo: ${loreHistoryLineOf(entry)}`} onPress={onUndo}>
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

/** A lore entry's history, newest first, each entry with Undo while it stands. */
export function LoreHistoryScreen({
  client,
  loreEntryId,
  onBack,
}: {
  client: ServiceClient;
  loreEntryId: LoreEntryId;
  onBack: () => void;
}) {
  const { data, error } = useServiceQuery(
    client,
    { _tag: "ReadIntelHistory", loreEntryId },
    `lore-history:${loreEntryId}`,
  );
  const undoing = useUndo(client);
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.link}>← Back</Text>
        </Pressable>
        <Text numberOfLines={1} style={[styles.heading, styles.flex]}>
          Lore history{data?.isDeleted === true ? " · deleted" : ""}
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

/** A deleted lore entry under the Deleted filter, with Undo deletion and its history. */
export function DeletedLoreEntryRow({
  client,
  loreEntry,
  onHistory,
}: {
  client: ServiceClient;
  loreEntry: DeletedLoreEntry;
  onHistory: () => void;
}) {
  const undoing = useUndo(client);
  return (
    <View style={styles.section}>
      <Text style={styles.muted}>
        {scopeNameOf(loreEntry.scopeLabel)} · {loreEntry.kind} · deleted {timeOf(loreEntry.deletedAt)}
      </Text>
      <View style={styles.row}>
        <Text style={[styles.body, styles.flex]}>{loreEntry.text}</Text>
        <Pressable onPress={() => undoing.undo(loreEntry.entryId)}>
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
