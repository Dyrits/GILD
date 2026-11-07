import type { ChatterNotice, DeletionPreview, ThreadId } from "@openmission/contracts";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { ServiceClient } from "./client";
import { deletionQuestionOf } from "./labels";
import { styles } from "./styles";

/** One confirmation names the entire subtree the owner is about to delete permanently. */
export function DeleteThreadAction({
  client,
  threadId,
  onDeleted,
}: {
  client: ServiceClient;
  threadId: ThreadId;
  onDeleted: () => void;
}) {
  const [preview, setPreview] = useState<DeletionPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const showPreview = () => {
    setIsBusy(true);
    client
      .request({ _tag: "PreviewDeletion", threadId })
      .then(
        (value) => {
          setPreview(value);
          setError(null);
        },
        (reason: Error) => setError(reason.message),
      )
      .finally(() => setIsBusy(false));
  };
  const remove = () => {
    if (preview === null) return;
    setIsBusy(true);
    client
      .request({ _tag: "DeleteThread", confirmation: preview.confirmation, threadId })
      .then(
        () => onDeleted(),
        (reason: Error) => {
          setError(reason.message);
          setPreview(null);
        },
      )
      .finally(() => setIsBusy(false));
  };
  return (
    <View>
      {preview === null ? (
        <Pressable disabled={isBusy} onPress={showPreview}>
          <Text style={styles.link}>Delete</Text>
        </Pressable>
      ) : (
        <View style={styles.failure}>
          <Text style={styles.body}>{deletionQuestionOf(preview)}</Text>
          <Text style={styles.muted}>
            This permanently erases {preview.isMission ? "the mission" : "these threads"} and their conversations.
          </Text>
          <View style={styles.inlineRow}>
            <Pressable disabled={isBusy} onPress={remove}>
              <Text style={styles.link}>Delete permanently</Text>
            </Pressable>
            <Pressable disabled={isBusy} onPress={() => setPreview(null)}>
              <Text style={styles.link}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

/** Each chatter pause offers the owner's two choices in either participant's conversation. */
export function ChatterNotices({ client, notices }: { client: ServiceClient; notices: ReadonlyArray<ChatterNotice> }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const decide = (id: string, choice: "Continue" | "Stop") => {
    setPending(id);
    client
      .request({ _tag: "ResolveChatter", choice, id })
      .then(
        () => setError(null),
        (reason: Error) => setError(reason.message),
      )
      .finally(() => setPending(null));
  };
  return (
    <View>
      {notices.map((notice) => (
        <View key={notice.id} style={styles.failure}>
          <Text style={styles.body}>
            {notice.firstTitle} and {notice.secondTitle} exchanged {notice.count} messages without you
          </Text>
          <View style={styles.inlineRow}>
            <Pressable disabled={pending !== null} onPress={() => decide(notice.id, "Continue")}>
              <Text style={styles.link}>Let them continue</Text>
            </Pressable>
            <Pressable disabled={pending !== null} onPress={() => decide(notice.id, "Stop")}>
              <Text style={styles.link}>Stop both</Text>
            </Pressable>
          </View>
        </View>
      ))}
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}
