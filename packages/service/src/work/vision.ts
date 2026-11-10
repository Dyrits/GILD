import { join } from "node:path";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { HarnessTools, harnessLabels, type Runner } from "../harness/index.ts";
import { AccountsRoot } from "./threads.ts";

// Whether a runner reads images (message-attachments): the service refuses a message with images for one that
// does not, instead of letting the harness drop them without a word.

/**
 * Why the runner cannot read images, or null when it can or nothing says it cannot. Claude Code reads them; Codex
 * lists each model's input kinds, and its own default is the first it lists; OpenCode's agent advertises images
 * but says nothing per model, so an unlisted or unknown model is allowed.
 */
export const imageRefusalOf = (runner: Pick<Runner, "accountId" | "harness" | "model">) =>
  Effect.gen(function* () {
    if (runner.harness !== "codex") return null;
    const tools = yield* HarnessTools;
    const accountsRoot = yield* AccountsRoot;
    const models = yield* tools.listModels(
      "codex",
      runner.accountId === null ? null : join(accountsRoot, runner.accountId),
    );
    const model = runner.model === "default" ? models[0] : models.find((option) => option.id === runner.model);
    return model?.inputsImages === false
      ? `${harnessLabels.codex} ${model.label} cannot read images. Choose a Companion that can, or send the message without them.`
      : null;
  });

/** The runner of a thread, or null when the thread is gone. */
export const readThreadRunner = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql<
      Pick<Runner, "accountId" | "harness" | "model">
    >`SELECT account_id AS accountId, harness, model FROM threads WHERE id = ${threadId} AND is_deleting = 0`;
    return row ?? null;
  });
