import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { allMissions } from "../foundation/queries";
import { QuestPanelSetter, SidebarShown, TopBarShown } from "../foundation/shellContext";
import { colors, cut, fontSizes, fonts, radii } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { useRituals } from "../rituals/rituals";
import { clampRailWidth, readCollapsed, readRailWidth, rememberCollapsed, rememberRailWidth } from "./railStorage";
import { collapsedWidth, type RailTip, RailTipSetter, Sidebar } from "./sidebar";
import { crumbsOf, type DetailsToggle, hasOwnTitleBar, PanelIcon, QuestColumn, TopBar } from "./topBar";

/** The window width from which the sidebar shows beside the content; narrower windows keep the screens' own links. */
const sidebarBreakpoint = 820;

/** The size of the round handle on the rail's edge that collapses and expands it. */
const handleSize = 26;

// The pointer shows it can be dragged sideways.
const resizeCursor = { cursor: "col-resize" } as object;

/**
 * A thin strip on the open rail's edge that the owner drags to widen or narrow it, between a least and a most width; the
 * width is remembered.
 */
function RailResizer({ onChange, width }: { onChange: (width: number) => void; width: number }) {
  const start = useRef(width);
  const latest = useRef(width);
  latest.current = width;
  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        start.current = latest.current;
        // No text is picked up by the pointer while the rail is dragged.
        if (typeof document !== "undefined") document.body.style.userSelect = "none";
      },
      onPanResponderMove: (_, gesture) => onChange(clampRailWidth(start.current + gesture.dx)),
      onPanResponderRelease: () => {
        if (typeof document !== "undefined") document.body.style.userSelect = "";
        rememberRailWidth(latest.current);
      },
      onPanResponderTerminate: () => {
        if (typeof document !== "undefined") document.body.style.userSelect = "";
      },
      onStartShouldSetPanResponder: () => true,
    }),
  ).current;
  return (
    <View
      accessibilityLabel="Resize the sidebar"
      {...responder.panHandlers}
      style={[local.resizer, { left: width - 4 }, resizeCursor]}
    />
  );
}

/**
 * The window's frame: on a wide window the sidebar, which collapses to icons, beside a top bar over the content; on
 * a narrow one the content alone.
 */
