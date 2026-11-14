import type { AttachmentId, GuildHallRecap, GuildmasterPlace, MissionId, Viewing } from "@iskios/contracts";
import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { imageRefusalOf } from "../attachments/attachmentRules";
import { BudgetScreen, BudgetStopCard } from "../editors/budgets";
import { RunnerPickers, useHarnesses } from "../editors/runners";
import { useThreadPresets } from "../editors/useThreadPresets";
import { actWith } from "../foundation/acting";
import { newRequestId, type ServiceClient } from "../foundation/client";
import { companionLabelOf, harnessLabels } from "../foundation/formatting";
import { allMissions } from "../foundation/queries";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { useSkills } from "../foundation/useSkills";
import { useTerminal } from "../terminal/useTerminal";
import { Composer, StateIndicator } from "../ui/controls";
import { useDraft, useFollowNewest } from "./conversation";
import { AgentReply, EntryView, WorkingIndicator } from "./conversationEntries";
import { type Entry, entriesOf, workingLabelOf } from "./entries";
import { GuildHallHub } from "./guildHallHub";
import { ThreadBackups } from "./threadBackups";

/** The realm chosen for the next message, shown over the message box and cleared with its ×. */
function RealmNote({ name, onClear }: { name: string; onClear: () => void }) {
  return (
    <View style={local.note}>
      <Text style={local.noteText}>
        The next quest opens in <Text style={local.noteName}>{name}</Text>
      </Text>
      <Pressable accessibilityLabel="Clear the realm" accessibilityRole="button" onPress={onClear}>
        <Text style={local.noteClear}>×</Text>
      </Pressable>
    </View>
  );
}

/**
 * The Guild Hall page: the hub, with what waits for the owner, the quests touched last, and the recap of the period.
 * Iskios's conversation is not here but in the panel every screen offers (`shell/iskiosDock.tsx`).
 */
export function GuildmasterScreen({
  client,
  onOpenMission,
  onViewAll,
}: {
  client: ServiceClient;
  onOpenMission: (id: MissionId) => void;
  onViewAll: () => void;
}) {
  const recap = useVisitRecap(client);
  const { data: known } = useServiceQuery(client, allMissions.request, allMissions.key);
  return (
    <View style={local.hubPage}>
      <GuildHallHub
        missions={known?.missions ?? null}
        onOpenMission={onOpenMission}
        onViewAll={onViewAll}
        recap={recap}
      />
    </View>
  );
}

/**
 * The recap of the period since the owner's last visit, read when the owner arrives and kept on that start while they
 * stay; arriving also records the visit, so the next recap starts here (quest coordination, Guild Hall as a hub).
 */
function useVisitRecap(client: ServiceClient): GuildHallRecap | null {
  const [start, setStart] = useState<{ isFirstVisit: boolean; since: number } | null>(null);
  const { data: recap } = useServiceQuery(
    client,
    { _tag: "ReadGuildHallRecap", since: start?.since ?? null },
    `guild-hall-recap:${start?.since ?? "arriving"}`,
  );
  useEffect(() => {
    if (recap === null || start !== null) return;
    setStart({ isFirstVisit: recap.isFirstVisit, since: recap.since });
    client.request({ _tag: "VisitGuildHall" }).catch(() => {});
  }, [client, recap, start]);
  // Later reads give the start back, so only the first read knows it was the owner's first visit.
  return recap === null || start === null ? recap : { ...recap, isFirstVisit: start.isFirstVisit };
}

/**
 * Iskios: one permanent conversation that takes any request, looks for a quest that already fits, offers to continue
 * it or proposes a new one as a card for the owner to open, and shows each action as a card (quest coordination). A
 * realm chosen on a realm's page is attached to the next message. It sits in a panel the owner folds (`onFold`).
 */
export function IskiosConversation({
  client,
  isFull,
  onFold,
  onOpenMission,
  onRealm,
  onToggleFull,
  realmPath,
  viewing,
}: {
  client: ServiceClient;
  /** Whether the panel fills the whole content area. */
  isFull: boolean;
  /** Folds the panel this conversation sits in; none when the top bar's button folds it, so no ✕ is shown. */
  onFold: (() => void) | null;
  /** Fills the content area with the panel, or restores it. */
  onToggleFull: () => void;
  onOpenMission: (id: MissionId) => void;
  onRealm: (path: string | null) => void;
  realmPath: string | null;
  /** The screen the panel is open beside, which Iskios reads with each message. */
  viewing: Viewing;
}) {
  const { data: place, error } = useServiceQuery(client, { _tag: "ReadGuildmaster" }, "guildmaster");
  if (place === null)
    return (
      <View style={local.page}>
        <Text style={styles.muted}>{error ?? "Calling Iskios…"}</Text>
      </View>
    );
  return (
    <IskiosChat
      client={client}
      isFull={isFull}
      onFold={onFold}
      onOpenMission={onOpenMission}
      onRealm={onRealm}
      onToggleFull={onToggleFull}
      place={place}
      realmPath={realmPath}
      viewing={viewing}
    />
  );
}

