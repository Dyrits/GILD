import type { MissionState, ThreadState } from "@canopy/contracts";

/**
 * The palette every screen draws from: the Sketchbook look (art direction of 2026-11-08), ink on warm paper with
 * one blue ink for what runs and a highlighter for what needs the owner. Token names stay those of the earlier
 * OpenBot-like theme, so every screen changed with this file.
 */
export const colors = {
  accent: "#2b5a8a",
  accentSoft: "#dde8f3",
  accentText: "#24507c",
  border: "#e6e0d3",
  borderStrong: "#24221e",
  canvas: "#fffdf8",
  control: "#fffdf8",
  controlActive: "#ece6d8",
  controlHover: "#f3eee2",
  danger: "#b4412f",
  dangerSoft: "#f6e0da",
  dangerText: "#9c3424",
  frame: "#f3eee2",
  /** The highlighter stroke behind Attention. */
  marker: "#f6d36b",
  onAccent: "#fffdf8",
  /** The page behind panels and cards. */
  paper: "#fbf8f1",
  placeholder: "#a39d90",
  success: "#3f7a52",
  successSoft: "#e2eee3",
  successText: "#356846",
  surface: "#f6f1e6",
  text: "#24221e",
  textDim: "#a39d90",
  textMuted: "#8a8478",
  textSecondary: "#4a463f",
  violet: "#6b5aa6",
  violetSoft: "#e9e5f4",
  warning: "#d9a91c",
  warningSoft: "#fff8dc",
  warningText: "#8a5a00",
} as const;

/** Corner radii, from small controls to the main panel. */
export const radii = { lg: 12, md: 8, pill: 999, sm: 6, xl: 16 } as const;

/** A hand-cut corner: four slightly different radii, so a box looks cut with scissors rather than drawn by a machine. */
export const cut = {
  borderBottomLeftRadius: 9,
  borderBottomRightRadius: 12,
  borderTopLeftRadius: 13,
  borderTopRightRadius: 10,
} as const;

/** A flat offset shadow, as a sheet of paper lying on another: no blur. */
export const lift = {
  shadowColor: colors.text,
  shadowOffset: { height: 2, width: 2 },
  shadowOpacity: 0.14,
  shadowRadius: 0,
} as const;

/** The ink line around cards, fields, and buttons. */
export const ink = { borderColor: colors.borderStrong, borderWidth: 1.5 } as const;

/** Type sizes; the base is a desktop app's 14 points. */
export const fontSizes = { base: 14, lg: 16, md: 13, sm: 12, title: 20, xl: 18, xs: 11 } as const;

/**
 * The system's own fonts for everything read, and Caveat's handwriting for headings and margin notes only. `hand`
 * names the face `App` loads with expo-font.
 */
export const fonts = {
  hand: "Caveat_700Bold",
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
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
