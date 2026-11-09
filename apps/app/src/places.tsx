import type { MissionId, WorkspaceId } from "@gild/contracts";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ServiceClient } from "./client";
import { MissionStarter } from "./dashboard";
import { Badge, Emblem, type EmblemName } from "./emblems";
import { threadCountOf } from "./labels";
import { allMissions } from "./queries";
import type { Place } from "./sidebar";
import { EmptyBoard, GuildHero } from "./sketches";
import { colors, cut, fontSizes, fonts, ink, lift } from "./theme";
import { useServiceQuery } from "./useServiceQuery";

/** A place's page: the drawn castle behind a large title, then what the place holds. */
function Page({ children, title }: { children: ReactNode; title: string }) {
  return (
    <View style={local.page}>
      <ScrollView contentContainerStyle={local.content}>
        <GuildHero />
        <Text style={local.title}>{title}</Text>
        {children}
      </ScrollView>
    </View>
  );
}

/** The Guildmaster: the one message that starts a quest, and nothing else. */
export function GuildmasterScreen({ client, onOpen }: { client: ServiceClient; onOpen: (id: MissionId) => void }) {
  return (
    <Page title="Guildmaster">
      <MissionStarter client={client} onOpen={onOpen} workspace={null} />
    </Page>
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
    <Page title="Realms">
      {data !== null && realms.length === 0 && (
        <EmptyBoard line="No realm yet. Start a quest in a folder from the Guildmaster." />
      )}
      <View style={local.grid}>
        {realms.map((realm) => {
          const own = missions.filter((mission) => mission.workspaceId === realm.id);
          const open = own.filter((mission) => mission.state !== "Done").length;
          return (
            <Pressable
              accessibilityRole="button"
              key={realm.id}
              onPress={() => onWorkspace(realm.id)}
              style={(state) => [
                local.card,
                (state.pressed || (state as { hovered?: boolean }).hovered === true) && local.cardHovered,
              ]}
            >
              <Badge id={realm.id} isChip size={48} />
              <View style={local.cardText}>
                <Text numberOfLines={1} style={local.cardTitle}>
                  {realm.name}
                </Text>
                <Text numberOfLines={1} style={local.cardPath}>
                  {realm.path}
                </Text>
                <Text style={local.cardMeta}>
                  {open} open · {own.length - open} done
                  {own[0] !== undefined && own.length === 1 ? ` · ${threadCountOf(own[0])}` : ""}
                </Text>
              </View>
            </Pressable>
          );
        })}
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
  grid: { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: 18 },
  page: { backgroundColor: colors.wood, flex: 1 },
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
