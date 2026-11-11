import type { GuildHallRecap, MissionId, MissionSummary } from "@iskios/contracts";
import { type ReactNode, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { CrestBadge } from "../crest/crest";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts, radii, stateTones } from "../foundation/theme";
import { agoOf } from "../shell/questTree";
import { StateBadge } from "../ui/controls";
import { type HubTile, heroOf, hubOf, nowOf, recapOf, type WaitReason } from "./guildHall";

/** The content width from which the hub puts the band's groups side by side, and the finished quests beside the rest. */
const wideFrom = 1000;

/** What each wait looks like: the state it shows as, which gives the card its edge and tint. */
const reasonTones = {
  Failed: stateTones.Failed,
  "Needs your answer": stateTones.Attention,
  "Result to confirm": stateTones.Done,
} as const satisfies Record<WaitReason, { readonly color: string; readonly soft: string }>;

/** Where a quest is: the name of its realm, or the Borderlands. */
const realmOf = (mission: MissionSummary) => mission.workspaceName ?? "Borderlands";

/** A quest that waits for the owner: a wide card with an edge and tint of its reason, which reads before anything else. */
function WaitingCard({
  mission,
  onOpen,
  reason,
}: {
  mission: MissionSummary;
  onOpen: (id: MissionId) => void;
  reason: WaitReason;
}) {
  const tone = reasonTones[reason];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onOpen(mission.id)}
      style={({ pressed }) => [
        local.card,
        local.waiting,
        { backgroundColor: tone.soft, borderLeftColor: tone.color },
        pressed && local.pressed,
      ]}
    >
      <CrestBadge
        crest={mission.workspaceCrest}
        id={mission.workspaceId ?? mission.id}
        isLoose={mission.workspaceId === null}
        size={40}
      />
      <View style={local.waitingMain}>
        <Text numberOfLines={2} style={local.waitingTitle}>
          {mission.title}
        </Text>
        <Text numberOfLines={1} style={[local.waitingReason, { color: tone.color }]}>
          {reason} · {realmOf(mission)}
        </Text>
      </View>
      <Text style={[local.go, { color: tone.color }]}>Open ›</Text>
    </Pressable>
  );
}

/** The strokes of the band's icons, on a 24 by 24 grid: a flag, a play, a tick, coins, and a loop. */
const tileIcons = {
  finished: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M8 12.5l3 3 5-6"],
  rituals: ["M20 11a8 8 0 0 0-14-4", "M6 3v4h4", "M4 13a8 8 0 0 0 14 4", "M18 21v-4h-4"],
  running: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M10 8.5l5.5 3.5-5.5 3.5z"],
  spent: [
    "M12 4c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3z",
    "M4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7",
    "M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  ],
  waiting: ["M6 21V4", "M6 5h12l-3 4 3 4H6"],
} as const satisfies Record<HubTile["key"], readonly string[]>;

function TileIcon({ name, tint }: { name: HubTile["key"]; tint: string }) {
  return (
    <Svg
      fill="none"
      height={22}
      stroke={tint}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.7}
      viewBox="0 0 24 24"
      width={22}
    >
      {tileIcons[name].map((d) => (
        <Path d={d} key={d} />
      ))}
    </Svg>
  );
}

/** One figure of the band: an icon, the number big, and what it counts. The waiting tile takes the warning's tint while quests wait. */
function Tile({ tile }: { tile: HubTile }) {
  const isAlert = tile.key === "waiting" && tile.value !== "0";
  const ink = isAlert ? stateTones.Attention.color : colors.textSecondary;
  return (
    <View style={[local.card, local.tile, isAlert && { backgroundColor: stateTones.Attention.soft }]}>
      <View style={local.tileIcon}>
        <TileIcon name={tile.key} tint={ink} />
      </View>
      <View style={local.tileText}>
        <Text adjustsFontSizeToFit numberOfLines={1} style={[local.tileValue, isAlert && { color: ink }]}>
          {tile.value}
        </Text>
        <Text numberOfLines={1} style={local.tileLabel}>
          {tile.label}
        </Text>
      </View>
    </View>
  );
}

