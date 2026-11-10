import type { MissionDetail, MissionId, MissionSummary, WorkspaceChoice } from "@gild/contracts";
import { type ReactNode, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { boardOf, columnOf } from "./boardColumns";
import { BudgetMeters } from "./budgets";
import type { ServiceClient } from "./client";
import { CrestBadge } from "./crest";
import { Emblem } from "./emblems";
import { timeOf, usageDetail } from "./formatting";
import { threadCountOf, tokenCountOf } from "./labels";
import { MissionEndingActions, MissionTitle } from "./missionActions";
import { ParchmentFrame } from "./parchment";
import { RitualControls } from "./rituals";
import { styles } from "./styles";
import { colors, fontSizes, fonts, ink, radii, stateLabels, stateTones } from "./theme";
import { useServiceQuery } from "./useServiceQuery";

const bookmarkByColumn = { Attention: "red", Done: "green", Idle: "violet", Running: "blue" } as const;

/** The bookmark cloth of a state: the color of its column's banner. */
const bookmarkOf = (state: MissionDetail["mission"]["state"]) => bookmarkByColumn[columnOf(state)];

/** A labelled group of rows in the card, as in the quest's side panel. */
export function Group({ children, label }: { children: ReactNode; label: string }) {
  return (
    <View style={local.group}>
      <Text style={local.groupLabel}>{label}</Text>
      <View style={local.card}>{children}</View>
    </View>
  );
}

/** One row of a group: its name, a short value, and a chevron when pressing it opens something. */
export function Row({ onPress, label, value }: { label: string; onPress?: () => void; value?: string }) {
  const content = (
    <>
      <Text style={local.rowLabel}>{label}</Text>
      {value !== undefined && (
        <Text numberOfLines={1} style={local.rowValue}>
          {value}
        </Text>
      )}
      {onPress !== undefined && <Text style={local.chevron}>›</Text>}
    </>
  );
  return onPress === undefined ? (
    <View style={local.row}>{content}</View>
  ) : (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [local.row, pressed && local.pressed]}
    >
      {content}
    </Pressable>
  );
}

/** What a quest's budget shows as a row value: what is spent against the limit, or that there is none. */
export const budgetValueOf = (budget: MissionDetail["mission"]["budget"]) => {
  const { limits, spent } = budget;
  if (limits.tokens !== null) return `${tokenCountOf(spent.tokens)} of ${tokenCountOf(limits.tokens)} tokens`;
  if (limits.cost !== null) return `$${spent.cost.toFixed(2)} of $${limits.cost.toFixed(2)}`;
  return "No limit";
};

type PanelTab = "Knows" | "Spends";

