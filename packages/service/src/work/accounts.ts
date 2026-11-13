import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { AccountId, AccountStatus, HarnessInfo, HarnessList, HarnessName } from "@iskios/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, notFound } from "../core/index.ts";
import { HarnessTools, harnessLabels, harnessNames, type SignInStatus } from "../harness/index.ts";
import { ownAccountLabelOf } from "../remote/index.ts";
import { AccountsRoot } from "./threads.ts";

// Provider accounts (provider-accounts): each harness's own sign-in on this computer, and accounts the owner
// adds, each with its own folder where the harness keeps that account's sign-in and sessions.

interface AccountRow {
  readonly harness: HarnessName;
  readonly id: string;
  readonly label: string;
}

/** An added account's folder. */
const accountFolderOf = (accountsRoot: string, accountId: string) => join(accountsRoot, accountId);

/** One harness with its accounts' sign-ins, each account's own models, and the models its first signed-in account offers. */
const readHarness = (harness: HarnessName, rows: ReadonlyArray<AccountRow>) =>
  Effect.gen(function* () {
    const tools = yield* HarnessTools;
    const accountsRoot = yield* AccountsRoot;
    const installation = yield* tools.inspect(harness);
    const ownLabel = yield* ownAccountLabelOf(harness);
    const listed = [
      { configDirectory: null, id: null, label: ownLabel },
      ...rows
        .filter((row) => row.harness === harness)
        .map((row) => ({
          configDirectory: accountFolderOf(accountsRoot, row.id),
          id: row.id as AccountId,
          label: row.label,
        })),
    ];
    // An uninstalled harness reports nothing: every account reads as unknown.
    const accounts = yield* Effect.forEach(
      listed,
      (account) =>
        (installation.problem === null
          ? tools.readSignIn(harness, account.configDirectory)
          : Effect.succeed({ detail: null, signIn: "Unknown" } satisfies SignInStatus)
        ).pipe(
          Effect.map((status): AccountStatus & { configDirectory: string | null } => ({
            ...status,
            configDirectory: account.configDirectory,
            id: account.id,
            label: account.label,
          })),
        ),
      { concurrency: "unbounded" },
    );
    const signedIn = accounts.find((account) => account.signIn === "SignedIn") ?? accounts[0];
    const models =
      installation.problem === null ? yield* tools.listModels(harness, signedIn?.configDirectory ?? null) : [];
    // Each account's own list, read at once and kept per account; a signed-out account lists none.
    const accountModels = yield* Effect.forEach(
      accounts,
      (account) =>
        installation.problem !== null || account.signIn === "SignedOut"
          ? Effect.succeed(undefined)
          : tools.listModels(harness, account.configDirectory),
      { concurrency: "unbounded" },
    );
    const update = installation.problem === null ? yield* tools.findUpdate(harness, installation.version) : null;
    return {
      accounts: accounts.map(({ configDirectory: _, ...account }, index) => {
        const own = accountModels[index];
        return own === undefined ? account : { ...account, models: own };
      }),
      models,
      name: harness,
      problem: installation.problem,
      update,
      version: installation.version,
    } satisfies HarnessInfo;
  });

/** The effort levels the provider offers for one model under an account's sign-in (ListModelEfforts). */
export const listModelEfforts = (harness: HarnessName, accountId: AccountId | null, model: string) =>
  Effect.gen(function* () {
    const tools = yield* HarnessTools;
    const accountsRoot = yield* AccountsRoot;
    if (accountId !== null) {
      const sql = yield* SqlClient.SqlClient;
      const [account] = yield* sql<{ harness: string }>`SELECT harness FROM accounts WHERE id = ${accountId}`;
      if (account?.harness !== harness) return yield* notFound(`No such ${harnessLabels[harness]} account.`);
    }
    return yield* tools.listEfforts(
      harness,
      accountId === null ? null : accountFolderOf(accountsRoot, accountId),
      model,
    );
  });

/** Every harness, with its accounts and models (ListHarnesses). */
export const listHarnesses = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<AccountRow>`SELECT id, harness, label FROM accounts ORDER BY created_at, rowid`;
  const harnesses = yield* Effect.forEach(harnessNames, (harness) => readHarness(harness, rows), {
    concurrency: "unbounded",
  });
  return { harnesses } satisfies HarnessList;
});

