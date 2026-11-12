import { readFile } from "node:fs/promises";
import type {
  ApprovalLevel,
  AttachmentMediaType,
  BillingKind,
  EffortChoice,
  HarnessName,
  ModelChoice,
  TokenUsage,
} from "@iskios/contracts";
import { Context, Effect, Schema } from "effect";

/** What a harness reports while a turn runs. */
export type HarnessEvent =
  /** A complete assistant message, to be saved. */
  | {
      readonly _tag: "Reply";
      /** The model that wrote it as the harness names it (such as `claude-sonnet-5-5`), when it reports one. */
      readonly model?: string | null;
      readonly text: string;
      /** What the model call behind this reply used, when the harness reports usage per call; null otherwise. */
      readonly usage?: TokenUsage | null;
    }
  /** The assistant message written so far, never saved. */
  | { readonly _tag: "Draft"; readonly text: string }
  /** A message steered into the running turn was taken in by it (CHG-0039). */
  | { readonly _tag: "Delivered"; readonly messageId: string }
  /**
   * A line for the thread's conversation from the adapter, not the model, saved and shown as handover lines are:
   * such as a harness session that could not be continued (CHG-0208).
   */
  | { readonly _tag: "Notice"; readonly text: string };

/** An image attached to a message, as a harness takes it: the file where the service keeps it. */
export interface ImageAttachment {
  readonly mediaType: AttachmentMediaType;
  readonly name: string;
  readonly path: string;
}

/** A message to steer into a thread's running turn, by its identifier. */
export interface SteeredMessage {
  readonly id: string;
  readonly images: ReadonlyArray<ImageAttachment>;
  readonly text: string;
}

/** What a thread may use in a turn, and how its actions are approved (CHG-0031). */
export interface ThreadAccess {
  readonly approvalLevel: ApprovalLevel;
  /** Whether the thread works in a workspace, whose sandbox may fetch dependencies (CHG-0034). */
  readonly isInWorkspace: boolean;
  /** The thread's own MCP endpoint serving the thread tools, and Claude Code's permission prompt tool (ADR 0005). */
  readonly mcpUrl: string;
  /** The sentences of the standing permissions that apply to the thread. */
  readonly permissions: ReadonlyArray<string>;
  /** The thread tools the thread uses without asking, named as Claude Code lists them (`mcp__iskios__…`). */
  readonly unaskedTools: ReadonlyArray<string>;
}

/** One action a harness asks permission for, named as Claude Code names its tools (`Bash`, `Edit`, …). */
export interface HarnessPrompt {
  /**
   * Set on the question a harness asks before starting in a thread folder that is a link or resolves outside its root
   * (harness/threadFolder.ts): a one-time Allow or Deny for that start, which offers no standing permission and which
   * no standing permission answers. `startsIn` is the folder's real path the harness starts in when allowed (Claude
   * Code, Codex), which the edit check then counts as the thread's folder; null when it runs unsandboxed (OpenCode).
   */
  readonly folderCheck?: { readonly pointsTo: string; readonly startsIn: string | null };
  readonly input: unknown;
  /**
   * Set by an adapter whose harness asks only to go beyond its active sandbox (Codex's escalations): the action
   * would run outside it. Claude Code says so itself with `dangerouslyDisableSandbox` in the input.
   */
  readonly isOutsideSandbox?: boolean;
  /**
   * Set by an adapter running this thread without the sandbox it otherwise runs in, as the owner allowed (OpenCode on
   * a folder that points outside its workspace): the action asks as for a harness no sandbox protects.
   */
  readonly isUnsandboxed?: boolean;
  readonly toolName: string;
}

/**
 * Whether a harness's tool execution runs inside a sandbox it enforces on this computer (sandbox-first autonomy):
 * inside one, an action runs unasked unless it leaves the sandbox; without one, every action it prompts for asks.
 */
export type Containment = "Sandboxed" | "Unprotected";

/** The owner's answer to a harness prompt: whether the action may run, and what to tell the harness otherwise. */
export interface PromptAnswer {
  readonly isAllowed: boolean;
  readonly text: string;
}

/** Everything one turn of a thread needs from Iskios. */
export interface TurnRequest {
  readonly access: ThreadAccess;
  /**
   * Asks the owner, through Approvals, about one action the harness wants to run, waiting with no time limit
   * (action-approval). A failure to answer ends the turn.
   */
  readonly askOwner: (prompt: HarnessPrompt) => Effect.Effect<PromptAnswer, HarnessFailure>;
  /**
   * The provider account's own folder, where the harness keeps its sign-in and sessions, or null for the
   * harness's own sign-in on this computer (provider-accounts).
   */
  readonly configDirectory: string | null;
  /** The starting context: the thread's workspace, or its scratch folder, with the folder's own instructions. */
  readonly context: string;
  /**
   * Reads the thread's conversation before this turn, as a handover gives it to a session that starts with none
   * (work/handover.ts readConversationSoFar); null when there is none. Read only when asked: a session OpenCode opens
   * in place of one it could not load is given it.
   */
  readonly conversationSoFar: Effect.Effect<string | null>;
  readonly cwd: string;
  readonly effort: EffortChoice;
  /**
   * The folder `cwd` must lie in: the workspace's own folder for a thread in a workspace (then `cwd` itself, stored
   * by its real path), or the scratch root for a thread in its mission's scratch folder.
   */
  readonly folderRoot: string;
  readonly harness: HarnessName;
  /** The images attached to the turn's messages, in order (message-attachments). */
  readonly images: ReadonlyArray<ImageAttachment>;
  readonly model: ModelChoice;
  /**
   * What changes from turn to turn, such as the budget line, given with the turn's message rather than
   * in the starting context, so a change does not restart the harness; null when there is none.
   */
  readonly note: string | null;
  readonly onEvent: (event: HarnessEvent) => Effect.Effect<void>;
  /** The harness session to continue, or null for the thread's first turn. */
  readonly sessionId: string | null;
  readonly text: string;
  readonly threadId: string;
}

