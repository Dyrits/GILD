import { Schema } from "effect";
import { AccountId } from "./ids.ts";

// Harnesses and the provider accounts they sign in with (provider-accounts).

/** The harness a thread runs on: Claude Code, Codex, or OpenCode (ADR 0008). */
export const HarnessName = Schema.Literals(["claude", "codex", "opencode"]);
export type HarnessName = typeof HarnessName.Type;

/**
 * The effort a thread runs with, by the provider's own name for the level, such as "low", "xhigh", or OpenCode's
 * "none"; "default" leaves the model's own. The pickers offer only the levels the provider lists for the model.
 */
export const EffortChoice = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(40));
export type EffortChoice = typeof EffortChoice.Type;

/** One model a harness offers, by the identifier the harness takes. */
export const ModelOption = Schema.Struct({
  /**
   * The effort levels the provider offers for this model, lowest first, without "default"; absent or empty when the
   * model takes no effort or the harness does not say, and only the model's own default is offered.
   */
  efforts: Schema.optionalKey(Schema.Array(EffortChoice)),
  id: Schema.String,
  /** Whether the model reads images, when the harness says; absent when it does not (message-attachments). */
  inputsImages: Schema.optionalKey(Schema.Boolean),
  label: Schema.String,
});
export type ModelOption = typeof ModelOption.Type;

/** Whether an account's harness is signed in, as the harness's own status command says. */
export const SignInState = Schema.Literals(["SignedIn", "SignedOut", "Unknown"]);
export type SignInState = typeof SignInState.Type;

/**
 * One account a harness can sign in with: the computer's own sign-in (id null), or one added in Iskios,
 * which keeps its own folder for the harness's sign-in and sessions.
 */
export const AccountStatus = Schema.Struct({
  /** Who the harness says is signed in, such as an email or "ChatGPT", or null when it does not say. */
  detail: Schema.NullOr(Schema.String),
  id: Schema.NullOr(AccountId),
  label: Schema.String,
  signIn: SignInState,
});
export type AccountStatus = typeof AccountStatus.Type;

/** One harness as the pickers and Settings list it. */
export const HarnessInfo = Schema.Struct({
  accounts: Schema.Array(AccountStatus),
  /** The models the harness offers, none when it cannot list them; no entry stands for "the harness's own default". */
  models: Schema.Array(ModelOption),
  name: HarnessName,
  /** Why the harness cannot run, such as not being installed, or null. */
  problem: Schema.NullOr(Schema.String),
  /** The newer version the harness's own release channel offers, or null when it is up to date or the latest is not known. */
  update: Schema.NullOr(Schema.String),
  /** The installed version, or null when it was not found. */
  version: Schema.NullOr(Schema.String),
});
export type HarnessInfo = typeof HarnessInfo.Type;

/** Every harness, in a fixed order. */
export const HarnessList = Schema.Struct({ harnesses: Schema.Array(HarnessInfo) });
export type HarnessList = typeof HarnessList.Type;
