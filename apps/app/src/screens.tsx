import {
  type EffortChoice,
  EffortChoice as EffortChoices,
  type MissionId,
  type MissionSummary,
  type ModelChoice,
  ModelChoice as ModelChoices,
  type Settings,
  type ThreadState,
  type TokenUsage,
} from "@openmission/contracts";
import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
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

const modelLabels: Record<ModelChoice, string> = {
  default: "Claude Code default",
  fable: "Fable",
  opus: "Opus",
  sonnet: "Sonnet",
  haiku: "Haiku",
};
const effortLabel = (effort: EffortChoice) => (effort === "default" ? "Default effort" : effort);

function StateBadge({ state }: { state: ThreadState }) {
  return (
    <View style={[styles.badge, { backgroundColor: stateColors[state] }]}>
      <Text style={styles.badgeText}>{state}</Text>
    </View>
  );
}

/** One choice among a few options, shown as chips. */
function Choice<T extends string>({
  options,
  value,
  label,
  onChange,
}: {
  options: ReadonlyArray<T>;
  value: T;
  label: (option: T) => string;
  onChange: (option: T) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map((option) => (
        <Pressable
          key={option}
          onPress={() => onChange(option)}
          style={[styles.chip, option === value && styles.chipSelected]}
        >
          <Text style={[styles.chipText, option === value && styles.chipTextSelected]}>{label(option)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n));
const usageText = (usage: TokenUsage) =>
  `${compact(usage.input + usage.cacheRead + usage.cacheCreation)} in · ${compact(usage.output)} out tokens`;
const usageDetail = (usage: TokenUsage) =>
  `Input ${usage.input}, cache read ${usage.cacheRead}, cache written ${usage.cacheCreation}, output ${usage.output} tokens`;

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

export function Dashboard({
  client,
  onOpen,
  onSettings,
}: {
  client: ServiceClient;
  onOpen: (id: MissionId) => void;
  onSettings: () => void;
}) {
  const { data: missions, error } = useServiceQuery(client, { _tag: "ListMissions" }, "missions");
  const { data: settings } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  const [model, setModel] = useState<ModelChoice>();
  const [effort, setEffort] = useState<EffortChoice>();
  const chosenModel = model ?? settings?.defaultModel ?? "default";
  const chosenEffort = effort ?? settings?.defaultEffort ?? "default";
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={[styles.heading, styles.flex]}>Missions</Text>
        <Pressable onPress={onSettings}>
          <Text style={styles.link}>Settings</Text>
        </Pressable>
      </View>
      <Composer
        placeholder="Start a mission with one message…"
        onSend={async (text) =>
          onOpen(
            (
              await client.request({
                _tag: "StartMission",
                requestId: newRequestId(),
                text,
                model: chosenModel,
                effort: chosenEffort,
              })
            ).missionId,
          )
        }
      />
      <Choice options={ModelChoices.literals} value={chosenModel} label={(m) => modelLabels[m]} onChange={setModel} />
      <Choice options={EffortChoices.literals} value={chosenEffort} label={effortLabel} onChange={setEffort} />
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
            <Text style={styles.muted}>{usageText(item.usage)}</Text>
            <Text style={styles.muted}>{timeOf(item.lastActivityAt)}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

export function SettingsScreen({ client, onBack }: { client: ServiceClient; onBack: () => void }) {
  const { data: settings, error } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  const [saveError, setSaveError] = useState<string>();
  const save = (change: Partial<Settings>) => {
    if (settings === undefined) return;
    client.request({ _tag: "UpdateSettings", settings: { ...settings, ...change } }).then(
      () => setSaveError(undefined),
      (reason: Error) => setSaveError(reason.message),
    );
  };
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.link}>← Missions</Text>
        </Pressable>
        <Text style={styles.heading}>Settings</Text>
      </View>
      {error !== undefined && <Text style={styles.error}>{error}</Text>}
      {saveError !== undefined && <Text style={styles.error}>{saveError}</Text>}
      {settings && (
        <View style={styles.settings}>
          <Text style={styles.label}>Default model for new missions</Text>
          <Choice
            options={ModelChoices.literals}
            value={settings.defaultModel}
            label={(m) => modelLabels[m]}
            onChange={(defaultModel) => save({ defaultModel })}
          />
          <Text style={styles.label}>Default effort for new missions</Text>
          <Choice
            options={EffortChoices.literals}
            value={settings.defaultEffort}
            label={effortLabel}
            onChange={(defaultEffort) => save({ defaultEffort })}
          />
          <View style={styles.toggle}>
            <Switch value={settings.streamReplies} onValueChange={(streamReplies) => save({ streamReplies })} />
            <Text style={styles.body}>Show replies as they're written</Text>
          </View>
        </View>
      )}
    </View>
  );
}

/** The reply a thread is writing, while the service streams it. */
function useDraft(client: ServiceClient, threadId: string | undefined) {
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
  const draft = useDraft(client, data?.thread.id);
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
        ListFooterComponent={
          draft === "" ? undefined : (
            <View style={[styles.message, styles.fromAgent, styles.draft]}>
              <Text style={styles.sender}>Agent · writing…</Text>
              <Text style={styles.body}>{draft}</Text>
            </View>
          )
        }
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
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  chipSelected: { backgroundColor: "#111827", borderColor: "#111827" },
  chipText: { color: "#374151", fontSize: 13 },
  chipTextSelected: { color: "#fff" },
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
  failure: { gap: 4, padding: 12, borderRadius: 8, backgroundColor: "#fef2f2" },
  settings: { gap: 12 },
  label: { fontWeight: "600", color: "#111827", marginTop: 8 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  message: { padding: 12, borderRadius: 8, marginVertical: 4, maxWidth: "80%" },
  fromUser: { alignSelf: "flex-end", backgroundColor: "#dbeafe" },
  fromAgent: { alignSelf: "flex-start", backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb" },
  draft: { opacity: 0.7, borderStyle: "dashed" },
  sender: { fontSize: 12, color: "#6b7280", marginBottom: 4 },
  body: { fontSize: 15, color: "#111827" },
});
