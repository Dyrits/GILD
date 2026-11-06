import type { Message, MissionDetail, MissionId, Question, ThreadId } from "@openmission/contracts";
import { useEffect, useRef, useState } from "react";
import { FlatList, type NativeScrollEvent, type NativeSyntheticEvent, Pressable, Text, View } from "react-native";
import { newRequestId, type ServiceClient } from "./client";
import { Composer, StateBadge } from "./controls";
import { effortLabel, modelLabels, usageDetail } from "./formatting";
import { QuestionCard, QuestionLine } from "./questions";
import { styles } from "./styles";
import { maxOwnerDepth, OpenThreadForm, ThreadTree } from "./threadTree";
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

/**
 * Keeps the newest entry in view, so a reply or a question is seen as it arrives,
 * unless the owner has scrolled up to read earlier entries. Sending follows again.
 */
function useFollowNewest() {
  const list = useRef<FlatList<Entry>>(null);
  const isAtEnd = useRef(true);
  return {
    follow: () => {
      isAtEnd.current = true;
    },
    listProps: {
      onContentSizeChange: (_width: number, height: number) => {
        // scrollToEnd relies on item measurements the list may not have yet; the content height is known here.
        if (isAtEnd.current) list.current?.scrollToOffset({ animated: false, offset: height });
      },
      onScroll: ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
        isAtEnd.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 48;
      },
      ref: list,
      scrollEventThrottle: 100,
    },
  };
}

/** A thread title cut for a one-line label. */
const shortened = (title: string) => (title.length > 60 ? `${title.slice(0, 59)}…` : title);

/** One message, labelled by its sender: the owner, the thread's agent, or another thread. */
function MessageBubble({ message }: { message: Message }) {
  const sender =
    message.sender === "user"
      ? "You"
      : message.sender === "agent"
        ? "Agent"
        : `${message.isResult ? "Result from" : "From"} "${shortened(message.fromTitle ?? "a thread")}"`;
  const style =
    message.sender === "user" ? styles.fromUser : message.sender === "agent" ? styles.fromAgent : styles.fromThread;
  return (
    <View style={[styles.message, style]}>
      <Text style={styles.sender}>{sender}</Text>
      <Text style={styles.body}>{message.text}</Text>
    </View>
  );
}

/** The selected thread: its settings, notices, conversation, and composer. */
function ThreadPane({
  client,
  detail,
  onSelect,
}: {
  client: ServiceClient;
  detail: MissionDetail;
  onSelect: (threadId: ThreadId) => void;
}) {
  const { thread } = detail;
  const draft = useDraft(client, thread.id);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const followNewest = useFollowNewest();
  const act = (request: Promise<unknown>) =>
    request.then(
      () => setActionError(null),
      (reason: Error) => setActionError(reason.message),
    );
  return (
    <View style={[styles.flex, styles.pane]}>
      <View style={styles.header}>
        <Text numberOfLines={1} style={[styles.paneTitle, styles.flex]}>
          {thread.title}
        </Text>
        <StateBadge state={thread.state} />
        {(thread.state === "Running" || thread.state === "Attention" || thread.state === "Waiting") && (
          <Pressable onPress={() => act(client.request({ _tag: "StopThread", threadId: thread.id }))}>
            <Text style={styles.link}>Stop</Text>
          </Pressable>
        )}
        {thread.state === "Stopped" && (
          <Pressable onPress={() => act(client.request({ _tag: "ResumeThread", threadId: thread.id }))}>
            <Text style={styles.link}>Resume</Text>
          </Pressable>
        )}
        {thread.depth < maxOwnerDepth && !isOpening && (
          <Pressable onPress={() => setIsOpening(true)}>
            <Text style={styles.link}>Open thread beneath</Text>
          </Pressable>
        )}
      </View>
      {actionError !== null && <Text style={styles.error}>{actionError}</Text>}
      <Text numberOfLines={1} style={styles.muted}>
        {modelLabels[thread.model]} · {effortLabel(thread.effort)} ·{" "}
        {thread.workspace === null
          ? "No workspace: the mission's scratch folder"
          : `Workspace ${thread.workspace.name} · ${thread.workspace.path}`}
        {thread.workspace?.isMissing === true && " · folder missing"}
      </Text>
      {thread.state === "Stopped" && thread.waitingCount > 0 && (
        <Text style={styles.muted}>
          {thread.waitingCount === 1 ? "1 message waits" : `${thread.waitingCount} messages wait`} until you resume this
          thread.
        </Text>
      )}
      {thread.blocker === "MissingWorkspace" && thread.workspace !== null && (
        <MissingFolderNotice client={client} path={thread.workspace.path} threadId={thread.id} />
      )}
      {thread.failure != null && (
        <View style={styles.failure}>
          <Text style={styles.error}>The last turn failed: {thread.failure}</Text>
          <Text style={styles.muted}>Your next message retries it.</Text>
        </View>
      )}
      <FlatList<Entry>
        {...followNewest.listProps}
        data={entriesOf(detail)}
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
            <MessageBubble message={item.message} />
          )
        }
        style={styles.flex}
      />
      {isOpening ? (
        <OpenThreadForm
          client={client}
          onCancel={() => setIsOpening(false)}
          onOpened={(threadId) => {
            setIsOpening(false);
            onSelect(threadId);
          }}
          parent={thread}
        />
      ) : (
        <Composer
          onSend={(text) => {
            followNewest.follow();
            return client.request({ _tag: "SendMessage", requestId: newRequestId(), text, threadId: thread.id });
          }}
          placeholder={
            thread.state === "Stopped" ? "Write to this thread; it waits until you resume it…" : "Write to this thread…"
          }
        />
      )}
    </View>
  );
}

/** A mission: its thread tree on the side, the selected thread's conversation beside it. */
export function Conversation({
  client,
  missionId,
  onBack,
}: {
  client: ServiceClient;
  missionId: MissionId;
  onBack: () => void;
}) {
  const [selectedId, setSelectedId] = useState<ThreadId | null>(null);
  const { data, error } = useServiceQuery(
    client,
    { _tag: "ReadMission", missionId, threadId: selectedId },
    `${missionId}:${selectedId ?? "top"}`,
  );
  // A query for a newly selected thread answers after the previous one; keep showing what matches.
  const detail = data !== null && (selectedId === null || data.thread.id === selectedId) ? data : null;
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.link}>← Missions</Text>
        </Pressable>
        <Text numberOfLines={1} style={[styles.heading, styles.flex]}>
          {data?.mission.title ?? ""}
        </Text>
        {data && <StateBadge state={data.mission.state} />}
      </View>
      {data && <Text style={styles.muted}>{usageDetail(data.mission.usage)}</Text>}
      {error !== null && <Text style={styles.error}>{error}</Text>}
      {data && (
        <View style={[styles.flex, styles.split]}>
          <ThreadTree onSelect={setSelectedId} selectedId={data.thread.id} threads={data.threads} />
          {detail && <ThreadPane client={client} detail={detail} key={detail.thread.id} onSelect={setSelectedId} />}
        </View>
      )}
    </View>
  );
}