/** The panel's tabs: the name in small capitals, the open one underlined in red; a tab may carry a figure in green. */
function Tabs({
  figures,
  onChange,
  value,
}: {
  figures: Partial<Record<PanelTab, string>>;
  onChange: (tab: PanelTab) => void;
  value: PanelTab;
}) {
  return (
    <View accessibilityRole="tablist" style={local.tabs}>
      {(["Knows", "Spends"] as const).map((tab) => (
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === value }}
          key={tab}
          onPress={() => onChange(tab)}
          style={[local.tab, tab === value && local.tabActive]}
        >
          <Text style={[local.tabText, tab === value && local.tabTextActive]}>
            {tab}
            {figures[tab] !== undefined && <Text style={local.tabFigure}> {figures[tab]}</Text>}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * The quest's right side panel, under the header the window's frame gives it: a parchment in a gilt frame with a red
 * bookmark, the quest's emblem and name (press to rename), how it stands, then Knows (its journal), Spends (its
 * budget and usage), and the framed question of how it ends.
 * It leaves the thread's own conversation alone.
 */
export function QuestSidebar({
  client,
  mission,
  onOpenBudget,
  onOpenJournal,
  onBack,
  onOpenQuest,
}: {
  client: ServiceClient;
  mission: MissionDetail["mission"];
  /** Given where the panel previews a quest from the board: returns to the board's overview. */
  onBack?: () => void;
  onOpenBudget: () => void;
  onOpenJournal: () => void;
  /** Given where the panel previews a quest from the board: opens the quest's conversation, under the brief. */
  onOpenQuest?: () => void;
}) {
  const { usage } = mission;
  const [tab, setTab] = useState<PanelTab>("Knows");
  const tone = stateTones[mission.state];
  const cost = mission.budget.spent.cost;
  return (
    <View style={local.panel}>
      <ScrollView contentContainerStyle={local.content} style={styles.flex}>
        <View style={local.hero}>
          {onBack === undefined ? (
            <Text style={local.kicker}>Quest</Text>
          ) : (
            <Pressable accessibilityRole="button" onPress={onBack}>
              <Text style={local.kicker}>‹ The council</Text>
            </Pressable>
          )}
          <View style={local.heroRow}>
            <CrestBadge
              crest={mission.workspaceCrest}
              id={mission.workspaceId ?? mission.id}
              isLoose={mission.workspaceId === null}
              size={56}
            />
            <MissionTitle client={client} key={mission.title} mission={mission} textStyle={local.heroName} />
          </View>
          <Text numberOfLines={2} style={local.meta}>
            <Text style={[local.metaState, { color: tone.color }]}>{stateLabels[mission.state]}</Text>
            {[mission.workspaceName, threadCountOf(mission)]
              .filter((part) => part !== null)
              .map((part) => ` · ${part}`)
              .join("")}
          </Text>
        </View>
        {mission.ritual !== null && <RitualControls client={client} missionId={mission.id} />}
        <Tabs figures={cost > 0 ? { Spends: `$${cost.toFixed(2)}` } : {}} onChange={setTab} value={tab} />
        {tab === "Knows" ? (
          <Pressable accessibilityRole="button" onPress={onOpenJournal} style={local.note}>
            <Emblem name="quill" size={30} tint={colors.accentText} />
            <Text style={local.noteText}>Open the journal: where this quest stands and what it has learned.</Text>
            <Text style={local.chevron}>›</Text>
          </Pressable>
        ) : (
          <View style={local.spends}>
            <Group label="So far">
              <Row label="Budget" onPress={onOpenBudget} value={budgetValueOf(mission.budget)} />
              <Row
                label="Usage"
                value={`${tokenCountOf(usage.input + usage.cacheRead + usage.cacheCreation + usage.output)} tokens`}
              />
            </Group>
            <BudgetMeters onPress={onOpenBudget} use={mission.budget} />
            <Text style={styles.muted}>{usageDetail(usage)}</Text>
          </View>
        )}
        {onOpenQuest !== undefined && (
          <Pressable
            accessibilityRole="button"
            onPress={onOpenQuest}
            style={({ pressed }) => [local.open, pressed && local.openPressed]}
          >
            <Text style={local.openText}>Open quest</Text>
          </Pressable>
        )}
        <View style={local.does}>
          <Text style={local.doesHeading}>Does</Text>
          <MissionEndingActions client={client} isButtons={true} mission={mission} />
        </View>
      </ScrollView>
      <ParchmentFrame bookmark={bookmarkOf(mission.state)} />
    </View>
  );
}

/**
 * The panel for a quest picked on the board: it loads the quest itself and offers to open it, since the board's card
 * only selects it.
 */
export function QuestPreview({
  client,
  missionId,
  onBack,
  onOpenBudget,
  onOpenJournal,
  onOpenQuest,
}: {
  client: ServiceClient;
  missionId: MissionId;
  onBack: () => void;
  onOpenBudget: () => void;
  onOpenJournal: () => void;
  onOpenQuest: () => void;
}) {
  const { data } = useServiceQuery(client, { _tag: "ReadMission", missionId, threadId: null }, `${missionId}:top`);
  if (data === null || data.mission.id !== missionId) return <View style={local.panel} />;
  return (
    <QuestSidebar
      client={client}
      mission={data.mission}
      onBack={onBack}
      onOpenBudget={onOpenBudget}
      onOpenJournal={onOpenJournal}
      onOpenQuest={onOpenQuest}
    />
  );
}

/** The compass the council panel shows while no quest is chosen: the owner's painting, its background cut away. */
function Compass() {
  return (
    <Image
      accessibilityLabel="A compass"
      resizeMode="contain"
      source={require("../assets/compass.png")}
      style={local.compass}
    />
  );
}

const ledgerColumns = [
  { color: colors.danger, column: "Attention" },
  { color: colors.accent, column: "Running" },
  { color: colors.violet, column: "Idle" },
  { color: colors.success, column: "Done" },
] as const;

/** One row of an overview's list: a quest's name and where it stands; pressing it selects the quest. */
function OverviewRow({ mission, onPress }: { mission: MissionSummary; onPress: () => void }) {
  const tone = stateTones[mission.state];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [local.overviewRow, pressed && local.pressed]}
    >
      <View style={[local.overviewDot, { backgroundColor: tone.color }]} />
      <Text numberOfLines={1} style={local.overviewRowText}>
        {mission.title}
      </Text>
      <Text numberOfLines={1} style={local.overviewRowMeta}>
        {[stateLabels[mission.state], mission.workspaceName].filter((part) => part !== null).join(" · ")}
      </Text>
    </Pressable>
  );
}

