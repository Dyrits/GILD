import { join } from "node:path";
import type { HarnessName, ModelChoice, ModelOption, StartingContext } from "@canopy/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { notFound } from "./errors.ts";
import { claudeModels } from "./harnessCatalog.ts";
import { approvalInstructionsOf, positionLineOf, type ThreadPosition, threadInstructionsOf } from "./instructions.ts";
import { contextWindowOf, intelContextOf, intelInstructions } from "./intel.ts";
import { journalContextOf, journalInstructions, openerContextOf, openerMessagesOf, tokensOf } from "./journal.ts";
import { listThreadPermissions } from "./permissions.ts";
import { sandboxProblem } from "./sandbox.ts";
import { readSettings } from "./settings.ts";
import { budgetLineOf } from "./spending.ts";
import { titleOf } from "./titles.ts";
import { prepareWorkingFolder, readThreadWorkspace, ScratchRoot, workingFolderOf } from "./workspaces.ts";

// A thread's starting context (thread-tree, Opening a thread): the system part, the same every turn, and the
// note each turn's message carries. A thread's turns and the warning before a thread opens read the same parts.

/**
 * The share of the context window in percent above which the owner is warned before a thread starts
 * (thread-tree, Opening a thread; CHG-0007). Fixed: the specification does not make it a setting.
 */
export const startingContextWarningPercent = 25;

/** What one turn of a thread starts from: its system part, its note, and where it works. */
export interface TurnContext {
  /** The system part: the working folder and the instructions every thread receives, without titles. */
  readonly context: string;
  readonly cwd: string;
  readonly isInWorkspace: boolean;
  /** What changes turn to turn: the titles, the journal, the opener's messages, intel, and the budget line. */
  readonly note: string;
}

/** A starting context by part, each the text the harness receives. */
interface Sections {
  readonly budget: string | null;
  readonly instructions: string;
  readonly intel: string;
  readonly journal: string;
  readonly openerMessages: string | null;
  readonly position: string;
  readonly workspace: string;
}

/** Whom a starting context is for: a thread, or one about to be opened. */
interface Subject {
  /** The thread whose scope the intel comes from: the thread itself, or the opener of one about to be opened. */
  readonly intelThreadId: string;
  readonly missionId: string;
  readonly openerMessages: string | null;
  readonly position: ThreadPosition;
}

/** Stands in for the id of a thread about to be opened: every id has this length, so the size is the same. */
const unopenedThreadId = "00000000-0000-0000-0000-000000000000";

// Codex and OpenCode list their models only by running (HarnessTools.listModels), so they suggest none.
const catalogModels = {
  claude: claudeModels,
  codex: [],
  opencode: [],
} as const satisfies Record<HarnessName, ReadonlyArray<ModelOption>>;

const readSections = (subject: Subject, workspace: string) =>
  Effect.gen(function* () {
    return {
      budget: yield* budgetLineOf(subject.missionId),
      instructions: [threadInstructionsOf(subject.position), journalInstructions, intelInstructions].join("\n\n"),
      intel: yield* intelContextOf(subject.intelThreadId),
      journal: yield* journalContextOf(subject.missionId),
      openerMessages: openerContextOf(subject.openerMessages),
      position: positionLineOf(subject.position),
      workspace,
    } satisfies Sections;
  });

// The system part stays the same across a session's turns: rewriting it restarts the process and invalidates
// the cache and earlier thinking. What changes turn to turn, titles included (CHG-0058), rides on the note.
const systemPartOf = (sections: Sections) => [sections.workspace, sections.instructions].join("\n\n");

const noteOf = (sections: Sections) =>
  [sections.position, sections.journal, sections.openerMessages, sections.intel, sections.budget]
    .filter((part) => part !== null)
    .join("\n\n");

/** The thread's starting context for its next turn, with its scratch folder made when it has no workspace. */
export const prepareStartingContext = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const scratchRoot = yield* ScratchRoot;
    const [row] = yield* sql<{
      isAside: number;
      missionId: string;
      openerMessages: string | null;
      parentId: string | null;
      parentTitle: string | null;
      title: string;
    }>`
      SELECT t.mission_id AS missionId, t.title, t.parent_id AS parentId, p.title AS parentTitle,
        t.is_aside AS isAside, t.opener_messages AS openerMessages
      FROM threads t LEFT JOIN threads p ON p.id = t.parent_id WHERE t.id = ${threadId}`;
    if (row === undefined) return yield* notFound("No such thread.");
    const workspace = yield* readThreadWorkspace(threadId);
    const folder = yield* prepareWorkingFolder(workspace, join(scratchRoot, row.missionId));
    const position = {
      isAside: row.isAside === 1,
      parent: row.parentId === null ? null : { id: row.parentId, title: row.parentTitle ?? "" },
      threadId,
      title: row.title,
    };
    const subject = { intelThreadId: threadId, missionId: row.missionId, openerMessages: row.openerMessages, position };
    const sections = yield* readSections(subject, folder.context);
    return {
      context: systemPartOf(sections),
      cwd: folder.cwd,
      isInWorkspace: workspace !== null,
      note: noteOf(sections),
    } satisfies TurnContext;
  });

