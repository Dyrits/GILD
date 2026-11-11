import type { MissionState, ThreadState } from "@iskios/contracts";
import { Platform } from "react-native";
import { colorScheme } from "./colorScheme";

/**
 * The dark palette, the app's original look: one dark navy, flat surfaces told apart by a slightly lighter or darker
 * step, thin borders, and a single blue accent. State colors are the only others.
 */
const dark = {
  accent: "#4f86e8",
  accentSoft: "#1f3350",
  accentText: "#8db3ff",
  /** A hairline between surfaces. */
  border: "#2a3a4f",
  borderStrong: "#3b4e68",
  /** A reply in a conversation: a step lighter than the page. */
  bubble: "#1d2b3d",
  /** The owner's message in a conversation: a step bluer than a reply. */
  bubbleUser: "#24384f",
  /** Fields, menus, and tips: the step above the page. */
  canvas: "#1a2635",
  control: "#1c2a3b",
  controlActive: "#2b3d55",
  controlHover: "#243449",
  /** The small button at a card's corner that opens its quest. */
  cornerButton: "#e8edf4",
  danger: "#e5604f",
  dangerSoft: "#3a2224",
  dangerText: "#f08b7d",
  /** The outline of a control or card. */
  edge: "#34465e",
  frame: "#1c2a3b",
  /** The window behind the sidebar and the page. */
  ground: "#0f1722",
  /** Headings and icons that stand out from the plain text. */
  highlight: "#c3cddb",
  /** The stroke behind Attention. */
  marker: "#3d3524",
  onAccent: "#ffffff",
  /** Text and icons on the sidebar. */
  onGround: "#aebbcc",
  /** The page behind panels and cards. */
  page: "#172230",
  placeholder: "#66758a",
  /** The shadow under large titles, which lifts them off the page. */
  shadow: "#000",
  sidebar: "#111a26",
  success: "#4fb872",
  successSoft: "#1d3a2b",
  successText: "#7fd49a",
  surface: "#1c2a3b",
  /** A terminal snapshot in a message. */
  terminal: "#2a4562",
  text: "#e8edf4",
  textDim: "#66758a",
  textMuted: "#8796ab",
  textSecondary: "#b4c0d0",
  violet: "#9a82e0",
  violetSoft: "#2c2745",
  warning: "#e0a537",
  warningSoft: "#3a3220",
  warningText: "#ecc063",
} as const;

/** A palette: every color the app uses, under the same names in each look. */
export type Palette = { readonly [Name in keyof typeof dark]: string };

/**
 * The light palette: warm parchment surfaces, ink-navy text, and the same blue accent a step deeper so it reads on
 * light. Surfaces keep the dark palette's order of steps (the cards and fields sit a step above the page).
 */
const light: Palette = {
  accent: "#3f5f94",
  accentSoft: "#e0e7f2",
  accentText: "#2f4d80",
  border: "#e0d6c9",
  borderStrong: "#cdbfae",
  bubble: "#fbf8f3",
  bubbleUser: "#e3eaf4",
  canvas: "#fbf8f3",
  control: "#f8f4ee",
  controlActive: "#e4dacd",
  controlHover: "#eee6db",
  cornerButton: "#e4dacd",
  danger: "#c8402f",
  dangerSoft: "#f6dcd7",
  dangerText: "#a8301f",
  edge: "#d5c9ba",
  frame: "#f8f4ee",
  ground: "#ebe3d8",
  highlight: "#2a3a4f",
  marker: "#f3e4bd",
  onAccent: "#ffffff",
  onGround: "#4d5b6d",
  page: "#f3ece3",
  placeholder: "#9a9086",
  shadow: "rgba(255,255,255,0)",
  sidebar: "#f7f0e8",
  success: "#3f9a5f",
  successSoft: "#d9eddf",
  successText: "#2a7a47",
  surface: "#f8f4ee",
  terminal: "#e1e8f1",
  text: "#1c2838",
  textDim: "#9a9086",
  textMuted: "#6b7686",
  textSecondary: "#46546a",
  violet: "#7a5fc7",
  violetSoft: "#e6dff5",
  warning: "#c98a14",
  warningSoft: "#f7ebcb",
  warningText: "#8f5f0a",
};

/** The palette in use, fixed for a run by the owner's choice of look (see `colorScheme`). */
export const colors: Palette = { dark, light }[colorScheme];

/** Corner radii, from small controls to the main panel. */
export const radii = { lg: 8, md: 6, pill: 999, sm: 4, xl: 12 } as const;

/** The rounded corner of boxes, cards, and buttons. */
export const round = { borderRadius: radii.md } as const;

/** The thin line around cards, fields, and buttons. */
export const outline = { borderColor: colors.edge, borderWidth: 1 } as const;

/** Type sizes; the base is a desktop app's 14 points. */
export const fontSizes = { base: 14, lg: 16, md: 13, sm: 12, title: 20, xl: 18, xs: 11 } as const;

/** The system typeface on every platform. */
export const fonts = {
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
  sans: Platform.OS === "web" ? 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' : "System",
} as const;

/** Display names preserve the service's stable state values. */
export const stateLabels = {
  Archived: "Archived",
  Attention: "Summons",
  Done: "Fulfilled",
  Failed: "Failed",
  Idle: "Resting",
  Running: "Underway",
  Stopped: "Stopped",
  Waiting: "Awaiting word",
} as const;

/** How each state reads: its ink color and the soft fill behind its mark. */
export const stateTones: Record<ThreadState | MissionState, { readonly color: string; readonly soft: string }> = {
  Archived: { color: colors.textMuted, soft: colors.controlActive },
  Attention: { color: colors.warningText, soft: colors.marker },
  Done: { color: colors.successText, soft: colors.successSoft },
  Failed: { color: colors.dangerText, soft: colors.dangerSoft },
  Idle: { color: colors.textMuted, soft: colors.controlActive },
  Running: { color: colors.accentText, soft: colors.accentSoft },
  Stopped: { color: colors.textSecondary, soft: colors.controlActive },
  Waiting: { color: colors.violet, soft: colors.violetSoft },
};
