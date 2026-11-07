import type {
  BudgetLimits,
  Intel,
  IntelChange,
  IntelChangeStatus,
  IntelGauge,
  IntelHistoryEntry,
  IntelHistoryKind,
  IntelOrigin,
  IntelProposal,
  StartingContext,
  StartingContextParts,
  SuggestionOutcome,
} from "@openmission/contracts";

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

/** A token count rounded, with thousands separators, for example "12,000". */
export const tokenCountOf = (tokens: number) => countOf(Math.round(tokens));

/** The briefing's estimated size against its limit, for example "About 120 of 2,000 tokens". */
export const briefingSizeOf = (tokens: number, limit: number) =>
  `About ${countOf(tokens)} of ${countOf(limit)} tokens${tokens > limit ? ": over the limit" : ""}`;

/** The warning before a thread starts with too large a starting context (thread-tree, Opening a thread). */
export const startingContextWarningOf = (context: StartingContext) =>
  `This thread would start with about ${tokenCountOf(context.tokens)} tokens, ${Math.round((context.tokens * 100) / context.windowTokens)}% of the model's ${countOf(context.windowTokens)}-token context window; the warning is at ${context.warningPercent}%.`;

/** Each part of a starting context with its tokens, for example "Request 100 · Journal 50 · … tokens". */
export const startingContextPartsOf = (parts: StartingContextParts) =>
  `Request ${tokenCountOf(parts.request)} · Journal ${tokenCountOf(parts.journal)} · Intel ${tokenCountOf(parts.intel)} · Opener's messages ${tokenCountOf(parts.openerMessages)} tokens`;

/** A dashboard row's thread count, for example "5 threads · 2 running". */
export const threadCountOf = (mission: { readonly runningCount: number; readonly threadCount: number }) =>
  `${threadsOf(mission.threadCount)}${mission.runningCount === 0 ? "" : ` · ${mission.runningCount} running`}`;

/** What the dashboard asks of a mission (mission-tracking, Ending a mission). */
export const promptQuestionOf = (prompt: "MarkDone" | "Inactive", inactivityDays: number) =>
  prompt === "MarkDone"
    ? "Mark as done?"
    : `No activity for ${inactivityDays === 1 ? "1 day" : `${inactivityDays} days`}. Archive it or mark it as done?`;

/** What the line left behind says about where an off-topic request went (thread-tree, Off-topic requests). */
export const suggestionLabels = {
  Continued: "Continued in mission",
  KeptAsAside: "Kept as aside",
  MovedToMission: "Moved to mission",
  Withdrawn: "Off-topic suggestion withdrawn",
} as const satisfies Record<SuggestionOutcome, string>;

/** How full a budget meter is: orange from 80%, red at 100% (budget-control, Seeing budget use). */
export const meterLevelOf = (spent: number, limit: number): "normal" | "warning" | "reached" =>
  spent >= limit ? "reached" : spent >= limit * 0.8 ? "warning" : "normal";

/** A limit's use in short words, for example "$1.20 of $5.00" or "12,000 of 50,000 tokens". */
export const budgetUseTextOf = (unit: "cost" | "tokens", spent: number, limit: number) =>
  unit === "cost"
    ? `$${spent.toFixed(2)} of $${limit.toFixed(2)}`
    : `${tokenCountOf(spent)} of ${tokenCountOf(limit)} tokens`;

/** The limits raised by a factor, for the quick raises (+25%, +50%, double); an empty limit stays empty. */
export const raisedLimitsOf = (limits: BudgetLimits, factor: number): BudgetLimits => ({
  cost: limits.cost === null ? null : Math.round(limits.cost * factor * 100) / 100,
  tokens: limits.tokens === null ? null : Math.ceil(limits.tokens * factor),
});

/** What a thread's change to intel does, for example "Save intel to Global" (scoped-intel). */
export const intelActionOf = (change: Pick<IntelChange, "kind" | "previousText" | "scopeLabel" | "text">) =>
  change.kind === "Save"
    ? `Save intel to ${change.scopeLabel}`
    : change.kind === "Replace"
      ? `Replace intel in ${change.scopeLabel}`
      : change.kind === "Forget"
        ? `Delete intel from ${change.scopeLabel}`
        : change.previousText === change.text
          ? `Move intel to ${change.scopeLabel}`
          : `Correct intel in ${change.scopeLabel}`;

