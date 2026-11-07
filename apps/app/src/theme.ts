import type { MissionState, ThreadState } from "@openmission/contracts";

/**
 * The palette, sizes, and radii every screen draws from: a quiet light theme with neutral greys, one blue accent,
 * and soft tinted states, after the look of OpenBot (inspirations; ideas only, no code).
 */
export const colors = {
  accent: "#007cf7",
  accentSoft: "rgba(0, 124, 247, 0.12)",
  accentText: "#0064c8",
  border: "rgba(20, 20, 20, 0.08)",
  borderStrong: "rgba(20, 20, 20, 0.14)",
  canvas: "#ffffff",
  control: "#ffffff",
  controlActive: "#e8e8eb",
  controlHover: "#f0f0f2",
  danger: "#e8222d",
  dangerSoft: "rgba(232, 34, 45, 0.1)",
  dangerText: "#c0141d",
  frame: "#f5f5f6",
  onAccent: "#ffffff",
  placeholder: "#a1a1a6",
  success: "#1fa85a",
  successSoft: "rgba(31, 168, 90, 0.12)",
  successText: "#137a40",
  surface: "#f7f7f8",
  text: "#141414",
  textDim: "#8e8e93",
  textMuted: "#6b6b70",
  textSecondary: "#3a3a3c",
  violet: "#7a5af8",
  violetSoft: "rgba(122, 90, 248, 0.12)",
  warning: "#f08a00",
  warningSoft: "rgba(240, 138, 0, 0.12)",
  warningText: "#9c5200",
} as const;

/** Corner radii, from small controls to the main panel. */
export const radii = { lg: 12, md: 8, pill: 999, sm: 6, xl: 16 } as const;

/** Type sizes; the base is a desktop app's 14 points. */
export const fontSizes = { base: 14, lg: 16, md: 13, sm: 12, title: 20, xl: 18, xs: 11 } as const;

/** The system's own fonts, as a native app uses them. */
export const fonts = {
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
} as const;

/** How each state reads: a dot or text color and the soft fill behind its pill. */
export const stateTones: Record<ThreadState | MissionState, { readonly color: string; readonly soft: string }> = {
  Archived: { color: colors.textMuted, soft: colors.controlActive },
  Attention: { color: colors.warningText, soft: colors.warningSoft },
  Done: { color: colors.successText, soft: colors.successSoft },
  Failed: { color: colors.dangerText, soft: colors.dangerSoft },
  Idle: { color: colors.textMuted, soft: colors.controlActive },
  Running: { color: colors.accentText, soft: colors.accentSoft },
  Stopped: { color: colors.textSecondary, soft: colors.controlActive },
  Waiting: { color: colors.violet, soft: colors.violetSoft },
};