/** How a turn ended, with what it cost. */
export interface TurnOutcome {
  /** How the turn was billed; `Unknown` when the harness cannot tell (budget-control, Billing kind). */
  readonly billing: BillingKind;
  /**
   * What the thread's context held after the turn's latest model call (input, cached input, and output
   * tokens), for the context gauge (thread-panel); absent or null when the harness did not report it.
   */
  readonly context?: number | null;
  /**
   * The turn's API-key cost when the harness reports one; null counts the turn's tokens as subscription
   * spending (budget-control, Budgets; provisional, work-in-progress Batch 11).
   */
  readonly cost: number | null;
  /** Whether the turn ended because it was interrupted (thread-messaging, Interruptions). */
  readonly isInterrupted: boolean;
  readonly sessionId: string;
  /** Null when the harness reported no usage; shown as unknown, never guessed. */
  readonly usage: TokenUsage | null;
}

/** How long a harness has to end an interrupted turn before its process is closed (CHG-0039, provisional). */
export const interruptGraceMillis = 10_000;

/** The outcome of an interrupted turn: its usage when the harness reported any, and never a cost. */
export const interruptedOutcomeOf = (sessionId: string, usage: TokenUsage | null = null): TurnOutcome => ({
  billing: "Unknown",
  cost: null,
  isInterrupted: true,
  sessionId,
  usage,
});

/** A turn the harness could not run, with the reason the owner reads. */
export class HarnessFailure extends Schema.TaggedError<HarnessFailure>()("HarnessFailure", { reason: Schema.String }) {}

/** One plan limit as a harness reports it: a window of so many minutes, how much is used, and when it resets (seconds). */
export interface PlanLimitReport {
  readonly resetsAtSeconds: number;
  readonly usedPercent: number;
  readonly windowMinutes: number;
}

/**
 * What a harness reports of the plan behind an account: how it is billed, and the limits of a subscription (none for
 * an API key). Never read with a token or credential: the harness's own tool answers (requirements, Comply with provider terms).
 */
export interface PlanLimitsReport {
  readonly billing: BillingKind;
  readonly windows: ReadonlyArray<PlanLimitReport>;
}

/** What one harness adapter offers: one turn of a thread at a time, which can be steered and interrupted. */
export interface HarnessAdapter {
  /**
   * Whether the harness runs its tools inside an enforced sandbox here. Left out, a harness counts as unprotected, so
   * its prompts ask.
   */
  readonly containmentOf?: (harness: HarnessName) => Containment;
  /** Ends the thread's running turn, whose `runTurn` then returns as interrupted; false when none runs. */
  readonly interrupt: (threadId: string) => Effect.Effect<boolean>;
  /**
   * Asks the harness's own tool for the limits of the plan behind an account (null: the computer's own sign-in): null
   * when this harness reports none, and a failure when it could not answer, which the caller waits out before asking again.
   */
  readonly readPlanLimits: (
    harness: HarnessName,
    configDirectory: string | null,
  ) => Effect.Effect<PlanLimitsReport | null, HarnessFailure>;
  readonly runTurn: (request: TurnRequest) => Effect.Effect<TurnOutcome, HarnessFailure>;
  /**
   * Writes a message into the thread's running turn; false when no turn runs or the harness cannot take one
   * mid-turn. Its `Delivered` event follows once the turn takes it in; one not taken in by the turn's end is
   * left for the next turn.
   */
  readonly steer: (threadId: string, message: SteeredMessage) => Effect.Effect<boolean>;
}

/** The harness seam: runs one turn of a thread, reports its events, and lets it be steered and interrupted. */
export class Harness extends Context.Service<Harness, HarnessAdapter>()("iskios/Harness") {}

/**
 * Sends each turn to the adapter of its thread's harness, and steering and interrupts to the adapter running
 * that thread's turn (provider-accounts).
 */
export const routeHarnesses = (adapters: Record<HarnessName, HarnessAdapter>): HarnessAdapter => {
  const running = new Map<string, HarnessAdapter>();
  return {
    containmentOf: (harness) => adapters[harness].containmentOf?.(harness) ?? "Unprotected",
    interrupt: (threadId) => running.get(threadId)?.interrupt(threadId) ?? Effect.succeed(false),
    readPlanLimits: (harness, configDirectory) => adapters[harness].readPlanLimits(harness, configDirectory),
    runTurn: (request) =>
      Effect.suspend(() => {
        const adapter = adapters[request.harness];
        running.set(request.threadId, adapter);
        return adapter.runTurn(request);
      }).pipe(Effect.ensuring(Effect.sync(() => running.delete(request.threadId)))),
    steer: (threadId, message) => running.get(threadId)?.steer(threadId, message) ?? Effect.succeed(false),
  };
};

/** The images' bytes, base64, for a harness that takes them inline; a file that cannot be read fails the turn with the reason. */
export const readImages = (images: ReadonlyArray<ImageAttachment>) =>
  Effect.tryPromise({
    catch: (error) => new HarnessFailure({ reason: `Could not read an attached image: ${String(error)}` }),
    try: () =>
      Promise.all(
        images.map(async (image) => ({
          data: (await readFile(image.path)).toString("base64"),
          mediaType: image.mediaType,
        })),
      ),
  });

/** The turn's message as the harness receives it: the note (journal, lore, budget) first, set off from the messages. */
export const turnMessageOf = (request: TurnRequest) =>
  request.note === null ? request.text : `${request.note}\n\n---\n\n${request.text}`;
