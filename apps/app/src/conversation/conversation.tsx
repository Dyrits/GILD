import type { AttachmentId, BudgetScope, MessageDelivery, MissionDetail, MissionId, ThreadId } from "@iskios/contracts";
import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Image,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { imageRefusalOf } from "../attachments/attachmentRules";
import { BudgetScreen, BudgetStopCard } from "../editors/budgets";
import { RunnerPickers, useHarnesses } from "../editors/runners";
import { messageOf, newRequestId, type ServiceClient } from "../foundation/client";
import { colorScheme } from "../foundation/colorScheme";
import { companionLabelOf, effortLabel, harnessLabels, modelLabelOf } from "../foundation/formatting";
import { countedOf } from "../foundation/labels";
import { useHasSidebar, useHasTopBar, useQuestPanel } from "../foundation/shellContext";
import { styles } from "../foundation/styles";
import { useEnding } from "../foundation/useEnding";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { useSkills } from "../foundation/useSkills";
import { JournalScreen } from "../lore/journal";
import { LoreScreen } from "../lore/lore";
import { EndingConfirmation } from "../quests/missionActions";
import { MissingFolderNotice } from "../realms/workspaces";
import { useTerminal } from "../terminal/useTerminal";
import { Composer, StateIndicator } from "../ui/controls";
import { messageWithComments } from "./comments";
import { CommentTray } from "./commentViews";
import { AgentReply, EntryView, WorkingIndicator } from "./conversationEntries";
import { type Entry, entriesOf, workingLabelOf } from "./entries";
import { ChatterNotices } from "./threadActions";
import { ThreadPanel } from "./threadPanel";
import { OpenThreadForm, ThreadTree } from "./threadTree";
import { CommentsProvider, useThreadComments } from "./useComments";

