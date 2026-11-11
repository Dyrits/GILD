import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { IskiosConversation } from "../conversation/guildmaster";
import { allMissions } from "../foundation/queries";
import { QuestPanelSetter, SidebarShown, TopBarShown } from "../foundation/shellContext";
import { colors, radii } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { useRituals } from "../rituals/rituals";
import { EdgeResizer } from "./edgeResizer";
import { IskiosColumn, IskiosFloating, IskiosLauncher, iskiosColumnWidth } from "./iskiosDock";
import type { RealmListing } from "./questTree";
import {
  clampPaneWidth,
  clampRailWidth,
  iskiosWidthKey,
  minRailWidth,
  questPanelWidthKey,
  readHidden,
  readIskiosOpen,
  readPaneWidth,
  readRailWidth,
  rememberHidden,
  rememberIskiosOpen,
  rememberPaneWidth,
  rememberRailWidth,
} from "./railStorage";
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
import { viewingOf } from "./viewing";

/** The window width from which the sidebar shows beside the content; narrower windows keep the screens' own links. */
const sidebarBreakpoint = 820;

/** The size of the round handle on the rail's edge that collapses and expands it. */
const handleSize = 26;

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
    /** The realm chosen for Iskios's next message, from a realm's page, and how to clear it. */
    iskios: { onRealm: (path: string | null) => void; realmPath: string | null };
  },
) {
  const { width } = useWindowDimensions();
  const [isHidden, setIsHidden] = useState(readHidden);
  const [storedRailWidth, setRailWidth] = useState(readRailWidth);
  // Held to a quarter of the window again whenever the window changes size; the remembered width stays as dragged.
  const railWidth = clampRailWidth(storedRailWidth, width);
  // The quest panel's and Iskios's columns, each dragged between its own width and a quarter of the window, as the rail.
  const [storedQuestWidth, setQuestWidth] = useState(() => readPaneWidth(questPanelWidthKey, questColumnWidth));
  const questWidth = clampPaneWidth(storedQuestWidth, width, questColumnWidth);
  const [storedIskiosWidth, setIskiosWidth] = useState(() => readPaneWidth(iskiosWidthKey, iskiosColumnWidth));
  const iskiosWidth = clampPaneWidth(storedIskiosWidth, width, iskiosColumnWidth);
  // Iskios's panel: folded to a pill or open, remembered; a realm chosen for its next message opens it.
  const [isIskiosOpen, setIsIskiosOpen] = useState(readIskiosOpen);
  // Opened to the whole content area, in place of the screen, until the owner restores it; not remembered.
  const [isIskiosFull, setIsIskiosFull] = useState(false);
  const setIskiosOpen = (isOpen: boolean) => {
    rememberIskiosOpen(isOpen);
    setIsIskiosOpen(isOpen);
    if (!isOpen) setIsIskiosFull(false);
  };
  const iskiosToggle = { isOpen: isIskiosOpen, onToggle: () => setIskiosOpen(!isIskiosOpen) };
  const { realmPath: iskiosRealmPath } = props.iskios;
  useEffect(() => {
    if (iskiosRealmPath !== null) {
      rememberIskiosOpen(true);
      setIsIskiosOpen(true);
    }
  }, [iskiosRealmPath]);
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
    <QuestColumn
      edge={
        <EdgeResizer
          label="Resize the quest panel"
          leastWidth={questColumnWidth}
          onChange={setQuestWidth}
          onRelease={(next) => rememberPaneWidth(questPanelWidthKey, next)}
          side="start"
          width={questWidth}
          windowWidth={width}
        />
      }
      isWide={hasRail}
      onClose={details.isPinned === true ? null : details.onToggle}
      title={panelTitle}
      width={questWidth}
    >
      {questPanel}
    </QuestColumn>
  );
  // Beside every screen, the Guild Hall's hub included, Iskios is a column; only a narrow window floats it as a card (CHG-0193).
  const isIskiosFloating = !hasRail;
  // Iskios's column stands at the window's far right, past the quest panel, which its handle then clears.
  const isIskiosColumn = isIskiosOpen && !isIskiosFloating && !isIskiosFull;
  const iskiosOffset = isIskiosColumn ? iskiosWidth : 0;
  const iskiosChat = (
    <IskiosConversation
      client={props.client}
      isFull={isIskiosFull}
      onFold={hasRail || hasOwnTitleBar ? null : () => setIskiosOpen(false)}
      onOpenMission={props.onOpenMission}
      onRealm={props.iskios.onRealm}
      onToggleFull={() => setIsIskiosFull(!isIskiosFull)}
      realmPath={props.iskios.realmPath}
      viewing={viewingOf(props.place, props.openMission, props.listedRealm?.name ?? null)}
    />
  );
  // The top bar's button opens it; a window with no top bar (narrow, not macOS) has a pill in its stead.
  const hasLauncherPill = !hasRail && !hasOwnTitleBar;
  const iskiosFull = isIskiosOpen && isIskiosFull && <View style={local.fill}>{iskiosChat}</View>;
  const iskiosDock = isIskiosOpen ? (
    isIskiosFloating && !isIskiosFull ? (
      <IskiosFloating>{iskiosChat}</IskiosFloating>
    ) : null
  ) : hasLauncherPill ? (
    <IskiosLauncher onPress={() => setIskiosOpen(true)} />
  ) : null;
  // Narrow windows keep the screens' own links; as the macOS title bar the top bar stays, over the content alone. An
  // open quest panel takes the content's place; the content stays mounted, so the open thread is kept.
  if (!hasRail) {
    return (
      <QuestPanelSetter.Provider value={setPanel}>
        <TopBarShown.Provider value={hasOwnTitleBar}>
          <View style={local.narrow}>
            {hasOwnTitleBar && <TopBar client={props.client} crumbs={crumbs} details={details} iskios={iskiosToggle} />}
            <View style={[local.narrowContent, isPanelShown && local.hidden]}>{props.children}</View>
            {!isPanelShown && iskiosDock}
            {!isPanelShown && iskiosFull}
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
            <TopBar client={props.client} crumbs={crumbs} details={null} iskios={iskiosToggle} />
            <View style={local.body}>
              <View style={local.frame}>
                {!isHidden && <Sidebar {...props} width={railWidth} />}
                {!isHidden && (
                  <EdgeResizer
                    label="Resize the sidebar"
                    leastWidth={minRailWidth}
                    onChange={setRailWidth}
                    onRelease={rememberRailWidth}
                    side="end"
                    width={railWidth}
                    windowWidth={width}
                  />
                )}
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
                <View style={local.panel}>
                  {props.children}
                  {iskiosFull}
                </View>
                {iskiosDock}
              </View>
              {panelColumn}
              {isIskiosColumn && (
                <IskiosColumn
                  edge={
                    <EdgeResizer
                      label="Resize Iskios"
                      leastWidth={iskiosColumnWidth}
                      onChange={setIskiosWidth}
                      onRelease={(next) => rememberPaneWidth(iskiosWidthKey, next)}
                      side="start"
                      width={iskiosWidth}
                      windowWidth={width}
                    />
                  }
                  width={iskiosWidth}
                >
                  {iskiosChat}
                </IskiosColumn>
              )}
              {details !== null && details.isPinned !== true && (
                <Pressable
                  accessibilityLabel={details.isOpen ? "Hide quest panel" : "Show quest panel"}
                  accessibilityRole="button"
                  onPress={details.onToggle}
                  style={({ pressed }) => [
                    local.handle,
                    isPanelShown
                      ? { right: questWidth - handleSize / 2 + iskiosOffset }
                      : [local.endHandleTab, { right: iskiosOffset }],
                    pressed && local.handlePressed,
                  ]}
                >
                  <PanelIcon side="right" />
                </Pressable>
              )}
            </View>
          </View>
        </TopBarShown.Provider>
      </SidebarShown.Provider>
    </QuestPanelSetter.Provider>
  );
}

const local = StyleSheet.create({
  // The window below the top bar: the frame, then the quest panel and Iskios's column, which the quest panel's handle
  // straddles; the handle is centered on this body.
  body: { flex: 1, flexDirection: "row" },
  // Closed, the handle is the half of a circle against the window's right edge.
  endHandleTab: {
    borderBottomRightRadius: 0,
    borderRightWidth: 0,
    borderTopRightRadius: 0,
    height: handleSize * 1.5,
    marginTop: -handleSize * 0.75,
    paddingLeft: 3,
    right: 0,
    width: handleSize * 0.75,
  },
  // Iskios restored to the whole content area: over the screen, which stays mounted beneath, and the sidebar stays.
  fill: { backgroundColor: colors.page, bottom: 0, left: 0, position: "absolute", right: 0, top: 0, zIndex: 7 },
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
  window: { backgroundColor: colors.ground, flex: 1 },
});