/** What an intel rests on, for the panel, for example "From journal entry 4: Chose Effect."; null when none. */
export const intelOriginLabelOf = (origin: IntelOrigin | null) =>
  origin === null
    ? null
    : origin.kind === "JournalEntry"
      ? `From journal entry ${origin.entryNumber ?? ""}: ${origin.excerpt}`
      : origin.from === null
        ? `From your message: ${origin.excerpt}`
        : `From a message by "${origin.from}": ${origin.excerpt}`;

const intelStatusLabels = {
  Approved: " · approved",
  Awaiting: " · awaiting your approval",
  Declined: " · declined",
  Done: "",
} as const satisfies Record<IntelChangeStatus, string>;

/** A thread's change to intel as one line in its conversation, for example "Save intel to Global · approved". */
export const intelChangeLineOf = (
  change: Pick<IntelChange, "kind" | "previousText" | "scopeLabel" | "status" | "text">,
) => `${intelActionOf(change)}${intelStatusLabels[change.status]}`;

/** The intel icon's text: the count and its share of the model's context window, for example "Intel · 3 · 0.2%". */
export const intelGaugeLabelOf = (gauge: Pick<IntelGauge, "count" | "tokens" | "windowTokens">) => {
  const percent = (gauge.tokens * 100) / gauge.windowTokens;
  return `Intel · ${gauge.count} · ${percent === 0 ? "0" : percent < 0.1 ? "<0.1" : percent.toFixed(1)}%`;
};

/** An intel's fading in the panel, for example "Preference · active · strength 82% · used 3 times · pinned". */
export const intelFadingLabelOf = (intel: Pick<Intel, "isPinned" | "kind" | "state" | "strength" | "uses">) =>
  [
    intel.kind,
    intel.state.toLowerCase(),
    `strength ${Math.round(intel.strength * 100)}%`,
    intel.uses === 0 ? "not used yet" : intel.uses === 1 ? "used once" : `used ${intel.uses} times`,
    ...(intel.isPinned ? ["pinned"] : []),
  ].join(" · ");

const intelHistoryVerbs = {
  Archived: "Became archived",
  Corrected: "Corrected",
  Deleted: "Deleted",
  Dormant: "Became dormant",
  Edited: "Edited",
  Merged: "Merged into one global intel",
  Narrowed: "Moved",
  Pinned: "Pinned",
  Replaced: "Replaced by a save",
  Restored: "Restored",
  Saved: "Saved",
  Undone: "Undid",
  Unpinned: "Unpinned",
  Widened: "Moved",
} as const satisfies Record<IntelHistoryKind, string>;

/**
 * One entry of an intel's history as a line in the panel, for example 'Saved by "Build" · approved by you',
 * "Became dormant by fading", or "You undid: deleted" (scoped-intel, History and undo).
 */
export const intelHistoryLineOf = (
  entry: Pick<IntelHistoryEntry, "actor" | "actorTitle" | "approvedAt" | "kind" | "scopeLabel" | "undid" | "undoneAt">,
) => {
  const who =
    entry.actor === "Fading" ? "fading" : entry.actor === "Owner" ? "you" : `"${entry.actorTitle ?? "a thread"}"`;
  const verb = intelHistoryVerbs[entry.kind];
  const action =
    entry.kind === "Undone"
      ? `You undid: ${intelHistoryVerbs[entry.undid ?? "Saved"].toLowerCase()}`
      : entry.kind === "Replaced"
        ? `${verb} from ${who}`
        : entry.kind === "Widened" || entry.kind === "Narrowed"
          ? `${verb} to ${entry.scopeLabel} by ${who}`
          : `${verb} by ${who}`;
  return [
    action,
    ...(entry.approvedAt === null ? [] : ["approved by you"]),
    ...(entry.undoneAt === null ? [] : ["undone"]),
  ].join(" · ");
};

/**
 * Why the service proposes a widening or narrowing, and what approving it does, for example "Used only in
 * Workspace alpha for 45 days, 3 times: move it there" (scoped-intel, Widening and narrowing).
 */
export const intelProposalLineOf = (
  proposal: Pick<IntelProposal, "halfLifeDays" | "kind" | "scopeLabel" | "uses"> & {
    readonly intels: ReadonlyArray<unknown>;
  },
) =>
  proposal.kind === "Widen"
    ? `Saved separately in ${proposal.intels.length} workspaces: make it one global intel`
    : `Used only in ${proposal.scopeLabel} for ${proposal.halfLifeDays ?? 0} days, ${
        proposal.uses === 1 ? "once" : `${proposal.uses ?? 0} times`
      }: move it there`;
