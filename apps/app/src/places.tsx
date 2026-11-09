import type { MissionId, WorkspaceId } from "@gild/contracts";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ServiceClient } from "./client";
import { MissionStarter } from "./dashboard";
import { Emblem, type EmblemName } from "./emblems";
import { allMissions } from "./queries";
import { RealmCard } from "./realmCard";
import type { Place } from "./sidebar";
import { EmptyBoard, GuildHero } from "./sketches";
import { colors, cut, fontSizes, fonts, ink, lift } from "./theme";
import { useServiceQuery } from "./useServiceQuery";

/** A place's page: the drawn castle behind a large title, then what the place holds. */
function Page({
  children,
  footer,
  hasHero = true,
  title,
}: {
  children?: ReactNode;
  /** What stays at the foot of the page, outside its scrolling: the message that starts a quest. */
  footer?: ReactNode;
  hasHero?: boolean;
  /** The page's heading; none where the top bar already names the place. */
  title?: string;
}) {
  return (
    <View style={local.page}>
      <ScrollView contentContainerStyle={local.content}>
        {hasHero && <GuildHero />}
        {title !== undefined && <Text style={local.title}>{title}</Text>}
        {children}
      </ScrollView>
      {footer !== undefined && <View style={local.footer}>{footer}</View>}
    </View>
  );
}

/** The Guildmaster: the one message that starts a quest, and nothing else. */
export function GuildmasterScreen({ client, onOpen }: { client: ServiceClient; onOpen: (id: MissionId) => void }) {
  return (
    <View style={local.stagePage}>
      <Text style={local.title}>Guildmaster</Text>
      <MissionStarter client={client} onOpen={onOpen} stage workspace={null} />
    </View>
  );
}

/** The realms: one card per workspace, with its folder and its quests; pressing one shows its quests. */
export function RealmsScreen({
  client,
  onWorkspace,
}: {
  client: ServiceClient;
  onWorkspace: (id: WorkspaceId) => void;
}) {
  const { data } = useServiceQuery(client, allMissions.request, allMissions.key);
  const realms = [...(data?.workspaces ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const missions = data?.missions ?? [];
  return (
    <Page hasHero={false}>
      {data !== null && realms.length === 0 && (
        <EmptyBoard line="No realm yet. Start a quest in a folder from the Guildmaster." />
      )}
      <View style={local.grid}>
        {realms.map((realm) => (
          <RealmCard key={realm.id} missions={missions} onPress={() => onWorkspace(realm.id)} realm={realm} />
        ))}
      </View>
    </Page>
  );
}

const keepRooms: ReadonlyArray<{ description: string; emblem: EmblemName; label: string; place: Place }> = [
  { description: "What your threads know, kept across quests.", emblem: "scroll", label: "Lore", place: "Intel" },
  { description: "Quests put away; reopen one from here.", emblem: "tower", label: "Archives", place: "Archived" },
];

/** The Keep: the guild's rooms, each leading to its place. */
export function KeepScreen({ client, onPlace }: { client: ServiceClient; onPlace: (place: Place) => void }) {
  const request = { _tag: "ListMissions", isArchived: true, search: null, state: null, workspaceId: null } as const;
  const { data } = useServiceQuery(client, request, `missions:${JSON.stringify(request)}`);
  return (
    <Page title="The Keep">
      <View style={local.grid}>
        {keepRooms.map((room) => (
          <Pressable
            accessibilityRole="button"
            key={room.label}
            onPress={() => onPlace(room.place)}
            style={(state) => [
              local.card,
              (state.pressed || (state as { hovered?: boolean }).hovered === true) && local.cardHovered,
            ]}
          >
            <View style={local.chip}>
              <Emblem name={room.emblem} size={28} tint={colors.goldHi} />
            </View>
            <View style={local.cardText}>
              <Text style={local.cardTitle}>
                {room.label}
                {room.place === "Archived" && data !== null && data.missions.length > 0
                  ? ` · ${data.missions.length}`
                  : ""}
              </Text>
              <Text style={local.cardMeta}>{room.description}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </Page>
  );
}

const local = StyleSheet.create({
  card: {
    ...ink,
    ...cut,
    ...lift,
    alignItems: "center",
    backgroundColor: colors.canvas,
    flexDirection: "row",
    gap: 14,
    maxWidth: "100%",
    padding: 16,
    width: 380,
  },
  cardHovered: { borderColor: colors.goldHi, transform: [{ translateY: -2 }] },
  cardMeta: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.md },
  cardPath: { color: colors.textMuted, fontFamily: fonts.mono, fontSize: fontSizes.xs },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { color: colors.text, fontFamily: fonts.hand, fontSize: fontSizes.lg, fontWeight: "700" },
  chip: {
    alignItems: "center",
    backgroundColor: colors.leather,
    borderRadius: 999,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  content: { gap: 18, paddingHorizontal: 28, paddingVertical: 20 },
  footer: { paddingBottom: 18, paddingHorizontal: 28, paddingTop: 6, zIndex: 2 },
  grid: { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: 18 },
  page: { backgroundColor: colors.wood, flex: 1 },
  stagePage: {
    backgroundColor: colors.wood,
    flex: 1,
    gap: 14,
    paddingBottom: 18,
    paddingHorizontal: 28,
    paddingTop: 20,
  },
  title: {
    color: colors.onWood,
    fontFamily: fonts.hand,
    fontSize: 46,
    fontWeight: "700",
    letterSpacing: 2,
    lineHeight: 56,
    textShadowColor: "#000",
    textShadowOffset: { height: 2, width: 0 },
    textShadowRadius: 6,
    textTransform: "uppercase",
  },
});