/** Updates a harness through its own update command; refused when it is not installed. */
export const updateHarness = (harness: HarnessName) =>
  Effect.gen(function* () {
    const tools = yield* HarnessTools;
    const installation = yield* tools.inspect(harness);
    if (installation.problem !== null) return yield* invalid(installation.problem);
    yield* tools.update(harness);
  });

/** Installs a missing harness and verifies that its configured executable can run. */
export const installHarness = Effect.fn("installHarness")(function* (harness: HarnessName) {
  const tools = yield* HarnessTools;
  const before = yield* tools.inspect(harness);
  if (before.problem === null)
    return yield* invalid(`${harnessLabels[harness]} is already installed. Use Update instead.`);
  yield* tools.install(harness);
  const after = yield* tools.inspect(harness);
  if (after.problem !== null)
    return yield* invalid(
      `Installation finished, but ${after.problem} Check your PATH or configured harness path, then press Refresh.`,
    );
});

const readAccount = (accountId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql<AccountRow>`SELECT id, harness, label FROM accounts WHERE id = ${accountId}`;
    if (row === undefined) return yield* notFound("No such account.");
    return row;
  });

const trimmedLabel = (label: string) =>
  label.trim() === "" ? invalid("Give the account a name.") : Effect.succeed(label.trim());

/** Adds an account with its own empty folder; it is signed out until the owner signs in. */
export const addAccount = (harness: HarnessName, label: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const accountsRoot = yield* AccountsRoot;
    const name = yield* trimmedLabel(label);
    const id = crypto.randomUUID();
    const now = yield* Clock.currentTimeMillis;
    yield* Effect.sync(() => mkdirSync(accountFolderOf(accountsRoot, id), { recursive: true }));
    yield* sql`INSERT INTO accounts (id, harness, label, created_at) VALUES (${id}, ${harness}, ${name}, ${now})`;
    return id;
  });

/** Gives a provider account a new label the owner reads it by. */
export const renameAccount = (accountId: string, label: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* readAccount(accountId);
    const name = yield* trimmedLabel(label);
    yield* sql`UPDATE accounts SET label = ${name} WHERE id = ${accountId}`;
  });

/** Names a harness's own sign-in on this computer apart from the computer's name; a blank name returns it to the computer's. */
export const renameOwnAccount = (harness: HarnessName, label: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const name = label.trim();
    if (name === "") return yield* sql`DELETE FROM own_account_labels WHERE harness = ${harness}`;
    yield* sql`INSERT INTO own_account_labels (harness, label) VALUES (${harness}, ${name})
      ON CONFLICT (harness) DO UPDATE SET label = excluded.label`;
  });

/**
 * Removes an account and its folder, with the sign-in and sessions the harness kept there. Refused while a
 * mission that is not ended has a thread on it, whose conversation lives in that folder.
 */
export const removeAccount = (accountId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const accountsRoot = yield* AccountsRoot;
    const account = yield* readAccount(accountId);
    const [use] = yield* sql<{ count: number }>`
      SELECT COUNT(*) AS count FROM threads t JOIN missions m ON m.id = t.mission_id
      WHERE t.account_id = ${accountId} AND m.ending IS NULL AND t.is_deleting = 0`;
    if ((use?.count ?? 0) > 0)
      return yield* invalid(
        `Not removed: ${use?.count} thread(s) in missions not yet ended run on "${account.label}". End or archive those missions first.`,
      );
    yield* sql`DELETE FROM account_budgets WHERE account_id = ${accountId}`;
    yield* sql`DELETE FROM accounts WHERE id = ${accountId}`;
    yield* Effect.sync(() => rmSync(accountFolderOf(accountsRoot, accountId), { force: true, recursive: true }));
  });

/** Opens the harness's own sign-in for the account, or for the computer's own sign-in when null. */
export const signInAccount = (harness: HarnessName, accountId: string | null) =>
  Effect.gen(function* () {
    const tools = yield* HarnessTools;
    const accountsRoot = yield* AccountsRoot;
    if (accountId !== null) {
      const account = yield* readAccount(accountId);
      if (account.harness !== harness)
        return yield* invalid(`That account is not a ${harnessLabels[harness]} account.`);
    }
    yield* tools.openSignIn(harness, accountId === null ? null : accountFolderOf(accountsRoot, accountId));
  });
