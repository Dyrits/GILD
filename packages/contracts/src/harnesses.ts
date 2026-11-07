import { Schema } from "effect";
import { AccountId } from "./ids.ts";

// Harnesses and the provider accounts they sign in with (provider-accounts).

/** The harness a thread runs on: Claude Code, Codex, or OpenCode (ADR 0008). */
export const HarnessName = Schema.Literals(["claude", "codex", "opencode"]);
export type HarnessName = typeof HarnessName.Type;

/** One model a harness offers, by the identifier the harness takes. */
export const ModelOption = Schema.Struct({ id: Schema.String, label: Schema.String });
export type ModelOption = typeof ModelOption.Type;

/** Whether an account's harness is signed in, as the harness's own status command says. */
export const SignInState = Schema.Literals(["SignedIn", "SignedOut", "Unknown"]);
export type SignInState = typeof SignInState.Type;

/**
 * One account a harness can sign in with: the computer's own sign-in (id null), or one added in Canopy,
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
  /** The harness's own default model is always first, as "default". */
  models: Schema.Array(ModelOption),
  name: HarnessName,
  /** Why the harness cannot run, such as not being installed, or null. */
  problem: Schema.NullOr(Schema.String),
  /** The installed version, or null when it was not found. */
  version: Schema.NullOr(Schema.String),
});
export type HarnessInfo = typeof HarnessInfo.Type;

/** Every harness, in a fixed order. */
export const HarnessList = Schema.Struct({ harnesses: Schema.Array(HarnessInfo) });
export type HarnessList = typeof HarnessList.Type;
