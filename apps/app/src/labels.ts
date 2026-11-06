const threadsOf = (count: number) => (count === 1 ? "1 thread" : `${count} threads`);

/** The mark on a thread that folds agent-opened threads beneath it, for example "+3 threads". */
export const foldedLabelOf = (count: number) => `+${threadsOf(count)}`;

/** The one deletion confirmation: the threads beneath, and the running ones only when some run. */
export const deletionQuestionOf = (preview: { readonly descendantCount: number; readonly runningCount: number }) => {
  const beneath = preview.descendantCount === 0 ? "" : ` and ${threadsOf(preview.descendantCount)} beneath it`;
  const running =
    preview.runningCount === 0
      ? ""
      : preview.descendantCount === 0
        ? " (running)"
        : ` (${preview.runningCount} running)`;
  return `Delete this thread${beneath}${running}?`;
};

/** Who wrote a journal entry, as the Journal view names it. */
export const journalAuthorOf = (entry: {
  readonly authorKind: "thread" | "user";
  readonly authorTitle: string | null;
}) => (entry.authorKind === "user" ? "You" : `Thread "${entry.authorTitle ?? ""}"`);

const countOf = (value: number) => value.toLocaleString("en-US");

/** The briefing's estimated size against its limit, for example "About 120 of 2,000 tokens". */
export const briefingSizeOf = (tokens: number, limit: number) =>
  `About ${countOf(tokens)} of ${countOf(limit)} tokens${tokens > limit ? ": over the limit" : ""}`;

/** A dashboard row's thread count, for example "5 threads · 2 running". */
export const threadCountOf = (mission: { readonly runningCount: number; readonly threadCount: number }) =>
  `${threadsOf(mission.threadCount)}${mission.runningCount === 0 ? "" : ` · ${mission.runningCount} running`}`;

/** What the dashboard asks of a mission (mission-tracking, Ending a mission). */
export const promptQuestionOf = (prompt: "MarkDone" | "Inactive", inactivityDays: number) =>
  prompt === "MarkDone"
    ? "Mark as done?"
    : `No activity for ${inactivityDays === 1 ? "1 day" : `${inactivityDays} days`}. Archive it or mark it as done?`;
