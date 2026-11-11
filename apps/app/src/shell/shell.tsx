import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { allMissions } from "../foundation/queries";
import { QuestPanelSetter, SidebarShown, TopBarShown } from "../foundation/shellContext";
import { colors, radii } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { useRituals } from "../rituals/rituals";
import type { RealmListing } from "./questTree";
import { clampRailWidth, readHidden, readRailWidth, rememberHidden, rememberRailWidth } from "./railStorage";
import { Sidebar } from "./sidebar";
import {
  crumbsOf,
  type DetailsToggle,
  hasOwnTitleBar,
  PanelIcon,
  QuestColumn,
  questColumnWidth,
  TopBar,
} from "./topBar";

/** The window width from which the sidebar shows beside the content; narrower windows keep the screens' own links. */
const sidebarBreakpoint = 820;

/** The size of the round handle on the rail's edge that collapses and expands it. */
const handleSize = 26;

/** The height of the top bar, which the frame's vertical center is measured from. */
const topBarHeight = 40;

// The pointer shows it can be dragged sideways.
const resizeCursor = { cursor: "col-resize" } as object;

/**
 * A thin strip on the open rail's edge that the owner drags to widen or narrow it, between a least and a most width; the
 * width is remembered.
 */
function RailResizer({
  onChange,
  width,
  windowWidth,
}: {
  onChange: (width: number) => void;
  width: number;
  windowWidth: number;
}) {
  const start = useRef(width);
  const latest = useRef(width);
  latest.current = width;
  const windowNow = useRef(windowWidth);
  windowNow.current = windowWidth;
  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        start.current = latest.current;
        // No text is picked up by the pointer while the rail is dragged.
        if (typeof document !== "undefined") document.body.style.userSelect = "none";
      },
      onPanResponderMove: (_, gesture) => onChange(clampRailWidth(start.current + gesture.dx, windowNow.current)),
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
  props: Omit<Parameters<typeof Sidebar>[0], "width"> & {
    children: ReactNode;
    details: DetailsToggle | null;
    /** The realm whose quest list is open, named in the top bar. */
    listedRealm: RealmListing | null;
  },
) {
  const { width } = useWindowDimensions();
  const [isHidden, setIsHidden] = useState(readHidden);
  const [storedRailWidth, setRailWidth] = useState(readRailWidth);
  // Held to a quarter of the window again whenever the window changes size; the remembered width stays as dragged.
  const railWidth = clampRailWidth(storedRailWidth, width);
  const [questPanel, setQuestPanel] = useState<ReactNode>(null);
  const [panelTitle, setPanelTitle] = useState("Quest");
  const setPanel = useCallback((panel: ReactNode, title: string) => {
    setQuestPanel(panel);
    setPanelTitle(title);
  }, []);
  const { data } = useServiceQuery(props.client, allMissions.request, allMissions.key);
  const hasRail = width >= sidebarBreakpoint;
  const toggle = () => {
    rememberHidden(!isHidden);
    setIsHidden(!isHidden);
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
    listedRealmName: props.listedRealm?.name ?? null,
    missions: data?.missions ?? [],
    onPlace: props.onPlace,
    openMission: props.openMission,
    place: props.place,
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
          <View style={local.window}>
            <View style={local.windowMain}>
              <TopBar client={props.client} crumbs={crumbs} details={null} />
              <View style={local.frame}>
                {!isHidden && <Sidebar {...props} width={railWidth} />}
                {!isHidden && <RailResizer onChange={setRailWidth} width={railWidth} windowWidth={width} />}
                <Pressable
                  accessibilityLabel={isHidden ? "Show sidebar (⌘B)" : "Hide sidebar (⌘B)"}
                  accessibilityRole="button"
                  onPress={toggle}
                  style={({ pressed }) => [
                    local.handle,
                    isHidden ? local.handleTab : { left: railWidth - handleSize / 2 },
                    pressed && local.handlePressed,
                  ]}
                >
                  <PanelIcon />
                </Pressable>
                <View style={local.panel}>{props.children}</View>
              </View>
            </View>
            {panelColumn}
            {details !== null && details.isPinned !== true && (
              <Pressable
                accessibilityLabel={details.isOpen ? "Hide quest panel" : "Show quest panel"}
                accessibilityRole="button"
                onPress={details.onToggle}
                style={({ pressed }) => [
                  local.handle,
                  local.endHandle,
                  isPanelShown ? { right: questColumnWidth - handleSize / 2 } : local.endHandleTab,
                  pressed && local.handlePressed,
                ]}
              >
                <PanelIcon side="right" />
              </Pressable>
            )}
          </View>
        </TopBarShown.Provider>
      </SidebarShown.Provider>
    </QuestPanelSetter.Provider>
  );
}

const local = StyleSheet.create({
  // The quest panel's handle sits on the window, not the frame, so it can straddle the panel's edge. It is centered on the
  // frame, which starts below the top bar.
  endHandle: { marginTop: topBarHeight / 2 - handleSize / 2 },
  // Closed, the handle is the half of a circle against the window's right edge.
  endHandleTab: {
    borderBottomRightRadius: 0,
    borderRightWidth: 0,
    borderTopRightRadius: 0,
    height: handleSize * 1.5,
    marginTop: topBarHeight / 2 - handleSize * 0.75,
    paddingLeft: 3,
    right: 0,
    width: handleSize * 0.75,
  },
  frame: { backgroundColor: colors.ground, flex: 1, flexDirection: "row", overflow: "hidden" },
  handle: {
    alignItems: "center",
    backgroundColor: colors.sidebar,
    borderColor: colors.edge,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: handleSize,
    justifyContent: "center",
    marginTop: -handleSize / 2,
    position: "absolute",
    top: "50%",
    width: handleSize,
    // Above the strip that resizes the sidebar, which runs beneath the button.
    zIndex: 4,
  },
  handlePressed: { backgroundColor: colors.ground },
  // Hidden, the handle is the half of a circle against the window's left edge.
  handleTab: {
    borderBottomLeftRadius: 0,
    borderLeftWidth: 0,
    borderTopLeftRadius: 0,
    height: handleSize * 1.5,
    left: 0,
    marginTop: -handleSize * 0.75,
    paddingRight: 3,
    width: handleSize * 0.75,
  },
  hidden: { display: "none" },
  narrow: { backgroundColor: colors.page, flex: 1 },
  narrowContent: { flex: 1 },
  panel: {
    backgroundColor: colors.page,
    borderColor: colors.borderStrong,
    borderLeftWidth: 1.5,
    flex: 1,
    overflow: "hidden",
  },
  resizer: { bottom: 0, position: "absolute", top: 0, width: 8, zIndex: 3 },
  window: { backgroundColor: colors.ground, flex: 1, flexDirection: "row" },
  windowMain: { flex: 1 },
});
