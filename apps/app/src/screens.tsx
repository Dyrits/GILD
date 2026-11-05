import type { MissionId, MissionSummary, ThreadState } from "@openmission/contracts";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { newRequestId, type ServiceClient } from "./client";
import { useServiceQuery } from "./useServiceQuery";

const stateColors: Record<ThreadState, string> = {
  Attention: "#b45309",
  Failed: "#b91c1c",
  Running: "#1d4ed8",
  Waiting: "#7c3aed",
  Idle: "#4b5563",
  Done: "#15803d",
  Stopped: "#374151",
};

function StateBadge({ state }: { state: ThreadState }) {
  return (
    <View style={[styles.badge, { backgroundColor: stateColors[state] }]}>
      <Text style={styles.badgeText}>{state}</Text>
    </View>
  );
}

/** A message box that keeps the text until the service accepts it. */
function Composer({ placeholder, onSend }: { placeholder: string; onSend: (text: string) => Promise<unknown> }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const send = async () => {
    if (text.trim() === "" || sending) return;
    setSending(true);
    try {
      await onSend(text);
      setText("");
      setError(undefined);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSending(false);
    }
  };
  return (
    <View style={styles.composer}>
      <TextInput
        style={styles.input}
        multiline
        value={text}
        placeholder={placeholder}
        onChangeText={setText}
        onKeyPress={(event) => {
          const native = event.nativeEvent as { key: string; shiftKey?: boolean };
          if (native.key === "Enter" && !native.shiftKey) {
            event.preventDefault();
            void send();
          }
        }}
      />
      <Pressable style={[styles.button, sending && styles.buttonDisabled]} onPress={send} disabled={sending}>
        <Text style={styles.buttonText}>Send</Text>
      </Pressable>
      {error !== undefined && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const timeOf = (millis: number) => new Date(millis).toLocaleString();

export function Dashboard({ client, onOpen }: { client: ServiceClient; onOpen: (id: MissionId) => void }) {
  const { data: missions, error } = useServiceQuery(client, { _tag: "ListMissions" }, "missions");
  return (
    <View style={styles.screen}>
      <Text style={styles.heading}>Missions</Text>
      <Composer
        placeholder="Start a mission with one message…"
        onSend={async (text) =>
          onOpen((await client.request({ _tag: "StartMission", requestId: newRequestId(), text })).missionId)
        }
      />
      {error !== undefined && <Text style={styles.error}>{error}</Text>}
      <FlatList<MissionSummary>
        data={missions ?? []}
        keyExtractor={(mission) => mission.id}
        ListEmptyComponent={missions && <Text style={styles.muted}>No missions yet.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => onOpen(item.id)}>
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
            <StateBadge state={item.state} />
            <Text style={styles.muted}>{timeOf(item.lastActivityAt)}</Text>
          </Pressable>
        )}
      />
    </View>
  );
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
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.link}>← Missions</Text>
        </Pressable>
        <Text style={[styles.heading, styles.flex]} numberOfLines={1}>
          {data?.mission.title ?? ""}
        </Text>
        {data && <StateBadge state={data.thread.state} />}
      </View>
      {error !== undefined && <Text style={styles.error}>{error}</Text>}
      <FlatList
        style={styles.flex}
        data={data?.messages ?? []}
        keyExtractor={(message) => message.id}
        renderItem={({ item }) => (
          <View style={[styles.message, item.sender === "user" ? styles.fromUser : styles.fromAgent]}>
            <Text style={styles.sender}>{item.sender === "user" ? "You" : "Agent"}</Text>
            <Text style={styles.body}>{item.text}</Text>
          </View>
        )}
      />
      {data && (
        <Composer
          placeholder="Write to this thread…"
          onSend={(text) =>
            client.request({ _tag: "SendMessage", requestId: newRequestId(), threadId: data.thread.id, text })
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, gap: 16, backgroundColor: "#fafafa" },
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 16 },
  heading: { fontSize: 22, fontWeight: "600", color: "#111827" },
  composer: { gap: 8 },
  input: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
    fontSize: 15,
  },
  button: {
    alignSelf: "flex-end",
    backgroundColor: "#111827",
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 6,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "600" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#e5e7eb",
  },
  title: { flex: 1, fontSize: 16, color: "#111827" },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  muted: { color: "#6b7280" },
  link: { color: "#1d4ed8", fontSize: 15 },
  error: { color: "#b91c1c" },
  message: { padding: 12, borderRadius: 8, marginVertical: 4, maxWidth: "80%" },
  fromUser: { alignSelf: "flex-end", backgroundColor: "#dbeafe" },
  fromAgent: { alignSelf: "flex-start", backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb" },
  sender: { fontSize: 12, color: "#6b7280", marginBottom: 4 },
  body: { fontSize: 15, color: "#111827" },
});