export function Shell(
  props: Omit<Parameters<typeof Sidebar>[0], "isCollapsed" | "width"> & {
    children: ReactNode;
    details: DetailsToggle | null;
  },
) {
  const { width } = useWindowDimensions();
  const [isCollapsed, setIsCollapsed] = useState(readCollapsed);
  const [railWidth, setRailWidth] = useState(readRailWidth);
  const [questPanel, setQuestPanel] = useState<ReactNode>(null);
  const [panelTitle, setPanelTitle] = useState("Quest");
  const setPanel = useCallback((panel: ReactNode, title: string) => {
    setQuestPanel(panel);
    setPanelTitle(title);
  }, []);
  const { data } = useServiceQuery(props.client, allMissions.request, allMissions.key);
  const hasRail = width >= sidebarBreakpoint;
  const [tip, setTip] = useState<RailTip | null>(null);
  const toggle = () => {
    rememberCollapsed(!isCollapsed);
    setIsCollapsed(!isCollapsed);
    setTip(null);
  };
  // Command or Control with B shows or hides the rail, as in editors; the browser's own handling is kept elsewhere.
  const toggleRef = useRef(toggle);
  toggleRef.current = toggle;
  useEffect(() => {
    if (!hasRail || typeof document === "undefined") return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggleRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [hasRail]);
  const workspaces = data?.workspaces ?? [];
  const rituals = useRituals(props.client);
  const crumbs = crumbsOf({
    isLoaded: data !== null && rituals !== null,
    missions: data?.missions ?? [],
    onPlace: props.onPlace,
    onWorkspace: props.onWorkspace,
    openMission: props.openMission,
    place: props.place,
    realm: workspaces.find((workspace) => workspace.id === props.workspaceId) ?? null,
    rituals: rituals ?? [],
    workspaces,
  });
  const { details } = props;
  const isPanelShown = details?.isOpen === true && questPanel !== null;
  const panelColumn = isPanelShown && details !== null && (
    <QuestColumn isWide={hasRail} onClose={details.isPinned === true ? null : details.onToggle} title={panelTitle}>
      {questPanel}
    </QuestColumn>
  );
  // Narrow windows keep the screens' own links; as the macOS title bar the top bar stays, over the content alone. An
  // open quest panel takes the content's place; the content stays mounted, so the open thread is kept.
  if (!hasRail) {
    return (
      <QuestPanelSetter.Provider value={setPanel}>
        <TopBarShown.Provider value={hasOwnTitleBar}>
          <View style={local.narrow}>
            {hasOwnTitleBar && <TopBar client={props.client} crumbs={crumbs} details={details} />}
            <View style={[local.narrowContent, isPanelShown && local.hidden]}>{props.children}</View>
            {panelColumn}
          </View>
        </TopBarShown.Provider>
      </QuestPanelSetter.Provider>
    );
  }
  return (
    <QuestPanelSetter.Provider value={setPanel}>
      <SidebarShown.Provider value={true}>
        <TopBarShown.Provider value={true}>
          <RailTipSetter.Provider value={setTip}>
            <View style={local.window}>
              <View style={local.windowMain}>
                <TopBar client={props.client} crumbs={crumbs} details={details} />
                <View style={local.frame}>
                  <Sidebar {...props} isCollapsed={isCollapsed} width={railWidth} />
                  {!isCollapsed && <RailResizer onChange={setRailWidth} width={railWidth} />}
                  <Pressable
                    accessibilityLabel={isCollapsed ? "Expand sidebar (⌘B)" : "Collapse sidebar (⌘B)"}
                    accessibilityRole="button"
                    onPress={toggle}
                    style={({ pressed }) => [
                      local.handle,
                      { left: (isCollapsed ? collapsedWidth : railWidth) - handleSize / 2 },
                      pressed && local.handlePressed,
                    ]}
                  >
                    <PanelIcon />
                  </Pressable>
                  <View style={local.panel}>{props.children}</View>
                </View>
              </View>
              {panelColumn}
              {tip !== null && (
                <View pointerEvents="none" style={[local.tip, { left: tip.x, top: tip.y - 15 }]}>
                  <Text style={local.tipText}>{tip.label}</Text>
                </View>
              )}
            </View>
          </RailTipSetter.Provider>
        </TopBarShown.Provider>
      </SidebarShown.Provider>
    </QuestPanelSetter.Provider>
  );
}

const local = StyleSheet.create({
  frame: { backgroundColor: colors.wood, flex: 1, flexDirection: "row", overflow: "hidden" },
  handle: {
    alignItems: "center",
    backgroundColor: colors.leather,
    borderColor: colors.gold,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: handleSize,
    justifyContent: "center",
    marginTop: -handleSize / 2,
    position: "absolute",
    top: "50%",
    width: handleSize,
  },
  handlePressed: { backgroundColor: colors.wood },
  hidden: { display: "none" },
  narrow: { backgroundColor: colors.paper, flex: 1 },
  narrowContent: { flex: 1 },
  panel: {
    backgroundColor: colors.paper,
    borderColor: colors.borderStrong,
    borderLeftWidth: 1.5,
    flex: 1,
    overflow: "hidden",
  },
  resizer: { bottom: 0, position: "absolute", top: 0, width: 8, zIndex: 3 },
  tip: {
    ...cut,
    backgroundColor: colors.canvas,
    borderColor: colors.gold,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    position: "absolute",
    zIndex: 10,
  },
  tipText: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.md },
  window: { backgroundColor: colors.wood, flex: 1, flexDirection: "row" },
  windowMain: { flex: 1 },
});
