import type { MissionState, ThreadState } from "@iskios/contracts";
import { Platform } from "react-native";

/**
 * The palette: one dark navy, flat surfaces told apart by a slightly lighter or darker step, thin borders, and a single
 * blue accent. State colors are the only others.
 */
export const colors = {
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
