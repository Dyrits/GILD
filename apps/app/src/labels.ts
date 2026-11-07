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
} from "@canopy/contracts";

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
  [
    `Request ${tokenCountOf(parts.request)}`,
    `Journal ${tokenCountOf(parts.journal)}`,
    `Intel ${tokenCountOf(parts.intel)}`,
    `Opener's messages ${tokenCountOf(parts.openerMessages)}`,
    `Workspace ${tokenCountOf(parts.workspace)}`,
    `Instructions ${tokenCountOf(parts.instructions)}`,
    `Title and budget ${tokenCountOf(parts.position + parts.budget)} tokens`,
  ].join(" · ");

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
export const intelActionOf = (change: Pick<IntelChange, "kind" | "previousText" | "scopeLabel" | "text">) => {
  const scope = change.scopeLabel;
  const actions = {
    Forget: `Delete intel from ${scope}`,
    Replace: `Replace intel in ${scope}`,
    Save: `Save intel to ${scope}`,
    // An update that keeps the text only moves the intel.
    Update: change.previousText === change.text ? `Move intel to ${scope}` : `Correct intel in ${scope}`,
  } satisfies Record<IntelChange["kind"], string>;
  return actions[change.kind];
};

/** What an intel rests on, for the panel, for example "From journal entry 4: Chose Effect."; null when none. */
export const intelOriginLabelOf = (origin: IntelOrigin | null) => {
  if (origin === null) return null;
  if (origin.kind === "JournalEntry") return `From journal entry ${origin.entryNumber ?? ""}: ${origin.excerpt}`;
  if (origin.from === null) return `From your message: ${origin.excerpt}`;
  return `From a message by "${origin.from}": ${origin.excerpt}`;
};

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

/** A share as a short percentage, "<0.1" for a share too small to show but not nothing. */
const percentOf = (part: number, whole: number) => {
  const percent = (part * 100) / whole;
  if (percent === 0) return "0";
  if (percent < 0.1) return "<0.1";
  return percent.toFixed(1);
};

/** The intel icon's text: the count and its share of the model's context window, for example "Intel · 3 · 0.2%". */
export const intelGaugeLabelOf = (gauge: Pick<IntelGauge, "count" | "tokens" | "windowTokens">) => {
  return `Intel · ${gauge.count} · ${percentOf(gauge.tokens, gauge.windowTokens)}%`;
};

/** How often threads used an intel, for example "used 3 times". */
const usesLabelOf = (uses: number) => {
  if (uses === 0) return "not used yet";
  if (uses === 1) return "used once";
  return `used ${uses} times`;
};

/** An intel's fading in the panel, for example "Preference · active · strength 82% · used 3 times · pinned". */
export const intelFadingLabelOf = (intel: Pick<Intel, "isPinned" | "kind" | "state" | "strength" | "uses">) =>
  [
    intel.kind,
    intel.state.toLowerCase(),
    `strength ${Math.round(intel.strength * 100)}%`,
    usesLabelOf(intel.uses),
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

/** Who made a change in an intel's history, as its line names them. */
const intelActorLabelOf = (entry: Pick<IntelHistoryEntry, "actor" | "actorTitle">) => {
  const actors = {
    Fading: "fading",
    Owner: "you",
    Thread: `"${entry.actorTitle ?? "a thread"}"`,
  } satisfies Record<IntelHistoryEntry["actor"], string>;
  return actors[entry.actor];
};

/** What a change in an intel's history did and who did it, for example "Widened to Global by you". */
const intelHistoryActionOf = (
  entry: Pick<IntelHistoryEntry, "actor" | "actorTitle" | "kind" | "scopeLabel" | "undid">,
) => {
  const verb = intelHistoryVerbs[entry.kind];
  const who = intelActorLabelOf(entry);
  if (entry.kind === "Undone") return `You undid: ${intelHistoryVerbs[entry.undid ?? "Saved"].toLowerCase()}`;
  if (entry.kind === "Replaced") return `${verb} from ${who}`;
  if (entry.kind === "Widened" || entry.kind === "Narrowed") return `${verb} to ${entry.scopeLabel} by ${who}`;
  return `${verb} by ${who}`;
};

/**
 * One entry of an intel's history as a line in the panel, for example 'Saved by "Build" · approved by you',
 * "Became dormant by fading", or "You undid: deleted" (scoped-intel, History and undo).
 */
export const intelHistoryLineOf = (
  entry: Pick<IntelHistoryEntry, "actor" | "actorTitle" | "approvedAt" | "kind" | "scopeLabel" | "undid" | "undoneAt">,
) =>
  [
    intelHistoryActionOf(entry),
    ...(entry.approvedAt === null ? [] : ["approved by you"]),
    ...(entry.undoneAt === null ? [] : ["undone"]),
  ].join(" · ");

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
