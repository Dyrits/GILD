import type { ModelChoice, StartingContext } from "@openmission/contracts";
import { Effect } from "effect";
import { claudeModels } from "./harnessCatalog.ts";
import { contextWindowOf, readIntelSize } from "./intel.ts";
import { openerMessagesOf, readJournalText, tokensOf } from "./journal.ts";

// The starting context of a thread the owner opens (thread-tree, Opening a thread): what it takes of the
// chosen model's context window, measured before the thread starts.

/**
 * The share of the context window in percent above which the owner is warned before a thread starts
 * (thread-tree, Opening a thread; CHG-0007). Fixed: the specification does not make it a setting.
 */
export const startingContextWarningPercent = 25;

/**
 * What a thread opened beneath `parentId` with this request and model would start with. It has the parent's
 * workspace and no intel of its own yet, so its intel is the parent's. Skills are not counted until
 * tool-and-skill-loading gives them to threads.
 */
export const readStartingContext = (parentId: string, model: ModelChoice, request: string) =>
  Effect.gen(function* () {
    const intel = yield* readIntelSize(parentId);
    const openerMessages = yield* openerMessagesOf(parentId);
    const parts = {
      intel: intel.tokens,
      journal: tokensOf(yield* readJournalText(parentId, null, null)),
      openerMessages: openerMessages === null ? 0 : tokensOf(openerMessages),
      request: tokensOf(request),
    };
    const tokens = parts.intel + parts.journal + parts.openerMessages + parts.request;
    const windowTokens = contextWindowOf(model);
    return {
      isOverWarning: tokens * 100 > windowTokens * startingContextWarningPercent,
      // Only Claude Code's models are compared until each harness reports its windows (Batch 12).
      largerModels: claudeModels
        .map((option) => option.id)
        .filter((choice) => contextWindowOf(choice) > windowTokens)
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
