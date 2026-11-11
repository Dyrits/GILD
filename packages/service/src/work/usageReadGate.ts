// How often a plan's usage may be read (budget-control, Plan limits): a reading stands for four minutes, and after a
// failed read the next waits 5 minutes, then 10, 20, 40, and at most an hour, so a provider's endpoint is never hammered.
// The values follow OpenBot's pacing of the same reads.

const minute = 60_000;

/** When an account's usage was last read, how many reads failed in a row, and when the next may start after a failure. */
export interface GateState {
  readonly failures: number;
  readonly readAt: number | null;
  readonly retryAt: number;
}

/** An account whose usage was never read. */
export const noReadYet: GateState = { failures: 0, readAt: null, retryAt: 0 };

/** How long a reading stands before the next is due. */
const standMillis = 4 * minute;

/** Whether a read may start now: no failure is being waited out and the last reading is old enough. */
export const isReadDue = (state: GateState, now: number) =>
  now >= state.retryAt && (state.readAt === null || now - state.readAt >= standMillis);

/** The state after a successful read. */
export const afterRead = (_state: GateState, now: number): GateState => ({ failures: 0, readAt: now, retryAt: 0 });

/** The state after a failed read: the next waits longer each time, keeping the last reading's time. */
export const afterFailure = (state: GateState, now: number): GateState => {
  const failures = state.failures + 1;
  return { failures, readAt: state.readAt, retryAt: now + Math.min(5 * 2 ** (failures - 1), 60) * minute };
};