/** The count of quests in each column, then what needs the owner and what is underway, each a press away from its panel. */
function QuestLedger({
  missions,
  onSelect,
}: {
  missions: ReadonlyArray<MissionSummary>;
  onSelect: (id: MissionId) => void;
}) {
  const board = boardOf(missions);
  const lists = [
    { label: "Needs you", rows: board.Attention },
    { label: "Underway", rows: board.Running },
  ] as const;
  return (
    <>
      <View style={local.group}>
        <Text style={local.groupLabel}>The quest ledger</Text>
        <View style={local.ledger}>
          {ledgerColumns.map(({ column, color }) => (
            <View key={column} style={local.ledgerTile}>
              <Text style={[local.ledgerCount, { color }]}>{board[column].length}</Text>
              <Text style={local.ledgerLabel}>{stateLabels[column]}</Text>
            </View>
          ))}
        </View>
      </View>
      {lists.map(
        ({ label, rows }) =>
          rows.length > 0 && (
            <View key={label} style={local.group}>
              <Text style={local.groupLabel}>{label}</Text>
              <View style={local.card}>
                {rows.slice(0, 5).map((mission) => (
                  <OverviewRow key={mission.id} mission={mission} onPress={() => onSelect(mission.id)} />
                ))}
                {rows.length > 5 && <Text style={local.overviewMore}>+ {rows.length - 5} more on the board</Text>}
              </View>
            </View>
          ),
      )}
    </>
  );
}

/**
 * What the board's side panel shows while no quest is chosen: a compass and an invitation to choose one, the ledger of
 * how many quests stand in each column, and what needs the owner and what is underway, each a press away from its panel.
 */
export function QuestOverview({
  missions,
  onSelect,
  realm,
}: {
  missions: ReadonlyArray<MissionSummary>;
  onSelect: (id: MissionId) => void;
  /** The realm whose quests the board shows, or null for every realm. */
  realm: string | null;
}) {
  return (
    <View style={local.panel}>
      <ScrollView contentContainerStyle={local.content} style={styles.flex}>
        <View style={local.hero}>
          <Text style={local.kicker}>The Guild Hall</Text>
          <Text style={local.heroName}>The Council Awaits</Text>
          <Text style={local.meta}>{realm === null ? "All realms" : `The realm of ${realm}`}</Text>
        </View>
        <View style={local.overviewRule} />
        <View style={local.invitation}>
          <Compass />
          <Text style={local.invitationTitle}>No quest before the council</Text>
          <Text style={local.invitationText}>
            Choose a quest from the board to see how it stands, what it has learned, and what it spends.
          </Text>
        </View>
        <View style={local.overviewRule} />
        <QuestLedger missions={missions} onSelect={onSelect} />
        <Text style={local.quote}>“Every great tale begins with a quest.”</Text>
      </ScrollView>
    </View>
  );
}

/**
 * What the board's side panel shows for a realm while no quest is chosen: its crest and name, its folder, the ledger
 * of its quests, those needing the owner or underway, and the button that opens the crest studio.
 */
