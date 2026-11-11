import type { ThreadState } from "@iskios/contracts";

// Ordered from most to least urgent (mission-tracking specification). Done and
// Stopped add no urgency; Idle is the provisional fallback until it is settled.
const urgency: ReadonlyArray<ThreadState> = ["Attention", "Failed", "Running", "Waiting", "Idle"];

/** A quest's state while it is not ended: the most urgent among its threads' states. */
export const workedOutStateOf = (states: ReadonlyArray<string>): ThreadState =>
  urgency.find((state) => states.includes(state)) ?? "Idle";