/** The approval rules the harness appends to the system part (instructions.ts), as a thread there gets them. */
const readApprovalInstructions = (threadId: string, isInWorkspace: boolean, harness: HarnessName) =>
  Effect.gen(function* () {
    const { approvalLevel } = yield* readSettings;
    const permissions = yield* listThreadPermissions(threadId);
    // Only Claude Code sandboxes commands, at the default level, where its sandbox can run (claude.ts).
    const isSandboxed = harness === "claude" && approvalLevel === "RiskyOnly" && (yield* sandboxProblem) === null;
    const sentences = permissions.map((permission) => permission.sentence);
    return approvalInstructionsOf(
      { approvalLevel, isInWorkspace, mcpUrl: "", permissions: sentences },
      isSandboxed,
      harness,
    );
  });

/**
 * What a thread the owner opens beneath `parentId` with this request would start with, on the chosen harness
 * (the parent's when null) and model. It has the parent's workspace, the parent's messages since the latest
 * journal entry, and no intel of its own yet, so its intel is the parent's. Skills are not counted until
 * tool-and-skill-loading gives them to threads; the thread tools' own descriptions are not counted either.
 */
export const readStartingContext = (
  parentId: string,
  choice: { readonly harness: HarnessName | null; readonly model: ModelChoice },
  request: string,
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const scratchRoot = yield* ScratchRoot;
    const [parent] = yield* sql<{ harness: HarnessName; missionId: string; title: string }>`
      SELECT harness, mission_id AS missionId, title FROM threads WHERE id = ${parentId}`;
    if (parent === undefined) return yield* notFound("No such thread.");
    const harness = choice.harness ?? parent.harness;
    const workspace = yield* readThreadWorkspace(parentId);
    const folder = yield* workingFolderOf(workspace, join(scratchRoot, parent.missionId));
    const position = {
      isAside: false,
      parent: { id: parentId, title: parent.title },
      threadId: unopenedThreadId,
      title: titleOf(request),
    };
    const openerMessages = yield* openerMessagesOf(parentId);
    const subject = { intelThreadId: parentId, missionId: parent.missionId, openerMessages, position };
    const sections = yield* readSections(subject, folder.context);
    const approvals = yield* readApprovalInstructions(parentId, workspace !== null, harness);
    const parts = {
      budget: sections.budget === null ? 0 : tokensOf(sections.budget),
      instructions: tokensOf(sections.instructions) + tokensOf(approvals),
      intel: tokensOf(sections.intel),
      journal: tokensOf(sections.journal),
      openerMessages: sections.openerMessages === null ? 0 : tokensOf(sections.openerMessages),
      position: tokensOf(sections.position),
      request: tokensOf(request),
      workspace: tokensOf(sections.workspace),
    };
    const tokens = Object.values(parts).reduce((sum, part) => sum + part, 0);
    const windowTokens = contextWindowOf(choice.model);
    return {
      isOverWarning: tokens * 100 > windowTokens * startingContextWarningPercent,
      // Every model counts the same window until each harness reports its own (work-in-progress, Batch 12).
      largerModels: catalogModels[harness]
        .map((option) => option.id)
        .filter((model) => contextWindowOf(model) > windowTokens)
        .toSorted((a, b) => contextWindowOf(b) - contextWindowOf(a)),
      parts,
      tokens,
      warningPercent: startingContextWarningPercent,
      windowTokens,
    } satisfies StartingContext;
  });

/** The refusal of a thread whose starting context is over the warning, in words, or null when it may start. */
export const startingContextRefusalOf = (context: StartingContext) =>
  context.isOverWarning
    ? `Not started: its starting context takes about ${Math.round((context.tokens * 100) / context.windowTokens)}% of the model's context window, over the warning at ${context.warningPercent}%. Choose a model with a larger window, trim intel, or start it anyway.`
    : null;
