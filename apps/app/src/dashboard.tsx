import { type MissionId, startingModel, type WorkspaceChoice, type WorkspaceId } from "@gild/contracts";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { MissionBoard, MissionCard } from "./board";
import { BudgetMeters, BudgetScreen, BudgetStopCard } from "./budgets";
import { newRequestId, type ServiceClient } from "./client";
import { Composer } from "./controls";
import { CrestStudio } from "./crestStudio";
import { JournalScreen } from "./journal";
import { LoreScreen } from "./lore";
import { MissionPromptCard } from "./missionActions";
import { allMissions } from "./queries";
import { QuestionCard } from "./questions";
import { QuestOverview, QuestPreview, RealmPanel } from "./questPanel";
import { RitualForm } from "./rituals";
import { type Runner, RunnerPickers, useHarnesses } from "./runners";
import { useHasSidebar, useQuestPanel } from "./sidebar";
import { styles } from "./styles";
import { colors, fonts } from "./theme";
import { useServiceQuery } from "./useServiceQuery";
import { useSkills } from "./useSkills";
import { RealmChooser } from "./workspaces";

/** The panel width from which the board's columns stand side by side. */
const boardBreakpoint = 560;

/**
 * Starts a mission with one message, prefilled from the last mission's choices (mission-tracking). On a workspace's
 * board the mission starts in that workspace, and the workspace cannot be changed there.
 */
export function MissionStarter({
  client,
  onOpen,
  stage = false,
  workspace: lockedWorkspace,
}: {
  client: ServiceClient;
  onOpen: (id: MissionId) => void;
  /** The Guildmaster's layout: the realm tiles large in the middle of the screen, the message at the foot. */
  stage?: boolean;
  /** The workspace whose board shows, or null on the board of every mission. */
  workspace: WorkspaceChoice | null;
}) {
  const { data: last } = useServiceQuery(client, { _tag: "ReadStartChoices" }, "start-choices");
  const { data: harnesses } = useHarnesses(client);
  // The realms that exist, to choose from under the message.
  const { data: known } = useServiceQuery(client, allMissions.request, allMissions.key);
  // Null until the owner picks; the last mission's runner applies until then.
  const [runner, setRunner] = useState<Runner | null>(null);
  // Null until the owner picks a realm; a quest starts with none until then.
  const [workspace, setWorkspace] = useState<{ readonly path: string | null } | null>(null);
  const chosen: Runner =
    runner ??
    (last === null
      ? { accountId: null, effort: "default", harness: "claude", model: startingModel }
      : { accountId: last.accountId, effort: last.effort, harness: last.harness, model: last.model });
  const chosenWorkspace =
    lockedWorkspace !== null
      ? lockedWorkspace.path
      : // No realm until the owner picks one, whatever the last quest used.
        (workspace?.path ?? null);
  const skills = useSkills(client, chosenWorkspace);
  const chooser =
    lockedWorkspace === null ? (
      <RealmChooser
        isBig={stage}
        missions={known?.missions ?? []}
        onChange={(path) => setWorkspace({ path })}
        onCreate={(realm) =>
          client
            .request({ _tag: "CreateRealm", crest: realm.crest, name: realm.name, path: realm.path })
            .then(() => setWorkspace({ path: realm.path }))
        }
        realms={known?.workspaces ?? []}
        value={chosenWorkspace}
      />
    ) : (
      <Text style={styles.muted}>
        Starts in <Text style={styles.code}>{lockedWorkspace.name}</Text>.
      </Text>
    );
  return (
    // Above the list below it, so a picker's open list covers the search and the filters.
    <View style={[styles.section, styles.raised, stage && local.stage]}>
      {stage && <View style={local.stageCenter}>{chooser}</View>}
      <Composer
        accessory={<RunnerPickers harnesses={harnesses} isCompact={true} onChange={setRunner} value={chosen} />}
        onSend={async (text) =>
          onOpen(
            (
              await client.request({
                _tag: "StartMission",
                accountId: chosen.accountId,
                effort: chosen.effort,
                harness: chosen.harness,
                model: chosen.model,
                requestId: newRequestId(),
                text,
                workspacePath: chosenWorkspace,
              })
            ).missionId,
          )
        }
        placeholder="Start a quest with one message…"
        skills={skills}
      />
      {!stage && chooser}
    </View>
  );
}

