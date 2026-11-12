import type { PlanLimitWindow } from "@iskios/contracts";
import { meterLevelOf } from "../foundation/labels";

/** One window of a plan's limit drawn as a ring: where it sits, how much of it is filled, and how full it is. */
export type Ring = {
  readonly circumference: number;
  /** The part of the circumference that is filled, from 0 to the whole: the share of the window that is left. */
  readonly filled: number;
  readonly level: "normal" | "warning" | "reached";
  readonly radius: number;
  readonly window: PlanLimitWindow;
};

/** The rings of a plan's windows, the longest-lasting outermost, and the room left in the middle for the logo. */
export type RingStack = { readonly logoSize: number; readonly rings: readonly Ring[] };

const logoMargin = 3;

/**
 * A reading's windows as they stand at `now`: a window whose reset time has passed has started over, so it reads as
 * unused until the next reading says otherwise.
 */
export const currentWindowsOf = (windows: readonly PlanLimitWindow[], now: number): PlanLimitWindow[] =>
  windows.map((window) => (window.resetsAt <= now ? { ...window, usedPercent: 0 } : window));

/**
 * Lays a plan's windows out as concentric rings in a square of `size` points: the window that resets last is the
 * outer ring and the one that resets first the inner, as in a 5-hour ring inside a weekly ring. A ring shows what is
 * left, as the hover card does: full when nothing is used, empty at the limit. A used share is kept between 0 and 100.
 */
export const ringStackOf = (
  windows: readonly PlanLimitWindow[],
  size: number,
  stroke: number,
  gap: number,
): RingStack => {
  const outward = [...windows].sort((a, b) => b.resetsAt - a.resetsAt);
  const rings = outward.map((window, index): Ring => {
    const radius = size / 2 - stroke / 2 - index * (stroke + gap);
    const circumference = 2 * Math.PI * radius;
    const share = 100 - Math.min(100, Math.max(0, window.usedPercent));
    return {
      circumference,
      filled: (circumference * share) / 100,
      level: meterLevelOf(window.usedPercent, 100),
      radius,
      window,
    };
  });
  const innermost = rings.at(-1)?.radius ?? size / 2;
  return { logoSize: Math.max(0, 2 * (innermost - stroke / 2 - logoMargin)), rings };
};

const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;

/** How long until a window starts over, in its two largest units, for example "4h 57m" or "6d 9h"; "reset" once it has. */
export const resetsInTextOf = (millis: number): string => {
  if (millis <= 0) return "reset";
  if (millis >= day) return `${Math.floor(millis / day)}d ${Math.floor((millis % day) / hour)}h`;
  if (millis >= hour) return `${Math.floor(millis / hour)}h ${Math.floor((millis % hour) / minute)}m`;
  return `${Math.max(1, Math.floor(millis / minute))}m`;
};

/** What a window has left, from 0 to 100 percent; a used share outside 0 to 100 is kept inside. */
export const leftPercentOf = (window: PlanLimitWindow): number =>
  Math.round(100 - Math.min(100, Math.max(0, window.usedPercent)));