function IskiosChat({
  client,
  isFull,
  onFold,
  onOpenMission,
  onRealm,
  onToggleFull,
  place,
  realmPath,
  viewing,
}: {
  client: ServiceClient;
  isFull: boolean;
  onFold: (() => void) | null;
  onOpenMission: (id: MissionId) => void;
  onRealm: (path: string | null) => void;
  onToggleFull: () => void;
  place: GuildmasterPlace;
  realmPath: string | null;
  viewing: Viewing;
}) {
  const { data: known } = useServiceQuery(client, allMissions.request, allMissions.key);
  const { data: harnesses } = useHarnesses(client);
  const realms = known?.workspaces ?? [];
  // A realm tied to no folder has a null path too, so no path chosen matches none of them (CHG-0161).
  const realm = realmPath === null ? null : (realms.find((candidate) => candidate.path === realmPath) ?? null);
  const { data: detail } = useServiceQuery(
    client,
    { _tag: "ReadMission", missionId: place.missionId, threadId: null },
    `guildmaster:${place.missionId}`,
  );
  const draft = useDraft(client, place.threadId);
  const followNewest = useFollowNewest();
  const skills = useSkills(client, realm?.path ?? null);
  const terminal = useTerminal(place.threadId, realmPath);
  const [actionError, setActionError] = useState<string | null>(null);
  const presetChoice = useThreadPresets(client, place.threadId, setActionError);
  // The Guildmaster can have a budget of its own, set on its own screen like a quest's (budget-control).
  const [isBudgetOpen, setIsBudgetOpen] = useState(false);
  if (detail === null) {
    return (
      <View style={local.page}>
        <Text style={styles.muted}>Calling Iskios…</Text>
      </View>
    );
  }
  if (isBudgetOpen) {
    return (
      <BudgetScreen
        client={client}
        missionId={place.missionId}
        onBack={() => setIsBudgetOpen(false)}
        title="Budget · Iskios"
      />
    );
  }
  const { thread } = detail;
  const entries = entriesOf(detail, detail.thread.actions.isInTurn);
  const send = async (text: string, attachmentIds: ReadonlyArray<AttachmentId>) => {
    const prepared = await terminal.prepare(text);
    followNewest.follow();
    await client.request({
      _tag: "SendMessage",
      attachmentIds,
      delivery: null,
      realmPath,
      requestId: newRequestId(),
      text: prepared,
      threadId: thread.id,
      viewing,
    });
    terminal.sent();
  };
  const { canResume, canStop, isInTurn } = thread.actions;
  const act = actWith(setActionError);
  return (
    <View style={local.page}>
      <View style={styles.header}>
        <Text numberOfLines={1} style={[local.title, styles.flex]}>
          Iskios
        </Text>
        <StateIndicator state={thread.state} />
        <Pressable
          accessibilityLabel={isFull ? "Restore Iskios" : "Expand Iskios"}
          accessibilityRole="button"
          onPress={onToggleFull}
        >
          <Text style={local.link}>{isFull ? "⤡" : "⤢"}</Text>
        </Pressable>
        {onFold !== null && (
          <Pressable accessibilityLabel="Fold Iskios" accessibilityRole="button" onPress={onFold}>
            <Text style={local.link}>✕</Text>
          </Pressable>
        )}
        {canStop && (
          <Pressable onPress={() => act(client.request({ _tag: "StopThread", threadId: thread.id }))}>
            <Text style={local.link}>Stop</Text>
          </Pressable>
        )}
        {canResume && (
          <Pressable onPress={() => act(client.request({ _tag: "ResumeThread", threadId: thread.id }))}>
            <Text style={local.link}>Resume</Text>
          </Pressable>
        )}
      </View>
      {detail.budgetStop !== null && (
        <BudgetStopCard client={client} onRaise={() => setIsBudgetOpen(true)} stop={detail.budgetStop} />
      )}
      {actionError !== null && <Text style={styles.error}>{actionError}</Text>}
      {thread.failure != null && (
        <View style={styles.failure}>
          <Text style={styles.error}>The last turn failed: {thread.failure}</Text>
          <Text style={styles.muted}>Your next message retries it.</Text>
        </View>
      )}
      <Text numberOfLines={1} style={local.sub}>
        {harnessLabels[thread.harness]} · {companionLabelOf(thread.harness, null, thread.model)}
      </Text>
      {entries.length === 0 && draft === "" && terminal.panel === null ? (
        <View style={local.empty}>
          <Text style={local.emptyTitle}>Tell Iskios what you need.</Text>
          <Text style={local.emptyText}>
            It looks for a quest that already covers it and offers to continue that one, or proposes a new quest for you
            to open.
          </Text>
        </View>
      ) : (
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
              onSelectThread={() => {}}
              skills={skills}
              workspacePath={realm?.path ?? null}
            />
          )}
          style={styles.flex}
        />
      )}
      {realm !== null && <RealmNote name={realm.name} onClear={() => onRealm(null)} />}
      <Composer
        draftKey="iskios"
        hasContent={terminal.hasContent}
        {...(terminal.onBang === null ? {} : { onBang: terminal.onBang })}
        accessory={
          isInTurn ? undefined : (
            <RunnerPickers
              client={client}
              dockRank={1}
              extra={<ThreadBackups client={client} key={thread.id} threadId={thread.id} />}
              harnesses={harnesses}
              isCompact={true}
              isIskios={true}
              onChange={(next) => act(client.request({ _tag: "ChangeThreadRunner", ...next, threadId: thread.id }))}
              presetChoice={presetChoice}
              value={{
                accountId: thread.accountId,
                effort: thread.effort,
                harness: thread.harness,
                model: thread.model,
              }}
            />
          )
        }
        attachments={{ client, refusal: imageRefusalOf(harnesses, thread.harness, thread.model) }}
        mentions={{ client, workspacePath: realm?.path ?? null }}
        onSend={send}
        placeholder={isInTurn ? "Iskios is working; Send joins its turn…" : "Ask Iskios for anything…"}
        skills={skills}
        {...(isInTurn ? { onInterrupt: () => client.request({ _tag: "InterruptThread", threadId: thread.id }) } : {})}
      />
    </View>
  );
}

