import type { BudgetScope, MessageDelivery, MissionDetail, MissionId, ThreadId } from "@openmission/contracts";
import { useEffect, useRef, useState } from "react";
import { FlatList, type NativeScrollEvent, type NativeSyntheticEvent, Pressable, Text, View } from "react-native";
import { BudgetMeters, BudgetScreen, BudgetStopCard } from "./budgets";
import { newRequestId, type ServiceClient } from "./client";
import { Composer, StateBadge } from "./controls";
import { type Entry, EntryView, entriesOf } from "./conversationEntries";
import { effortLabel, modelLabels, usageDetail } from "./formatting";
import { IntelIcon, IntelScreen } from "./intel";
import { JournalScreen } from "./journal";
import { MissionEndingActions, MissionTitle } from "./missionActions";
import { useHasSidebar } from "./sidebar";
import { styles } from "./styles";
import { ChatterNotices, DeleteThreadAction } from "./threadActions";
import { OpenThreadForm, ThreadTree } from "./threadTree";
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
/** The selected thread: its settings, notices, conversation, and composer. */
function ThreadPane({
  client,
  detail,
  onSelect,
  onDeleted,
  onOpenMission,
  onOpenBudget,
  onOpenIntel,
}: {
  client: ServiceClient;
  onDeleted: () => void;
  onOpenBudget: () => void;
  onOpenIntel: () => void;
  onOpenMission: (missionId: MissionId) => void;
  detail: MissionDetail;
  onSelect: (threadId: ThreadId) => void;
}) {
  const { thread } = detail;
  const draft = useDraft(client, thread.id);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const followNewest = useFollowNewest();
  const { data: settings } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  const { canOpenBeneath, canResume, canStop, isInTurn } = thread.actions;
  const defaultDelivery = settings?.defaultDelivery ?? "Steer";
  const other = ({ Queue: "Steer", Steer: "Queue" } as const satisfies Record<MessageDelivery, MessageDelivery>)[
    defaultDelivery
  ];
  const sendAs = (delivery: MessageDelivery | null) => (text: string) => {
    followNewest.follow();
    return client.request({ _tag: "SendMessage", delivery, requestId: newRequestId(), text, threadId: thread.id });
  };
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
        <IntelIcon gauge={detail.intelGauge} onPress={onOpenIntel} />
        <StateBadge state={thread.state} />
        {canStop && (
          <Pressable onPress={() => act(client.request({ _tag: "StopThread", threadId: thread.id }))}>
            <Text style={styles.link}>Stop</Text>
          </Pressable>
        )}
        {canResume && (
          <Pressable onPress={() => act(client.request({ _tag: "ResumeThread", threadId: thread.id }))}>
            <Text style={styles.link}>Resume</Text>
          </Pressable>
        )}
        {canOpenBeneath && !isOpening && (
          <Pressable onPress={() => setIsOpening(true)}>
            <Text style={styles.link}>Open thread beneath</Text>
          </Pressable>
        )}
      </View>
      <DeleteThreadAction client={client} onDeleted={onDeleted} threadId={thread.id} />
      <ChatterNotices client={client} notices={detail.chatter} />
      {detail.budgetStop !== null && <BudgetStopCard client={client} onRaise={onOpenBudget} stop={detail.budgetStop} />}
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
        keyExtractor={(entry) => entry.key}
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
          <EntryView client={client} entry={item} onOpenMission={onOpenMission} onSelectThread={onSelect} />
        )}
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
          {...(isInTurn
            ? {
                alternative: { label: other, onSend: sendAs(other) },
                onInterrupt: () => client.request({ _tag: "InterruptThread", threadId: thread.id }),
              }
            : {})}
          onSend={sendAs(isInTurn ? defaultDelivery : null)}
          placeholder={
            thread.state === "Stopped"
              ? "Write to this thread; it waits until you resume it…"
              : isInTurn
                ? `Write to this thread; Send ${defaultDelivery === "Steer" ? "joins its current turn" : "waits for its next turn"}…`
                : "Write to this thread…"
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
  onOpenMission,
}: {
  client: ServiceClient;
  missionId: MissionId;
  onBack: () => void;
  /** Opens another mission, such as where an off-topic request went. */
  onOpenMission: (missionId: MissionId) => void;
}) {
  const hasSidebar = useHasSidebar();
  const { data: settings } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  const [selectedId, setSelectedId] = useState<ThreadId | null>(null);
  const [isJournalOpen, setIsJournalOpen] = useState(false);
  const [intelThread, setIntelThread] = useState<{ id: ThreadId; title: string } | null>(null);
  const [budgetScope, setBudgetScope] = useState<BudgetScope | null>(null);
  const { data, error } = useServiceQuery(
    client,
    { _tag: "ReadMission", missionId, threadId: selectedId },
    `${missionId}:${selectedId ?? "top"}`,
  );
  // A query for a newly selected thread answers after the previous one; keep showing what matches.
  const detail = data !== null && (selectedId === null || data.thread.id === selectedId) ? data : null;
  if (budgetScope !== null) {
    return (
      <BudgetScreen
        client={client}
        missionId={budgetScope === "Mission" ? missionId : null}
        onBack={() => setBudgetScope(null)}
        title={budgetScope === "Mission" ? `Budget · ${data?.mission.title ?? ""}` : "Global budget"}
      />
    );
  }
  if (intelThread !== null) {
    return (
      <IntelScreen
        client={client}
        onBack={() => setIntelThread(null)}
        threadId={intelThread.id}
        title={`Intel · ${intelThread.title}`}
      />
    );
  }
  if (isJournalOpen) {
    return (
      <JournalScreen
        client={client}
        missionId={missionId}
        onBack={() => setIsJournalOpen(false)}
        title={data?.mission.title ?? ""}
      />
    );
  }
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        {!hasSidebar && (
          <Pressable onPress={onBack}>
            <Text style={styles.link}>← Missions</Text>
          </Pressable>
        )}
        {data ? (
          <MissionTitle client={client} key={data.mission.title} mission={data.mission} />
        ) : (
          <View style={styles.flex} />
        )}
        <Pressable onPress={() => setIsJournalOpen(true)}>
          <Text style={styles.link}>Journal</Text>
        </Pressable>
        {data && <BudgetMeters onPress={() => setBudgetScope("Mission")} use={data.mission.budget} />}
        <Pressable onPress={() => setBudgetScope("Mission")}>
          <Text style={styles.link}>Budget</Text>
        </Pressable>
        {data && <MissionEndingActions client={client} mission={data.mission} />}
        {data && <StateBadge state={data.mission.state} />}
      </View>
      {data && <Text style={styles.muted}>{usageDetail(data.mission.usage)}</Text>}
      {error !== null && <Text style={styles.error}>{error}</Text>}
      {data && (
        <View style={[styles.flex, styles.split]}>
          <ThreadTree
            onSelect={setSelectedId}
            selectedId={data.thread.id}
            shouldShowAgentThreads={settings?.shouldShowAgentThreads ?? true}
            threads={data.threads}
          />
          {detail && (
            <ThreadPane
              client={client}
              detail={detail}
              key={detail.thread.id}
              onDeleted={() => (detail.thread.parentId === null ? onBack() : setSelectedId(detail.thread.parentId))}
              onOpenBudget={() => setBudgetScope(detail.budgetStop?.scope ?? "Mission")}
              onOpenIntel={() => setIntelThread({ id: detail.thread.id, title: detail.thread.title })}
              onOpenMission={onOpenMission}
              onSelect={setSelectedId}
            />
          )}
        </View>
      )}
    </View>
  );
}