export function RealmPanel({
  missions,
  onCustomize,
  onOpenLore,
  onRename,
  onSelect,
  realm,
}: {
  missions: ReadonlyArray<MissionSummary>;
  onCustomize: () => void;
  /** Opens the lore kept for this realm. */
  onOpenLore: () => void;
  /** Keeps a new name for the realm; rejects with the reason when refused. */
  onRename: (name: string) => Promise<unknown>;
  onSelect: (id: MissionId) => void;
  realm: WorkspaceChoice;
}) {
  // The new name while the realm's name is being edited; null at rest.
  const [draft, setDraft] = useState<string | null>(null);
  // Blur and submit both save; the ref lets the second of the two see that the first already did.
  const draftRef = useRef<string | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);
  const editName = (value: string | null) => {
    draftRef.current = value;
    setDraft(value);
  };
  const saveName = () => {
    if (draftRef.current === null) return;
    const name = draftRef.current.trim();
    editName(null);
    if (name === "" || name === realm.name) return;
    onRename(name).then(
      () => setRenameError(null),
      (reason: Error) => setRenameError(reason.message),
    );
  };
  const lastActivity = missions.length === 0 ? null : Math.max(...missions.map((mission) => mission.lastActivityAt));
  const cost = missions.reduce((sum, mission) => sum + mission.budget.spent.cost, 0);
  const tokens = missions.reduce(
    (sum, { usage }) => sum + usage.input + usage.cacheRead + usage.cacheCreation + usage.output,
    0,
  );
  const spentText = `${tokenCountOf(tokens)} tokens${cost > 0 ? ` · $${cost.toFixed(2)}` : ""}`;
  return (
    <View style={local.panel}>
      <ScrollView contentContainerStyle={local.content} style={styles.flex}>
        <View style={local.hero}>
          <Text style={local.kicker}>Realm</Text>
          <View style={local.heroRow}>
            <Pressable
              accessibilityHint="Press to customize the crest"
              accessibilityLabel={`Crest of ${realm.name}`}
              accessibilityRole="button"
              onPress={onCustomize}
            >
              <CrestBadge crest={realm.crest} id={realm.id} size={64} />
            </Pressable>
            {draft === null ? (
              <Pressable
                accessibilityHint="Press to rename the realm"
                accessibilityRole="button"
                onPress={() => editName(realm.name)}
                style={styles.flex}
              >
                <Text numberOfLines={3} style={local.heroName}>
                  {realm.name}
                </Text>
              </Pressable>
            ) : (
              <View style={local.nameField}>
                <TextInput
                  accessibilityLabel="Realm name"
                  autoFocus
                  maxLength={80}
                  onBlur={saveName}
                  onChangeText={editName}
                  onSubmitEditing={saveName}
                  style={[local.heroName, local.nameInput]}
                  value={draft}
                />
              </View>
            )}
          </View>
          {renameError !== null && <Text style={styles.error}>{renameError}</Text>}
          <Text numberOfLines={2} style={local.meta}>
            {realm.path}
          </Text>
        </View>
        <Group label="Details">
          <Row label="Quests" value={String(missions.length)} />
          <Row label="Threads" value={String(missions.reduce((sum, mission) => sum + mission.threadCount, 0))} />
          {lastActivity !== null && <Row label="Last active" value={timeOf(lastActivity)} />}
          <Row label="Spent" value={spentText} />
        </Group>
        <Group label="Lore">
          <Row label="What this realm has learned" onPress={onOpenLore} />
        </Group>
        <QuestLedger missions={missions} onSelect={onSelect} />
      </ScrollView>
    </View>
  );
}

