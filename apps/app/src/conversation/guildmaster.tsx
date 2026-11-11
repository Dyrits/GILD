import type { AttachmentId, GuildmasterPlace, MissionId } from "@iskios/contracts";
import { useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { imageRefusalOf } from "../attachments/attachmentRules";
import { BudgetScreen, BudgetStopCard } from "../editors/budgets";
import { RunnerPickers, useHarnesses } from "../editors/runners";
import { messageOf, newRequestId, type ServiceClient } from "../foundation/client";
import { companionLabelOf, harnessLabels } from "../foundation/formatting";
import { allMissions } from "../foundation/queries";
import { useQuestPanel } from "../foundation/shellContext";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { useSkills } from "../foundation/useSkills";
import { budgetValueOf } from "../quests/questPanel";
import { RealmChooser } from "../realms/workspaces";
import { useTerminal } from "../terminal/useTerminal";
import { Composer, StateBadge } from "../ui/controls";
import { useDraft, useFollowNewest } from "./conversation";
import { AgentReply, EntryView, WorkingIndicator } from "./conversationEntries";
import { type Entry, entriesOf, workingLabelOf } from "./entries";

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
 * The Guildmaster: one permanent conversation that takes any request, looks for a quest that already fits, offers to
 * continue it or opens a new one, and shows each action as a card (quest coordination). The realms stand in the side
 * panel; choosing one fixes where the next message's quest opens.
 */
export function GuildmasterScreen(props: {
  client: ServiceClient;
  onOpenMission: (id: MissionId) => void;
  /** Chooses the realm of the next message, or none. */
  onRealm: (path: string | null) => void;
  /** The folder of the realm chosen for the next message, or null. */
  realmPath: string | null;
}) {
  const { data: place, error } = useServiceQuery(props.client, { _tag: "ReadGuildmaster" }, "guildmaster");
  if (place === null)
    return (
      <View style={local.page}>
        <Text style={styles.muted}>{error ?? "Calling the Guildmaster…"}</Text>
      </View>
    );
  return <GuildmasterChat {...props} place={place} />;
}

function GuildmasterChat({
  client,
  onOpenMission,
  onRealm,
  place,
  realmPath,
}: {
  client: ServiceClient;
  onOpenMission: (id: MissionId) => void;
  onRealm: (path: string | null) => void;
  place: GuildmasterPlace;
  realmPath: string | null;
}) {
  const { data: known } = useServiceQuery(client, allMissions.request, allMissions.key);
  const { data: harnesses } = useHarnesses(client);
  const realms = known?.workspaces ?? [];
  const realm = realms.find((candidate) => candidate.path === realmPath) ?? null;
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
  // The Guildmaster can have a budget of its own, set on its own screen like a quest's (budget-control).
  const [isBudgetOpen, setIsBudgetOpen] = useState(false);
  useQuestPanel(
    <ScrollView contentContainerStyle={local.panel}>
      <RealmChooser
        isBig
        missions={known?.missions ?? []}
        onChange={onRealm}
        onCreate={(created) =>
          client
            .request({ _tag: "CreateRealm", crest: created.crest, name: created.name, path: created.path })
            .then(() => onRealm(created.path))
        }
        realms={realms}
        value={realmPath}
      />
    </ScrollView>,
    "Realms",
  );
  if (detail === null) {
    return (
      <View style={local.page}>
        <Text style={styles.muted}>Calling the Guildmaster…</Text>
      </View>
    );
  }
  if (isBudgetOpen) {
    return (
      <BudgetScreen
        client={client}
        missionId={place.missionId}
        onBack={() => setIsBudgetOpen(false)}
        title="Budget · Guildmaster"
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
    });
    terminal.sent();
  };
  const { canResume, canStop, isInTurn } = thread.actions;
  const act = (request: Promise<unknown>) =>
    request.then(
      () => setActionError(null),
      (reason) => setActionError(messageOf(reason)),
    );
  return (
    <View style={local.page}>
      <View style={styles.header}>
        <Text numberOfLines={1} style={[local.title, styles.flex]}>
          Guildmaster
        </Text>
        <Pressable accessibilityRole="button" onPress={() => setIsBudgetOpen(true)}>
          <Text style={local.link}>Budget · {budgetValueOf(detail.mission.budget)}</Text>
        </Pressable>
        <StateBadge state={thread.state} />
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
          <Text style={local.emptyTitle}>Tell the Guildmaster what you need.</Text>
          <Text style={local.emptyText}>
            It looks for a quest that already covers it and offers to continue that one, or opens a new quest. Choose a
            realm on the right to start the next quest there.
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
        hasContent={terminal.hasContent}
        {...(terminal.onBang === null ? {} : { onBang: terminal.onBang })}
        accessory={
          isInTurn ? undefined : (
            <RunnerPickers
              client={client}
              harnesses={harnesses}
              isCompact={true}
              onChange={(next) => act(client.request({ _tag: "ChangeThreadRunner", ...next, threadId: thread.id }))}
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
        placeholder={
          isInTurn ? "The Guildmaster is working; Send joins its turn…" : "Ask for anything: it finds or opens a quest…"
        }
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
        Goes to the Guildmaster, who opens the quest in <Text style={styles.code}>{realm.name}</Text> unless one already
        fits.
      </Text>
      <Composer
        attachments={{ client, refusal: imageRefusalOf(harnesses, "claude", "default") }}
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
        placeholder={`Ask the Guildmaster for something in ${realm.name}…`}
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
  link: { color: colors.highlight, fontFamily: fonts.sans, fontSize: fontSizes.md },
  note: { alignItems: "center", flexDirection: "row", gap: 8 },
  noteClear: { color: colors.highlight, fontFamily: fonts.sans, fontSize: fontSizes.lg, paddingHorizontal: 4 },
  noteName: { color: colors.highlight, fontFamily: fonts.sans, fontWeight: "700" },
  noteText: { color: colors.onGround, fontFamily: fonts.sans, fontSize: fontSizes.md },
  page: { backgroundColor: colors.page, flex: 1, gap: 8, paddingBottom: 18, paddingHorizontal: 28, paddingTop: 20 },
  panel: { gap: 12, padding: 16 },
  sub: { color: colors.onGround, fontFamily: fonts.sans, fontSize: fontSizes.md, opacity: 0.8 },
  title: { color: colors.onGround, fontFamily: fonts.sans, fontSize: fontSizes.lg, fontWeight: "700" },
});
