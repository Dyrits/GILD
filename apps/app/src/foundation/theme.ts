import type { MissionState, ThreadState } from "@iskios/contracts";
import { Platform } from "react-native";
import { colorScheme, theme } from "./colorScheme";
import { type Palette, palettes } from "./palettes";

/** The palette in use, fixed for a run by the owner's choices of theme and look (see `colorScheme`). */
export const colors: Palette = palettes[theme][colorScheme];

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
