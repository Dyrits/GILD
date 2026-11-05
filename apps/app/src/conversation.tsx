import type { MissionId } from "@openmission/contracts";
import { useEffect, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { newRequestId, type ServiceClient } from "./client";
import { Composer, StateBadge } from "./controls";
import { effortLabel, modelLabels, usageDetail } from "./formatting";
import { styles } from "./styles";
import { useServiceQuery } from "./useServiceQuery";

/** The reply a thread is writing, while the service streams it. */
function useDraft(client: ServiceClient, threadId: string | null) {
  const [draft, setDraft] = useState("");
  useEffect(() => {
    setDraft("");
    const unsubscribe = client.subscribeDrafts((id, text) => {
      if (id === threadId) setDraft(text);
    });
    return () => {
      unsubscribe();
    };
  }, [client, threadId]);
  return draft;
}

export function Conversation({
  client,
  missionId,
  onBack,
}: {
  client: ServiceClient;
  missionId: MissionId;
  onBack: () => void;
}) {
  const { data, error } = useServiceQuery(client, { _tag: "ReadMission", missionId }, missionId);
  const draft = useDraft(client, data?.thread.id ?? null);
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.link}>← Missions</Text>
        </Pressable>
        <Text numberOfLines={1} style={[styles.heading, styles.flex]}>
          {data?.mission.title ?? ""}
        </Text>
        {data && <StateBadge state={data.thread.state} />}
      </View>
      {data && (
        <Text style={styles.muted}>
          {modelLabels[data.thread.model]} · {effortLabel(data.thread.effort)} · {usageDetail(data.mission.usage)}
        </Text>
      )}
      {data?.thread.failure != null && (
        <View style={styles.failure}>
          <Text style={styles.error}>The last turn failed: {data.thread.failure}</Text>
          <Text style={styles.muted}>Your next message retries it.</Text>
        </View>
      )}
      {error !== null && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={data?.messages ?? []}
        keyExtractor={(message) => message.id}
        ListFooterComponent={
          draft === "" ? (
            void 0
          ) : (
            <View style={[styles.message, styles.fromAgent, styles.draft]}>
              <Text style={styles.sender}>Agent · writing…</Text>
              <Text style={styles.body}>{draft}</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={[styles.message, item.sender === "user" ? styles.fromUser : styles.fromAgent]}>
            <Text style={styles.sender}>{item.sender === "user" ? "You" : "Agent"}</Text>
            <Text style={styles.body}>{item.text}</Text>
          </View>
        )}
        style={styles.flex}
      />
      {data && (
        <Composer
          onSend={(text) =>
            client.request({ _tag: "SendMessage", requestId: newRequestId(), text, threadId: data.thread.id })
          }
          placeholder="Write to this thread…"
        />
      )}
    </View>
  );
}
