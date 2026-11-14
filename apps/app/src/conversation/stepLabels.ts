import type { Activity } from "@iskios/contracts";
import { clockOf } from "../foundation/formatting";

/** A reported call's line, omitting empty fields without changing the target or time. */
export const callTextOf = (activity: Activity, at: number) =>
  ["Ran", activity.summary, activity.detail, clockOf(at)].filter((part) => part !== "").join(" · ");