/** The reply a thread is writing, while the service streams it. */
export function useDraft(client: ServiceClient, threadId: string | null) {
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
export function useFollowNewest() {
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
  onSelect,
  onOpenMission,
  onOpenBudget,
  onOpenDetails,
}: {
  /** Whether this thread's header offers the link to the quest's side panel, where no top bar has the icon. */
  canOpenDetails: boolean;
  client: ServiceClient;
  onOpenDetails: () => void;
  onOpenBudget: () => void;
  onOpenMission: (missionId: MissionId) => void;
  detail: MissionDetail;
  onSelect: (threadId: ThreadId) => void;
}) {
  const { thread } = detail;
  const ending = useEnding(client, detail.mission);
  const work = thread.parentId === null ? "quest" : "side-quest";
  const draft = useDraft(client, thread.id);
  const skills = useSkills(client, thread.workspace?.path ?? null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const terminal = useTerminal(thread.id, thread.workspace?.path ?? null);
  const followNewest = useFollowNewest();
  const comments = useThreadComments(thread.id);
  const { data: harnesses } = useHarnesses(client);
  const { data: settings } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  const { canOpenBeneath, canResume, canStop, isInTurn } = thread.actions;
  const parent = detail.threads.find((candidate) => candidate.id === thread.parentId);
  const defaultDelivery = settings?.defaultDelivery ?? "Steer";
  const other = ({ Queue: "Steer", Steer: "Queue" } as const satisfies Record<MessageDelivery, MessageDelivery>)[
    defaultDelivery
  ];
  const sendAs =
    (delivery: MessageDelivery | null) => async (text: string, attachmentIds: ReadonlyArray<AttachmentId>) => {
      const prepared = messageWithComments(await terminal.prepare(text), comments.items);
      followNewest.follow();
      await client.request({
        _tag: "SendMessage",
        attachmentIds,
        delivery,
        requestId: newRequestId(),
        text: prepared,
        threadId: thread.id,
      });
      // Kept until the service has taken the message, so a refused send loses none of them.
      comments.clear();
      terminal.sent();
    };
  const entries = entriesOf(detail, isInTurn);
  const act = (request: Promise<unknown>) =>
    request.then(
      () => setActionError(null),
      (reason) => setActionError(messageOf(reason)),
    );
  return (
    <CommentsProvider value={comments}>
      <View style={[styles.flex, styles.pane]}>
        <View style={styles.header}>
          <Text numberOfLines={1} style={[styles.paneTitle, styles.flex]}>
            {thread.title}
          </Text>
          <StateIndicator state={thread.state} />
          {thread.parentId === null && detail.mission.ritual === null && detail.mission.state !== "Archived" && (
            <Pressable
              accessibilityLabel="Archive quest"
              accessibilityRole="button"
              disabled={ending.isBusy}
              onPress={() => ending.start("Archived")}
            >
              <Image
                accessibilityElementsHidden
                source={
                  colorScheme === "dark"
                    ? require("../../assets/nav/dark/archive.png")
                    : require("../../assets/nav/light/archive.png")
                }
                style={{ height: 18, width: 18 }}
              />
            </Pressable>
          )}
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
          {canOpenDetails && (
            <Pressable onPress={onOpenDetails}>
              <Text style={styles.link}>Quest panel</Text>
            </Pressable>
          )}
        </View>
        <EndingConfirmation ending={ending} />
        {ending.error !== null && <Text style={styles.error}>{ending.error}</Text>}
        {parent !== undefined && (
          <Pressable onPress={() => onSelect(parent.id)}>
            <Text numberOfLines={1} style={styles.link}>
              Opened from: {parent.title}
            </Text>
          </Pressable>
        )}
        <ChatterNotices client={client} notices={detail.chatter} />
        {detail.budgetStop !== null && (
          <BudgetStopCard client={client} onRaise={onOpenBudget} stop={detail.budgetStop} />
        )}
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
            {countedOf(thread.waitingCount, "message")} {thread.waitingCount === 1 ? "waits" : "wait"} until you resume
            this
            {work}.
          </Text>
        )}
        {thread.blocker === "MissingWorkspace" && thread.workspace !== null && (
          <MissingFolderNotice client={client} path={thread.workspace.path} threadId={thread.id} />
        )}
        {thread.failure != null && (
          <View style={styles.failure}>
            <Text style={styles.error}>The last turn failed: {thread.failure}</Text>
            <Text style={styles.muted}>
              Retry runs it again on the Companion chosen below; your next message retries it too.
            </Text>
            {!isInTurn && thread.state !== "Stopped" && (
              <Pressable
                accessibilityRole="button"
                onPress={() => act(client.request({ _tag: "RetryThread", threadId: thread.id }))}
                style={styles.button}
              >
                <Text style={styles.buttonText}>Retry</Text>
              </Pressable>
            )}
          </View>
        )}
        <FlatList<Entry>
          {...followNewest.listProps}
          contentContainerStyle={styles.feed}
          data={entries}
          keyExtractor={(entry) => entry.key}
          ListFooterComponent={
            <View>
              {draft === "" ? (
                thread.actions.isInTurn ? (
                  <WorkingIndicator harness={thread.harness} label={workingLabelOf(entries)} />
                ) : (
                  void 0
                )
              ) : (
                <AgentReply
                  harness={thread.harness}
                  isDraft
                  label={`${companionLabelOf(thread.harness, null, thread.model)} · writing…`}
                  text={draft}
                  time={null}
                />
              )}
              {terminal.panel}
            </View>
          }
          renderItem={({ item }) => (
            <EntryView
              client={client}
              entry={item}
              harness={thread.harness}
              onOpenMission={onOpenMission}
              onSelectThread={onSelect}
              skills={skills}
              workspacePath={thread.workspace?.path ?? null}
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
          <>
            <CommentTray />
            <Composer
              {...(canOpenBeneath ? { onOpenSideQuest: () => setIsOpening(true) } : {})}
              hasContent={terminal.hasContent || comments.items.length > 0}
              {...(terminal.onBang === null ? {} : { onBang: terminal.onBang })}
              attachments={{ client, refusal: imageRefusalOf(harnesses, thread.harness, thread.model) }}
              mentions={{ client, workspacePath: thread.workspace?.path ?? null }}
              skills={skills}
              // The harness, account, Companion, and effort can change between turns: a handover (thread-handover). It
              // starts no turn: the next message, or Retry after a failed turn, runs on it.
              {...(isInTurn
                ? {}
                : {
                    accessory: (
                      <RunnerPickers
                        client={client}
                        harnesses={harnesses}
                        isCompact={true}
                        onChange={(next) =>
                          act(client.request({ _tag: "ChangeThreadRunner", ...next, threadId: thread.id }))
                        }
                        value={{
                          accountId: thread.accountId,
                          effort: thread.effort,
                          harness: thread.harness,
                          model: thread.model,
                        }}
                      />
                    ),
                  })}
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
          </>
        )}
      </View>
    </CommentsProvider>
  );
}

