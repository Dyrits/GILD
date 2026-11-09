import type { BudgetScope, MessageDelivery, MissionDetail, MissionId, ThreadId } from "@gild/contracts";
import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { BudgetScreen, BudgetStopCard } from "./budgets";
import { newRequestId, type ServiceClient } from "./client";
import { Composer, StateBadge } from "./controls";
import { EntryView } from "./conversationEntries";
import { type Entry, entriesOf } from "./entries";
import { companionLabelOf, effortLabel, harnessLabels, modelLabelOf } from "./formatting";
import { JournalScreen } from "./journal";
import { LoreIcon, LoreScreen } from "./lore";
import { QuestSidebar } from "./questPanel";
import { useHasSidebar, useHasTopBar, useQuestPanel } from "./sidebar";
import { styles } from "./styles";
import { ChatterNotices, DeleteThreadAction } from "./threadActions";
import { ThreadPanel } from "./threadPanel";
import { OpenThreadForm, ThreadTree } from "./threadTree";
import { useServiceQuery } from "./useServiceQuery";
import { useSkills } from "./useSkills";
import { MissingFolderNotice } from "./workspaces";

/** The key under which the browser remembers whether the thread panel shows. */
const threadPanelKey = "gild:thread-panel-open";

/** Reads whether the thread panel was left open; a platform without browser storage starts closed. */
const readThreadPanelOpen = (): boolean => {
  try {
    return globalThis.localStorage?.getItem(threadPanelKey) === "1";
  } catch {
    return false;
  }
};