const local = StyleSheet.create({
  card: {
    ...ink,
    backgroundColor: "rgba(255,248,229,0.6)",
    borderRadius: radii.md,
    overflow: "hidden",
  },
  chevron: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.lg },
  compass: { height: 150, width: 150 },
  content: { gap: 18, paddingHorizontal: 28, paddingVertical: 26 },
  does: {
    backgroundColor: "rgba(249,236,209,0.55)",
    borderColor: "#ae4735",
    borderRadius: 5,
    borderWidth: 1.5,
    gap: 12,
    padding: 16,
  },
  doesHeading: {
    color: colors.text,
    fontFamily: fonts.hand,
    fontSize: fontSizes.lg,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  group: { gap: 4 },
  groupLabel: {
    color: colors.textMuted,
    fontFamily: fonts.hand,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  hero: { gap: 10 },
  heroName: {
    color: colors.text,
    fontFamily: fonts.hand,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 0.4,
    lineHeight: 27,
    textTransform: "uppercase",
  },
  heroRow: { alignItems: "center", flexDirection: "row", gap: 12, paddingRight: 34 },
  invitation: { alignItems: "center", gap: 8, paddingVertical: 8 },
  invitationText: {
    color: colors.textMuted,
    fontFamily: fonts.sans,
    fontSize: fontSizes.base,
    lineHeight: 20,
    textAlign: "center",
  },
  invitationTitle: {
    color: colors.text,
    fontFamily: fonts.hand,
    fontSize: fontSizes.lg,
    fontWeight: "700",
    letterSpacing: 0.4,
    marginTop: 6,
  },
  kicker: {
    color: colors.gold,
    fontFamily: fonts.hand,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  ledger: { flexDirection: "row", gap: 8 },
  ledgerCount: { fontFamily: fonts.hand, fontSize: 24, fontWeight: "700" },
  ledgerLabel: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  ledgerTile: {
    alignItems: "center",
    backgroundColor: "rgba(214,183,132,0.4)",
    borderRadius: radii.md,
    flex: 1,
    gap: 2,
    paddingVertical: 10,
  },
  meta: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.md },
  metaState: { fontWeight: "700" },
  // The field may not outgrow the panel: a web input is as wide as its text unless told otherwise.
  nameField: { flex: 1, minWidth: 0 },
  nameInput: {
    backgroundColor: "rgba(255,248,229,0.7)",
    borderColor: colors.gold,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    fontSize: 18,
    lineHeight: 24,
    minWidth: 0,
    padding: 6,
    width: "100%",
  },
  note: {
    alignItems: "center",
    backgroundColor: "#d9e6f6",
    borderColor: "#a6c4ee",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  noteText: { color: colors.text, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.base, fontStyle: "italic" },
  open: {
    ...ink,
    alignItems: "center",
    backgroundColor: colors.gold,
    borderRadius: radii.sm,
    paddingVertical: 10,
  },
  openPressed: { backgroundColor: colors.goldHi },
  openText: {
    color: colors.text,
    fontFamily: fonts.hand,
    fontSize: fontSizes.md,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  overviewDot: { borderRadius: radii.pill, height: 8, width: 8 },
  overviewMore: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm, padding: 10 },
  overviewRow: { alignItems: "center", flexDirection: "row", gap: 8, minHeight: 38, paddingHorizontal: 12 },
  overviewRowMeta: { color: colors.textMuted, flexShrink: 1, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  overviewRowText: { color: colors.text, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.md },
  overviewRule: { backgroundColor: colors.border, height: 1 },
  panel: { backgroundColor: colors.paper, flex: 1 },
  pressed: { backgroundColor: colors.controlActive },
  quote: {
    color: colors.textMuted,
    fontFamily: fonts.sans,
    fontSize: fontSizes.base,
    fontStyle: "italic",
    paddingBottom: 6,
    textAlign: "center",
  },
  row: { alignItems: "center", flexDirection: "row", gap: 8, minHeight: 40, paddingHorizontal: 12 },
  rowLabel: { color: colors.text, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.md },
  rowValue: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  spends: { gap: 10 },
  tab: { borderBottomColor: "transparent", borderBottomWidth: 3, marginBottom: -1, paddingBottom: 8, paddingTop: 4 },
  tabActive: { borderBottomColor: colors.danger },
  tabFigure: { color: colors.success },
  tabs: { borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: "row", gap: 22 },
  tabText: {
    color: colors.textMuted,
    fontFamily: fonts.hand,
    fontSize: fontSizes.sm,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  tabTextActive: { color: colors.text },
});