/** A mission: its thread tree on the side, the selected thread's conversation beside it. */
export function Conversation({
  client,
  missionId,
  onBack,
  onOpenMission,
  onSelectThread,
  onSetDetails,
  selectedThreadId,
}: {
  client: ServiceClient;
  missionId: MissionId;
  /** Shows another thread of this quest; the window keeps which one, so the sidebar can show it too. */
  onSelectThread: (threadId: ThreadId | null) => void;
  /** The thread shown, or null for the quest's top thread. */
  selectedThreadId: ThreadId | null;
  /** Opens or closes the quest's side panel. */
  onSetDetails: (isOpen: boolean) => void;
  onBack: () => void;
  /** Opens another mission, such as where an off-topic request went. */
  onOpenMission: (missionId: MissionId) => void;
}) {
  const { width } = useWindowDimensions();
  const isCompact = width < 820;
  const { data: settings } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  const selectedId = selectedThreadId;
  const setSelectedId = onSelectThread;
  const [isJournalOpen, setIsJournalOpen] = useState(false);
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
  // The quest's side panel is shown by the window's frame, beside the top bar's icon, not by this screen. It holds
  // the open thread's groups too: while another thread loads, the one before stays.
  const shown = detail ?? data;
  const hasSideQuests = data?.threads.some((thread) => thread.parentId !== null) ?? false;
  useQuestPanel(
    shown && (
      <ThreadPanel
        client={client}
        detail={shown}
        onOpenBudget={() => setBudgetScope("Mission")}
        onOpenJournal={() => setIsJournalOpen(true)}
        onOpenLore={() => setLoreThread({ id: shown.thread.id, title: shown.thread.title })}
        onOpenQuest={() => setSelectedId(shown.mission.topThreadId)}
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
      {hasSideQuests && !hasSidebar && (
        // With the sidebar showing, it is the quest's one tree; this one serves the narrow window, which has none.
        <View style={[styles.questSide, isCompact && styles.questSideCompact]}>
          <Pressable onPress={onBack}>
            <Text style={styles.link}>← Back</Text>
          </Pressable>
          {data && (
            <ThreadTree
              onSelect={setSelectedId}
              selectedId={data.thread.id}
              shouldShowAgentThreads={settings?.shouldShowAgentThreads ?? true}
              threads={data.threads}
            />
          )}
        </View>
      )}
      <View style={styles.questMain}>
        {!hasSidebar && !hasSideQuests && (
          <Pressable onPress={onBack}>
            <Text style={styles.link}>← Back</Text>
          </Pressable>
        )}
        {error !== null && <Text style={styles.error}>{error}</Text>}
        {detail && (
          <ThreadPane
            canOpenDetails={!hasTopBar}
            client={client}
            detail={detail}
            key={detail.thread.id}
            onOpenBudget={() => setBudgetScope(detail.budgetStop?.scope ?? "Mission")}
            onOpenDetails={() => onSetDetails(true)}
            onOpenMission={onOpenMission}
            onSelect={setSelectedId}
          />
        )}
      </View>
    </View>
  );
}