/** Remembers whether the thread panel shows where the platform allows; a refusal only loses the memory. */
const rememberThreadPanelOpen = (isOpen: boolean) => {
  try {
    globalThis.localStorage?.setItem(threadPanelKey, isOpen ? "1" : "0");
  } catch {}
};

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
  canOpenDetails,
  client,
  detail,
  isThreadPanelOpen,
  onSelect,
  onToggleThreadPanel,
  onDeleted,
  onOpenMission,
  onOpenBudget,
  onOpenDetails,
  onOpenLore,
}: {
  /** Whether this thread's header offers the link to the quest's side panel, where no top bar has the icon. */
  canOpenDetails: boolean;
  client: ServiceClient;
  /** Whether the thread panel shows beside the conversation; null where the window is too narrow for it. */
  isThreadPanelOpen: boolean | null;
  onToggleThreadPanel: () => void;
  onOpenDetails: () => void;
  onDeleted: () => void;
  onOpenBudget: () => void;
  onOpenLore: () => void;
  onOpenMission: (missionId: MissionId) => void;
  detail: MissionDetail;
  onSelect: (threadId: ThreadId) => void;
}) {
  const { thread } = detail;
  const work = thread.parentId === null ? "quest" : "side-quest";
  const companionOf = (reported: string | null) => companionLabelOf(thread.harness, reported, thread.model);
  const draft = useDraft(client, thread.id);
  const skills = useSkills(client, thread.workspace?.path ?? null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const followNewest = useFollowNewest();
  const { data: settings } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  const { canOpenBeneath, canResume, canStop, isInTurn } = thread.actions;
  const parent = detail.threads.find((candidate) => candidate.id === thread.parentId);
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
        <LoreIcon gauge={detail.loreGauge} onPress={onOpenLore} />
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
        {isThreadPanelOpen !== null && (
          <Pressable onPress={onToggleThreadPanel}>
            <Text style={styles.link}>{isThreadPanelOpen ? "Hide thread panel" : "Thread panel"}</Text>
          </Pressable>
        )}
        {canOpenDetails && (
          <Pressable onPress={onOpenDetails}>
            <Text style={styles.link}>Quest panel</Text>
          </Pressable>
        )}
        {canOpenBeneath && !isOpening && (
          <Pressable onPress={() => setIsOpening(true)}>
            <Text style={styles.link}>Open side-quest</Text>
          </Pressable>
        )}
      </View>
      {parent !== undefined && (
        <Pressable onPress={() => onSelect(parent.id)}>
          <Text numberOfLines={1} style={styles.link}>
            Opened from: {parent.title}
          </Text>
        </Pressable>
      )}
      <DeleteThreadAction client={client} onDeleted={onDeleted} threadId={thread.id} />
      <ChatterNotices client={client} notices={detail.chatter} />
      {detail.budgetStop !== null && <BudgetStopCard client={client} onRaise={onOpenBudget} stop={detail.budgetStop} />}
      {actionError !== null && <Text style={styles.error}>{actionError}</Text>}
      <Text numberOfLines={1} style={styles.muted}>
        {harnessLabels[thread.harness]}
        {thread.accountId === null ? "" : ` (${thread.accountLabel})`} · {modelLabelOf(thread.model)} ·{" "}
        {effortLabel(thread.effort)} ·{" "}
        {thread.workspace === null
          ? "No realm: the quest's scratch folder"
          : `Realm ${thread.workspace.name} · ${thread.workspace.path}`}
        {thread.workspace?.isMissing === true && " · folder missing"}
      </Text>
      {thread.state === "Stopped" && thread.waitingCount > 0 && (
        <Text style={styles.muted}>
          {thread.waitingCount === 1 ? "1 message waits" : `${thread.waitingCount} messages wait`} until you resume this
          {work}.
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
        contentContainerStyle={styles.feed}
        data={entriesOf(detail)}
        keyExtractor={(entry) => entry.key}
        ListFooterComponent={
          draft === "" ? (
            void 0
          ) : (
            <View style={[styles.message, styles.fromAgent, styles.draft]}>
              <Text style={styles.sender}>{companionOf(null)} · writing…</Text>
              <Text style={styles.body}>{draft}</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <EntryView
            client={client}
            companionOf={companionOf}
            entry={item}
            onOpenMission={onOpenMission}
            onSelectThread={onSelect}
          />
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
          skills={skills}
          {...(isInTurn
            ? {
                alternative: { label: other, onSend: sendAs(other) },
                onInterrupt: () => client.request({ _tag: "InterruptThread", threadId: thread.id }),
              }
            : {})}
          onSend={sendAs(isInTurn ? defaultDelivery : null)}
          placeholder={
            thread.state === "Stopped"
              ? `Write to this ${work}; it waits until you resume it…`
              : isInTurn
                ? `Write to this ${work}; Send ${defaultDelivery === "Steer" ? "joins its current turn" : "waits for its next turn"}…`
                : `Write to this ${work}…`
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
  onSetDetails,
}: {
  client: ServiceClient;
  missionId: MissionId;
  /** Opens or closes the quest's side panel. */
  onSetDetails: (isOpen: boolean) => void;
  onBack: () => void;
  /** Opens another mission, such as where an off-topic request went. */
  onOpenMission: (missionId: MissionId) => void;
}) {
  const { width } = useWindowDimensions();
  const isCompact = width < 820;
  const { data: settings } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  const [selectedId, setSelectedId] = useState<ThreadId | null>(null);
  const [isJournalOpen, setIsJournalOpen] = useState(false);
  const [isThreadPanelOpen, setIsThreadPanelOpen] = useState(readThreadPanelOpen);
  const hasTopBar = useHasTopBar();
  const hasSidebar = useHasSidebar();
  const [loreThread, setLoreThread] = useState<{ id: ThreadId; title: string } | null>(null);
  const [budgetScope, setBudgetScope] = useState<BudgetScope | null>(null);
  const { data, error } = useServiceQuery(
    client,
    { _tag: "ReadMission", missionId, threadId: selectedId },
    `${missionId}:${selectedId ?? "top"}`,
  );
  // A query for a newly selected thread answers after the previous one; keep showing what matches.
  const detail = data !== null && (selectedId === null || data.thread.id === selectedId) ? data : null;
  // The quest's side panel is shown by the window's frame, beside the top bar's icon, not by this screen.
  useQuestPanel(
    data && (
      <QuestSidebar
        client={client}
        mission={data.mission}
        onOpenBudget={() => setBudgetScope("Mission")}
        onOpenJournal={() => setIsJournalOpen(true)}
      />
    ),
  );
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
  if (loreThread !== null) {
    return (
      <LoreScreen
        client={client}
        onBack={() => setLoreThread(null)}
        threadId={loreThread.id}
        title={`Lore · ${loreThread.title}`}
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
    <View style={[styles.questLayout, isCompact && styles.questLayoutCompact]}>
      <View style={[styles.questSide, isCompact && styles.questSideCompact]}>
        {!hasSidebar && (
          <Pressable onPress={onBack}>
            <Text style={styles.link}>← Quests</Text>
          </Pressable>
        )}
        {data && (
          <ThreadTree
            onSelect={setSelectedId}
            selectedId={data.thread.id}
            shouldShowAgentThreads={settings?.shouldShowAgentThreads ?? true}
            threads={data.threads}
          />
        )}
      </View>
      <View style={styles.questMain}>
        {error !== null && <Text style={styles.error}>{error}</Text>}
        {detail && (
          <ThreadPane
            canOpenDetails={!hasTopBar}
            client={client}
            detail={detail}
            isThreadPanelOpen={isCompact ? null : isThreadPanelOpen}
            key={detail.thread.id}
            onDeleted={() => (detail.thread.parentId === null ? onBack() : setSelectedId(detail.thread.parentId))}
            onOpenBudget={() => setBudgetScope(detail.budgetStop?.scope ?? "Mission")}
            onOpenDetails={() => onSetDetails(true)}
            onOpenLore={() => setLoreThread({ id: detail.thread.id, title: detail.thread.title })}
            onOpenMission={onOpenMission}
            onSelect={setSelectedId}
            onToggleThreadPanel={() => {
              rememberThreadPanelOpen(!isThreadPanelOpen);
              setIsThreadPanelOpen(!isThreadPanelOpen);
            }}
          />
        )}
      </View>
      {!isCompact && isThreadPanelOpen && detail && (
        <View style={styles.threadPanel}>
          <ThreadPanel
            client={client}
            detail={detail}
            onOpenLore={() => setLoreThread({ id: detail.thread.id, title: detail.thread.title })}
          />
        </View>
      )}
    </View>
  );
}
