import type { Message, MissionDetail, MissionId, Question } from "@openmission/contracts";
import { useEffect, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { newRequestId, type ServiceClient } from "./client";
import { Composer, StateBadge } from "./controls";
import { effortLabel, modelLabels, usageDetail } from "./formatting";
import { QuestionCard, QuestionLine } from "./questions";
import { styles } from "./styles";
import { useServiceQuery } from "./useServiceQuery";
import { MissingFolderNotice } from "./workspaces";

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

type Entry = { _tag: "Message"; at: number; message: Message } | { _tag: "Question"; at: number; question: Question };

/** Messages and questions in the order they happened. */
const entriesOf = (detail: MissionDetail): Array<Entry> =>
  [
    ...detail.messages.map((message): Entry => ({ _tag: "Message", at: message.sentAt, message })),
    ...detail.questions.map((question): Entry => ({ _tag: "Question", at: question.askedAt, question })),
  ].sort((a, b) => a.at - b.at);

const keyOf = (entry: Entry) => (entry._tag === "Message" ? entry.message.id : entry.question.id);

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
  const [stopError, setStopError] = useState<string | null>(null);
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
        {data && (data.thread.state === "Running" || data.thread.state === "Attention") && (
          <Pressable
            onPress={() =>
              client
                .request({ _tag: "StopThread", threadId: data.thread.id })
                .catch((reason: Error) => setStopError(reason.message))
            }
          >
            <Text style={styles.link}>Stop</Text>
          </Pressable>
        )}
      </View>
      {stopError !== null && <Text style={styles.error}>{stopError}</Text>}
      {data && (
        <Text style={styles.muted}>
          {modelLabels[data.thread.model]} · {effortLabel(data.thread.effort)} · {usageDetail(data.mission.usage)}
        </Text>
      )}
      {data && (
        <Text numberOfLines={1} style={styles.muted}>
          {data.thread.workspace === null
            ? "No workspace: the mission's scratch folder"
            : `Workspace ${data.thread.workspace.name} · ${data.thread.workspace.path}`}
          {data.thread.workspace?.isMissing === true && " · folder missing"}
        </Text>
      )}
      {data?.thread.blocker === "MissingWorkspace" && data.thread.workspace !== null && (
        <MissingFolderNotice client={client} path={data.thread.workspace.path} threadId={data.thread.id} />
      )}
      {data?.thread.failure != null && (
        <View style={styles.failure}>
          <Text style={styles.error}>The last turn failed: {data.thread.failure}</Text>
          <Text style={styles.muted}>Your next message retries it.</Text>
        </View>
      )}
      {error !== null && <Text style={styles.error}>{error}</Text>}
      <FlatList<Entry>
        data={data === null ? [] : entriesOf(data)}
        keyExtractor={keyOf}
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
        renderItem={({ item }) =>
          item._tag === "Question" ? (
            item.question.outcome === null ? (
              <QuestionCard client={client} question={item.question} />
            ) : (
              <QuestionLine question={item.question} />
            )
          ) : (
            <View style={[styles.message, item.message.sender === "user" ? styles.fromUser : styles.fromAgent]}>
              <Text style={styles.sender}>{item.message.sender === "user" ? "You" : "Agent"}</Text>
              <Text style={styles.body}>{item.message.text}</Text>
            </View>
          )
        }
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
