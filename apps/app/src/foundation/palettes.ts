import type { ColorScheme } from "./colorSchemeRules";
import type { Theme } from "./themeRules";

/**
 * The dark palette, the app's original look: one dark navy, flat surfaces told apart by a slightly lighter or darker
 * step, thin borders, and a single blue accent. State colors are the only others.
 */
const iskiosDark = {
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
export type Palette = { readonly [Name in keyof typeof iskiosDark]: string };

/**
 * The light palette: warm parchment surfaces, ink-navy text, and the same blue accent a step deeper so it reads on
 * light. Surfaces keep the dark palette's order of steps (the cards and fields sit a step above the page).
 */
const iskiosLight: Palette = {
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

/**
 * Gild's dark palette: the guild hall's browns, from the near-black of the window to the warm leather of the cards,
 * with gilt for the accent and parchment for the text.
 */
const gildDark: Palette = {
  accent: "#f0a81c",
  accentSoft: "#4a2f12",
  accentText: "#f6c25a",
  border: "#4a2a14",
  borderStrong: "#6b3f1c",
  bubble: "#35190e",
  bubbleUser: "#4a2612",
  canvas: "#321a0f",
  control: "#391d11",
  controlActive: "#573117",
  controlHover: "#442211",
  cornerButton: "#f3dcae",
  danger: "#d8503a",
  dangerSoft: "#4a1c16",
  dangerText: "#f08a70",
  edge: "#7a4a1c",
  frame: "#391d11",
  ground: "#170804",
  highlight: "#f1d9a6",
  marker: "#4d3418",
  onAccent: "#2a1305",
  onGround: "#d9b98a",
  page: "#2b150c",
  placeholder: "#8a6a47",
  shadow: "#000",
  sidebar: "#22100a",
  success: "#58b84a",
  successSoft: "#24391f",
  successText: "#8fd47a",
  surface: "#351b10",
  terminal: "#4a2d18",
  text: "#f6e6c8",
  textDim: "#8a6a47",
  textMuted: "#b9966a",
  textSecondary: "#d6b98a",
  violet: "#a784ee",
  violetSoft: "#33224f",
  warning: "#f0a81c",
  warningSoft: "#4a3216",
  warningText: "#f6c25a",
};

/** Gild's light palette: the former guild board's parchment, leather ink, and gilt. */
const gildLight: Palette = {
  accent: "#8a5a10",
  accentSoft: "#f0dfb0",
  accentText: "#6e4608",
  border: "#d4bd8a",
  borderStrong: "#bfa06a",
  bubble: "#f8edd2",
  bubbleUser: "#ecd9a8",
  canvas: "#f8edd2",
  control: "#f6e9c8",
  controlActive: "#e2cf9f",
  controlHover: "#ebdbb0",
  cornerButton: "#e2cf9f",
  danger: "#9e2a22",
  dangerSoft: "#f6e0da",
  dangerText: "#9c3424",
  edge: "#c9b07a",
  frame: "#f6e9c8",
  ground: "#e2cf9f",
  highlight: "#3b1f1a",
  marker: "#f0c7b4",
  onAccent: "#fbf1d8",
  onGround: "#58442d",
  page: "#f1e3c2",
  placeholder: "#887354",
  shadow: "rgba(255,255,255,0)",
  sidebar: "#ead9b1",
  success: "#4b7a3a",
  successSoft: "#e2eee3",
  successText: "#356846",
  surface: "#f6e9c8",
  terminal: "#e6d6ac",
  text: "#2b1d12",
  textDim: "#887354",
  textMuted: "#756047",
  textSecondary: "#58442d",
  violet: "#6a4a9c",
  violetSoft: "#e9e5f4",
  warning: "#b8862b",
  warningSoft: "#fff8dc",
  warningText: "#8a5a00",
};

/** Every palette: each theme in its dark and its light look. */
export const palettes = {
  gild: { dark: gildDark, light: gildLight },
  iskios: { dark: iskiosDark, light: iskiosLight },
} as const satisfies Record<Theme, Record<ColorScheme, Palette>>;