/**
 * The missions as a board by what needs the owner, with a workspace breadcrumb and search: the dashboard; or, for
 * the Archived view, the archived missions as cards.
 */
export function Dashboard({
  client,
  isArchived,
  onArchived,
  onBack,
  onOpen,
  onSelect,
  onSettings,
  onLore,
  selectedId,
  workspaceId: chosenWorkspaceId,
}: {
  client: ServiceClient;
  isArchived: boolean;
  onArchived: () => void;
  onBack: () => void;
  onOpen: (id: MissionId) => void;
  /** Selects a quest for the panel beside the board, where the window has one; null goes back to the overview. */
  onSelect: (id: MissionId | null) => void;
  /** The quest the panel beside the board shows, or null. */
  selectedId: MissionId | null;
  onSettings: () => void;
  /** Opens the lore panel with all lore. */
  onLore: () => void;
  /** The workspace whose missions show, or null for every mission. */
  workspaceId: WorkspaceId | null;
}) {
  const hasSidebar = useHasSidebar();
  const [search, setSearch] = useState("");
  const [width, setWidth] = useState(0);
  // The Archived view keeps every workspace; the board shows the one chosen in the sidebar or the breadcrumb.
  const workspaceId = isArchived ? null : chosenWorkspaceId;
  const [isGlobalBudgetOpen, setIsGlobalBudgetOpen] = useState(false);
  // Whether the form that makes a Ritual is open above the board.
  const [isRitualOpen, setIsRitualOpen] = useState(false);
  // What a quest's panel opened in this screen's place: its budget or its journal. It belongs to that quest, so
  // choosing another quest closes it.
  const [preview, setPreview] = useState<{ missionId: MissionId; screen: "Budget" | "Journal" } | null>(null);
  const previewScreen = preview !== null && preview.missionId === selectedId ? preview.screen : null;
  const { data: global } = useServiceQuery(client, { _tag: "ReadBudget", missionId: null }, "budget:global");
  const request = { _tag: "ListMissions", isArchived, search, state: null, workspaceId } as const;
  const { data, error } = useServiceQuery(client, request, `missions:${JSON.stringify(request)}`);
  const { data: settings } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  const { data: questions } = useServiceQuery(client, { _tag: "ListOpenQuestions" }, "open-questions");
  // The questions cover every mission on the dashboard, whatever the filters show.
  const { data: all } = useServiceQuery(client, allMissions.request, allMissions.key);
  const asking = isArchived ? [] : (all?.missions.filter((mission) => mission.prompt !== null) ?? []);
  const workspaceNames = new Map((data?.workspaces ?? []).map((w) => [w.id, w.name]));
  // The realm whose board shows, and whether its crest studio is open.
  const realm = (data?.workspaces ?? []).find((w) => w.id === workspaceId) ?? null;
  // The realm whose crest studio or lore is open; showing another realm closes them.
  // The realm's figures count all its quests, whatever the search shows.
  const realmMissions = (all?.missions ?? []).filter((mission) => mission.workspaceId === realm?.id);
  const [designingId, setDesigningId] = useState<WorkspaceId | null>(null);
  const [loreId, setLoreId] = useState<WorkspaceId | null>(null);
  const isDesigning = realm !== null && designingId === realm.id;
  const isRealmLoreOpen = realm !== null && loreId === realm.id;
  // With a sidebar a card only selects its quest, and the panel beside the board shows it; without one it opens it.
  // Pressing the quest already chosen puts it back.
  const press = (id: MissionId) => (hasSidebar ? onSelect(id === selectedId ? null : id) : onOpen(id));
  const selected = data?.missions.find((mission) => mission.id === selectedId) ?? null;
  // The panel goes to the window's frame; it leaves with this screen, like the quest screen's own.
  const panel =
    selectedId !== null ? (
      <QuestPreview
        client={client}
        missionId={selectedId}
        onBack={() => onSelect(null)}
        onOpenBudget={() => setPreview({ missionId: selectedId, screen: "Budget" })}
        onOpenJournal={() => setPreview({ missionId: selectedId, screen: "Journal" })}
        onOpenQuest={() => onOpen(selectedId)}
      />
    ) : isArchived ? null : realm !== null ? (
      <RealmPanel
        key={realm.id}
        missions={realmMissions}
        onCustomize={() => setDesigningId(realm.id)}
        onOpenLore={() => setLoreId(realm.id)}
        onRename={(name) => client.request({ _tag: "RenameRealm", name, workspaceId: realm.id })}
        onSelect={onSelect}
        realm={realm}
      />
    ) : (
      <QuestOverview
        missions={data?.missions ?? []}
        onSelect={onSelect}
        realm={workspaceId === null ? null : (workspaceNames.get(workspaceId) ?? null)}
      />
    );
  useQuestPanel(hasSidebar && panel);
  if (selectedId !== null && previewScreen === "Budget") {
    return (
      <BudgetScreen
        client={client}
        missionId={selectedId}
        onBack={() => setPreview(null)}
        title={`Budget · ${selected?.title ?? ""}`}
      />
    );
  }
  if (selectedId !== null && previewScreen === "Journal") {
    return (
      <JournalScreen
        client={client}
        missionId={selectedId}
        onBack={() => setPreview(null)}
        title={selected?.title ?? ""}
      />
    );
  }
  if (isRealmLoreOpen && realm !== null) {
    return (
      <LoreScreen
        client={client}
        onBack={() => setLoreId(null)}
        threadId={null}
        title={`Lore · ${realm.name}`}
        workspaceId={realm.id}
      />
    );
  }
  if (isGlobalBudgetOpen) {
    return (
      <BudgetScreen
        client={client}
        missionId={null}
        onBack={() => setIsGlobalBudgetOpen(false)}
        title="Global budget"
      />
    );
  }
  return (
    <View style={local.scroll}>
      {isDesigning && realm !== null && (
        <CrestStudio
          id={realm.id}
          initial={realm.crest}
          name={realm.name}
          onCancel={() => setDesigningId(null)}
          onDone={(crest) =>
            client.request({ _tag: "SetRealmCrest", crest, workspaceId: realm.id }).then(() => setDesigningId(null))
          }
        />
      )}
      <ScrollView
        contentContainerStyle={local.content}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={styles.flex}
      >
        <View style={styles.header}>
          {isArchived && !hasSidebar && (
            <Pressable onPress={onBack}>
              <Text style={[styles.link, { color: colors.goldHi }]}>← Quests</Text>
            </Pressable>
          )}
          {/* The title is in the top bar and the panel, so the header only holds what sits at its right. */}
          <View style={styles.flex} />
          {!isArchived && (
            <Pressable accessibilityRole="button" onPress={() => setIsRitualOpen(true)}>
              <Text style={[styles.link, { color: colors.goldHi }]}>+ Ritual</Text>
            </Pressable>
          )}
          {global !== null && <BudgetMeters onPress={() => setIsGlobalBudgetOpen(true)} use={global} />}
          {!isArchived && !hasSidebar && (
            <Pressable onPress={onArchived}>
              <Text style={[styles.link, { color: colors.goldHi }]}>Archived</Text>
            </Pressable>
          )}
          {!isArchived && !hasSidebar && (
            <Pressable onPress={onLore}>
              <Text style={[styles.link, { color: colors.goldHi }]}>Lore</Text>
            </Pressable>
          )}
          {!hasSidebar && (
            <Pressable onPress={onSettings}>
              <Text style={[styles.link, { color: colors.goldHi }]}>Workshop</Text>
            </Pressable>
          )}
        </View>
        {!isArchived && isRitualOpen && (
          <RitualForm
            client={client}
            onCancel={() => setIsRitualOpen(false)}
            onDone={(missionId) => {
              setIsRitualOpen(false);
              press(missionId);
            }}
            ritual={null}
          />
        )}
        {!isArchived && global?.stop != null && (
          <BudgetStopCard client={client} onRaise={() => setIsGlobalBudgetOpen(true)} stop={global.stop} />
        )}
        {!isArchived && questions !== null && questions.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.onWood }]}>Waiting for your answer</Text>
            {questions.map((question) => (
              <QuestionCard
                client={client}
                key={question.id}
                onOpenMission={() => onOpen(question.missionId)}
                question={question}
              />
            ))}
          </View>
        )}
        {asking.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.onWood }]}>Quests to settle</Text>
            {asking.map((mission) => (
              <MissionPromptCard
                client={client}
                inactivityDays={settings?.inactivityDays ?? 14}
                key={`${mission.id}:${mission.prompt}`}
                mission={mission}
                onOpen={() => onOpen(mission.id)}
              />
            ))}
          </View>
        )}
        <TextInput
          accessibilityLabel="Search quests"
          onChangeText={setSearch}
          placeholder="Search titles and briefings"
          placeholderTextColor={colors.placeholder}
          style={styles.input}
          value={search}
        />
        {error !== null && (
          <Text style={[styles.error, { backgroundColor: colors.dangerSoft, padding: 8 }]}>{error}</Text>
        )}
        {data !== null &&
          (isArchived ? (
            data.missions.length === 0 ? (
              <Text style={[styles.muted, { color: colors.onWood }]}>No archived quests.</Text>
            ) : (
              <View style={local.archive}>
                {data.missions.map((mission) => (
                  <View key={mission.id} style={local.archiveCard}>
                    <MissionCard
                      client={client}
                      column={null}
                      isSelected={mission.id === selectedId}
                      mission={mission}
                      onOpen={() => press(mission.id)}
                      onOpenQuest={() => onOpen(mission.id)}
                    />
                  </View>
                ))}
              </View>
            )
          ) : (
            <MissionBoard
              client={client}
              isFiltered={search.trim() !== ""}
              isWide={width >= boardBreakpoint}
              missions={data.missions}
              onOpen={(mission) => press(mission.id)}
              onOpenQuest={(mission) => onOpen(mission.id)}
              selectedId={selectedId}
            />
          ))}
      </ScrollView>
      {!isArchived && realm !== null && (
        // On a realm's board the message at the foot starts a quest in that realm. The board of every quest has none:
        // the Guildmaster is where quests start.
        <View style={local.footer}>
          <MissionStarter client={client} onOpen={onOpen} workspace={realm} />
        </View>
      )}
    </View>
  );
}

const local = StyleSheet.create({
  archive: { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: 16 },
  archiveCard: { maxWidth: "100%", width: 360 },
  content: { gap: 14, paddingHorizontal: 28, paddingVertical: 20 },
  crumb: { alignItems: "center", flexDirection: "row", gap: 2, zIndex: 3 },
  footer: { paddingBottom: 18, paddingHorizontal: 28, paddingTop: 6, zIndex: 2 },
  scroll: { backgroundColor: colors.wood, flex: 1 },
  stage: { flex: 1, gap: 0, justifyContent: "flex-end" },
  stageCenter: { alignItems: "center", flex: 1, justifyContent: "center", paddingBottom: 40 },
  title: {
    color: colors.onWood,
    fontFamily: fonts.hand,
    fontSize: 46,
    fontWeight: "700",
    letterSpacing: 2,
    lineHeight: 56,
    marginTop: 4,
    textShadowColor: "#000",
    textShadowOffset: { height: 2, width: 0 },
    textShadowRadius: 6,
    textTransform: "uppercase",
  },
});
