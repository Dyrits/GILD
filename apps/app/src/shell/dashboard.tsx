import type { MissionId, WorkspaceId } from "@iskios/contracts";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { GuildmasterHandoff } from "../conversation/guildmaster";
import { CrestStudio } from "../crest/crestStudio";
import { BudgetMeters, BudgetScreen, BudgetStopCard } from "../editors/budgets";
import type { ServiceClient } from "../foundation/client";
import { allMissions } from "../foundation/queries";
import { useHasSidebar, useQuestPanel } from "../foundation/shellContext";
import { styles } from "../foundation/styles";
import { colors, fonts } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { JournalScreen } from "../lore/journal";
import { LoreScreen } from "../lore/lore";
import { MissionBoard, MissionCard } from "../quests/board";
import { MissionPromptCard } from "../quests/missionActions";
import { QuestPreview, RealmPanel } from "../quests/questPanel";
import { QuestionCard } from "../ui/questions";

/** The panel width from which the board's columns stand side by side. */
const boardBreakpoint = 560;

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
  onSendToGuildmaster,
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
  /** Goes to the Guildmaster after a message from a realm's page, with that realm's folder chosen there. */
  onSendToGuildmaster: (realmPath: string) => void;
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
  // The realm whose board shows, and whether its crest studio is open.
  const realm = (data?.workspaces ?? []).find((w) => w.id === workspaceId) ?? null;
  // Iskios places a quest by its realm's folder, so a realm tied to no folder offers no message to it yet (CHG-0161).
  const handoffRealm = realm?.path == null ? null : { name: realm.name, path: realm.path };
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
    ) : isArchived || realm === null ? null : (
      <RealmPanel
        client={client}
        key={realm.id}
        missions={realmMissions}
        onCustomize={() => setDesigningId(realm.id)}
        onOpenLore={() => setLoreId(realm.id)}
        onSelect={onSelect}
        realm={realm}
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
              <Text style={[styles.link, { color: colors.highlight }]}>← Back</Text>
            </Pressable>
          )}
          {/* The title is in the top bar and the panel, so the header only holds what sits at its right. */}
          <View style={styles.flex} />
          {global !== null && <BudgetMeters onPress={() => setIsGlobalBudgetOpen(true)} use={global} />}
          {!isArchived && !hasSidebar && (
            <Pressable onPress={onArchived}>
              <Text style={[styles.link, { color: colors.highlight }]}>Archived</Text>
            </Pressable>
          )}
          {!isArchived && !hasSidebar && (
            <Pressable onPress={onLore}>
              <Text style={[styles.link, { color: colors.highlight }]}>Lore</Text>
            </Pressable>
          )}
          {!hasSidebar && (
            <Pressable onPress={onSettings}>
              <Text style={[styles.link, { color: colors.highlight }]}>Workshop</Text>
            </Pressable>
          )}
        </View>
        {!isArchived && global?.stop != null && (
          <BudgetStopCard client={client} onRaise={() => setIsGlobalBudgetOpen(true)} stop={global.stop} />
        )}
        {!isArchived && questions !== null && questions.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.onGround }]}>Waiting for your answer</Text>
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
            <Text style={[styles.label, { color: colors.onGround }]}>Quests to settle</Text>
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
              <Text style={[styles.muted, { color: colors.onGround }]}>No archived quests.</Text>
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
      {!isArchived && handoffRealm !== null && (
        // On a realm's board the message at the foot goes to the Guildmaster with the realm attached, and no quest starts
        // from here. The board of every quest has none: Iskios is where quests are proposed.
        <View style={local.footer}>
          <GuildmasterHandoff
            client={client}
            onSent={() => onSendToGuildmaster(handoffRealm.path)}
            realm={handoffRealm}
          />
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
  scroll: { backgroundColor: colors.page, flex: 1 },
  stage: { flex: 1, gap: 0, justifyContent: "flex-end" },
  stageCenter: { alignItems: "center", flex: 1, justifyContent: "center", paddingBottom: 40 },
  title: {
    color: colors.onGround,
    fontFamily: fonts.sans,
    fontSize: 46,
    fontWeight: "700",
    lineHeight: 56,
    marginTop: 4,
    textShadowColor: colors.shadow,
    textShadowOffset: { height: 2, width: 0 },
    textShadowRadius: 6,
  },
});