/** The band: what is going on now, and the recap of the period since the last visit, a caption over each group. */
function Band({
  isWide,
  recap,
  running,
  waitingCount,
}: {
  isWide: boolean;
  recap: GuildHallRecap | null;
  running: number;
  waitingCount: number;
}) {
  const recapTiles = recap === null ? null : recapOf(recap);
  return (
    <View style={[local.band, isWide && local.bandWide]}>
      <View style={[local.group, isWide && { flex: 2 }]}>
        <SectionHeading title="Now" />
        <View style={local.tiles}>
          {nowOf(waitingCount, running).map((tile) => (
            <Tile key={tile.key} tile={tile} />
          ))}
        </View>
      </View>
      {recapTiles !== null && (
        <View style={[local.group, isWide && { flex: 3 }]}>
          <SectionHeading title={recapTiles.heading} />
          <View style={local.tiles}>
            {recapTiles.tiles.map((tile) => (
              <Tile key={tile.key} tile={tile} />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

/** A quest touched lately, as a dense row: its crest, title and realm, state, and how long ago. */
function RecentRow({
  isFirst,
  isRoomy,
  mission,
  now,
  onOpen,
}: {
  isFirst: boolean;
  isRoomy: boolean;
  mission: MissionSummary;
  now: number;
  onOpen: (id: MissionId) => void;
}) {
  const ago = agoOf(mission.lastActivityAt, now);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onOpen(mission.id)}
      style={({ pressed }) => [local.row, !isFirst && local.rowDivided, pressed && local.pressed]}
    >
      <CrestBadge
        crest={mission.workspaceCrest}
        id={mission.workspaceId ?? mission.id}
        isLoose={mission.workspaceId === null}
        size={30}
      />
      <View style={local.rowTitles}>
        <Text numberOfLines={1} style={local.rowTitle}>
          {mission.title}
        </Text>
        <Text numberOfLines={1} style={local.realm}>
          {isRoomy ? realmOf(mission) : `${realmOf(mission)} · ${ago}`}
        </Text>
      </View>
      <StateBadge state={mission.state} />
      {isRoomy && <Text style={local.ago}>{ago}</Text>}
    </Pressable>
  );
}

/** A section's heading: a gold diamond, as between the sidebar's groups, the name, how many it holds, and a link at the end. */
function SectionHeading({
  action,
  count,
  title,
}: {
  action?: { label: string; onPress: () => void };
  count?: number;
  title: string;
}) {
  return (
    <View style={local.headingRow}>
      <Text style={local.diamond}>◆</Text>
      <Text style={local.headingText}>{title}</Text>
      {count !== undefined && count > 0 && (
        <View style={local.count}>
          <Text style={local.countText}>{count}</Text>
        </View>
      )}
      {action !== undefined && (
        <Pressable accessibilityRole="link" onPress={action.onPress} style={local.action}>
          <Text style={local.actionText}>{action.label} ›</Text>
        </Pressable>
      )}
    </View>
  );
}

function Section({
  action,
  children,
  count,
  title,
}: {
  action?: { label: string; onPress: () => void };
  children: ReactNode;
  count?: number;
  title: string;
}) {
  return (
    <View style={local.section}>
      <SectionHeading
        {...(action === undefined ? {} : { action })}
        {...(count === undefined ? {} : { count })}
        title={title}
      />
      {children}
    </View>
  );
}

/** The quests finished in the period, each a link to its quest. */
function Finished({ onOpenMission, recap }: { onOpenMission: (id: MissionId) => void; recap: GuildHallRecap }) {
  return (
    <Section count={recap.finishedCount} title={recapOf(recap).finishedHeading}>
      <View style={[local.card, local.finishedList]}>
        {recap.finished.map((quest) => (
          <Pressable
            accessibilityRole="button"
            key={quest.missionId}
            onPress={() => onOpenMission(quest.missionId)}
            style={local.finishedRow}
          >
            <Text style={local.tick}>✓</Text>
            <Text numberOfLines={1} style={local.finishedTitle}>
              {quest.title}
            </Text>
          </Pressable>
        ))}
        {recap.finishedCount > recap.finished.length && (
          <Text style={local.more}>and {recap.finishedCount - recap.finished.length} more</Text>
        )}
      </View>
    </Section>
  );
}

/**
 * The Guild Hall's page (quest coordination, Guild Hall as a hub): a line saying how many quests wait for the owner, a
 * band of figures (what is going on now, and the recap since the last visit), the quests that wait as cards that read
 * first, the quests touched last as a dense list, and the quests finished in the period. On a wide window the finished
 * quests stand beside the rest. Iskios's conversation is a panel the shell offers, not part of the page.
 */
export function GuildHallHub({
  missions,
  onOpenMission,
  onViewAll,
  recap,
}: {
  /** The quests, or null while they load. */
  missions: ReadonlyArray<MissionSummary> | null;
  onOpenMission: (id: MissionId) => void;
  /** Opens the board with every quest. */
  onViewAll: () => void;
  /** The recap of the period, or null while it loads. */
  recap: GuildHallRecap | null;
}) {
  const [width, setWidth] = useState(0);
  const [now] = useState(() => Date.now());
  const isWide = width >= wideFrom;
  const { recent, running, waiting } = hubOf(missions ?? []);
  const hasFinished = recap !== null && recap.finished.length > 0;
  const quests = (
    <>
      {waiting.length > 0 && (
        <Section count={waiting.length} title="Waiting for you">
          <View style={local.stack}>
            {waiting.map(({ mission, reason }) => (
              <WaitingCard key={mission.id} mission={mission} onOpen={onOpenMission} reason={reason} />
            ))}
          </View>
        </Section>
      )}
      <Section action={{ label: "View all", onPress: onViewAll }} title="Recent quests">
        {missions === null ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : recent.length === 0 ? (
          <Text style={styles.muted}>No quest yet. Ask Iskios for one.</Text>
        ) : (
          <View style={[local.card, local.list]}>
            {recent.map((mission, index) => (
              <RecentRow
                isFirst={index === 0}
                isRoomy={width >= 640}
                key={mission.id}
                mission={mission}
                now={now}
                onOpen={onOpenMission}
              />
            ))}
          </View>
        )}
      </Section>
    </>
  );
  const finished = hasFinished && <Finished onOpenMission={onOpenMission} recap={recap} />;
  return (
    <ScrollView
      contentContainerStyle={local.content}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={styles.flex}
    >
      <View style={local.hero}>
        <Text style={local.heroTitle}>{missions === null ? "Guild Hall" : heroOf(waiting.length)}</Text>
      </View>
      <Band isWide={isWide} recap={recap} running={running} waitingCount={waiting.length} />
      {isWide && hasFinished ? (
        <View style={local.columns}>
          <View style={local.mainColumn}>{quests}</View>
          <View style={local.sideColumn}>{finished}</View>
        </View>
      ) : (
        <>
          {quests}
          {finished}
        </>
      )}
    </ScrollView>
  );
}

const local = StyleSheet.create({
  action: { marginLeft: "auto" },
  actionText: { color: colors.accentText, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "600" },
  ago: {
    color: colors.textMuted,
    fontFamily: fonts.sans,
    fontSize: fontSizes.sm,
    textAlign: "right",
    width: 112,
  },
  band: { gap: 18 },
  bandWide: { alignItems: "flex-start", flexDirection: "row", gap: 24 },
  // The card: a step above the page, a firm edge, and a soft shadow that lifts it.
  card: {
    backgroundColor: colors.bubble,
    borderColor: colors.borderStrong,
    borderRadius: radii.xl,
    borderWidth: 1,
    shadowColor: colors.text,
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  columns: { alignItems: "flex-start", flexDirection: "row", gap: 28 },
  content: { gap: 22, paddingBottom: 110, paddingHorizontal: 28, paddingTop: 24 },
  count: {
    backgroundColor: colors.text,
    borderRadius: radii.pill,
    minWidth: 22,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  countText: {
    color: colors.page,
    fontFamily: fonts.sans,
    fontSize: fontSizes.sm,
    fontWeight: "700",
    textAlign: "center",
  },
  diamond: { color: colors.edge, fontSize: fontSizes.sm },
  finishedList: { gap: 2, paddingHorizontal: 14, paddingVertical: 10 },
  finishedRow: { alignItems: "center", flexDirection: "row", gap: 8, paddingVertical: 4 },
  finishedTitle: { color: colors.text, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.md },
  go: { fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "700" },
  group: { gap: 10 },
  headingRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  headingText: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: fontSizes.md,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  hero: { gap: 2 },
  heroTitle: { color: colors.text, fontFamily: fonts.sans, fontSize: 30, fontWeight: "800" },
  list: { overflow: "hidden" },
  mainColumn: { flex: 3, gap: 22 },
  more: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm, paddingTop: 4 },
  pressed: { opacity: 0.85 },
  realm: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  row: { alignItems: "center", flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
  rowDivided: { borderTopColor: colors.border, borderTopWidth: 1 },
  rowTitle: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.base, fontWeight: "700" },
  rowTitles: { flex: 1, gap: 1, minWidth: 0 },
  section: { gap: 10 },
  sideColumn: { flex: 2, gap: 22 },
  stack: { gap: 10 },
  tick: { color: colors.successText, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "700" },
  tile: { alignItems: "center", flex: 1, flexDirection: "row", gap: 12, minWidth: 0, padding: 14 },
  tileIcon: { alignItems: "center", justifyContent: "center", width: 28 },
  tileLabel: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tileText: { flex: 1, minWidth: 0 },
  tileValue: { color: colors.text, fontFamily: fonts.sans, fontSize: 26, fontWeight: "800" },
  waiting: {
    alignItems: "center",
    borderLeftWidth: 5,
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  waitingMain: { flex: 1, gap: 2 },
  waitingReason: { fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "600" },
  waitingTitle: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.lg, fontWeight: "700" },
});