/**
 * The message at the foot of a realm's page: it goes to the Guildmaster with the realm attached, and the screen then
 * shows the Guildmaster's conversation. No quest starts from here directly.
 */
export function GuildmasterHandoff({
  client,
  onSent,
  realm,
}: {
  client: ServiceClient;
  /** Goes to the Guildmaster once the message is sent. */
  onSent: () => void;
  realm: { readonly name: string; readonly path: string };
}) {
  const { data: harnesses } = useHarnesses(client);
  const skills = useSkills(client, realm.path);
  return (
    <View style={local.handoff}>
      <Text style={styles.muted}>
        Goes to Iskios, who proposes a quest in <Text style={styles.code}>{realm.name}</Text> unless one already fits.
      </Text>
      <Composer
        attachments={{ client, refusal: imageRefusalOf(harnesses, "claude", "default") }}
        draftKey={`handoff:${realm.path}`}
        mentions={{ client, workspacePath: realm.path }}
        onSend={async (text, attachmentIds) => {
          const place = await client.request({ _tag: "ReadGuildmaster" });
          await client.request({
            _tag: "SendMessage",
            attachmentIds,
            delivery: null,
            realmPath: realm.path,
            requestId: newRequestId(),
            text,
            threadId: place.threadId,
          });
          onSent();
        }}
        placeholder={`Ask Iskios for something in ${realm.name}…`}
        skills={skills}
      />
    </View>
  );
}

const local = StyleSheet.create({
  empty: { alignItems: "center", flex: 1, gap: 8, justifyContent: "center", paddingHorizontal: 24 },
  emptyText: {
    color: colors.textMuted,
    fontFamily: fonts.sans,
    fontSize: fontSizes.md,
    maxWidth: 520,
    textAlign: "center",
  },
  emptyTitle: { color: colors.onGround, fontFamily: fonts.sans, fontSize: fontSizes.lg, fontWeight: "700" },
  handoff: { gap: 6 },
  hubPage: { backgroundColor: colors.page, flex: 1 },
  link: { color: colors.highlight, fontFamily: fonts.sans, fontSize: fontSizes.md },
  note: { alignItems: "center", flexDirection: "row", gap: 8 },
  noteClear: { color: colors.highlight, fontFamily: fonts.sans, fontSize: fontSizes.lg, paddingHorizontal: 4 },
  noteName: { color: colors.highlight, fontFamily: fonts.sans, fontWeight: "700" },
  noteText: { color: colors.onGround, fontFamily: fonts.sans, fontSize: fontSizes.md },
  page: { backgroundColor: colors.page, flex: 1, gap: 8, paddingBottom: 14, paddingHorizontal: 16, paddingTop: 12 },
  sub: { color: colors.onGround, fontFamily: fonts.sans, fontSize: fontSizes.md, opacity: 0.8 },
  title: { color: colors.onGround, fontFamily: fonts.sans, fontSize: fontSizes.lg, fontWeight: "700" },
});
