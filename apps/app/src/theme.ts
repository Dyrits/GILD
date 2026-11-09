import type { MissionState, ThreadState } from "@gild/contracts";

/** The guild board palette: parchment, leather, gilt, and state colors. */
export const colors = {
  accent: "#3a68b8",
  accentSoft: "#dfe6f1",
  accentText: "#295494",
  border: "#c9b07a",
  borderStrong: "#2b1d12",
  canvas: "#f8edd2",
  control: "#f8edd2",
  controlActive: "#e2cf9f",
  controlHover: "#e9d8ae",
  danger: "#9e2a22",
  dangerSoft: "#f6e0da",
  dangerText: "#9c3424",
  frame: "#e9d8ae",
  gold: "#b8862b",
  goldHi: "#e2b85a",
  leather: "#3b1f1a",
  /** The highlighter stroke behind Attention. */
  marker: "#f0c7b4",
  onAccent: "#f8edd2",
  onWood: "#ead8b0",
  /** The page behind panels and cards. */
  paper: "#f1e3c2",
  placeholder: "#887354",
  success: "#4b7a3a",
  successSoft: "#e2eee3",
  successText: "#356846",
  surface: "#ead9b1",
  text: "#2b1d12",
  textDim: "#887354",
  textMuted: "#756047",
  textSecondary: "#58442d",
  violet: "#6a4a9c",
  violetSoft: "#e9e5f4",
  warning: "#b8862b",
  warningSoft: "#fff8dc",
  warningText: "#8a5a00",
  wood: "#3a2819",
} as const;

/** Corner radii, from small controls to the main panel. */
export const radii = { lg: 8, md: 4, pill: 999, sm: 3, xl: 10 } as const;

/** A hand-cut corner: four slightly different radii, so a box looks cut with scissors rather than drawn by a machine. */
export const cut = {
  borderBottomLeftRadius: 7,
  borderBottomRightRadius: 4,
  borderTopLeftRadius: 3,
  borderTopRightRadius: 9,
} as const;

/** A flat offset shadow, as a sheet of paper lying on another: no blur. */
export const lift = {
  shadowColor: colors.text,
  shadowOffset: { height: 2, width: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
} as const;

/** The ink line around cards, fields, and buttons. */
export const ink = { borderColor: colors.gold, borderWidth: 1.5 } as const;

/** Type sizes; the base is a desktop app's 14 points. */
export const fontSizes = { base: 14, lg: 16, md: 13, sm: 12, title: 20, xl: 18, xs: 11 } as const;

/** Bundled guild typefaces, available offline on every platform. */
export const fonts = {
  hand: "Cinzel",
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
  sans: "Alegreya",
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
