import type { WorkspaceId } from "@iskios/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import type { ToolAnswer } from "../core/index.ts";
import { changed, unchanged, type WithFollowUps } from "./commands.ts";
import { isGuildmasterThread } from "./guildmaster.ts";
import { consumeReceipt, notAuthorizedText } from "./guildmasterProvenance.ts";
import { checkRealmCreation, checkRealmRename } from "./realmChecks.ts";
import type { ArgumentsOf } from "./threadTools.ts";
import { createRealm, renameRealm } from "./workspaces.ts";

// Iskios's realm tools (quest coordination, CHG-0174): it makes a realm and renames one once the exact action is
// authorized by provenance (guildmasterProvenance.ts, CHG-0208). Only Iskios calls them, and never on its own.

const refused = (text: string): WithFollowUps<ToolAnswer> => unchanged({ isError: true, text });
const done = (text: string): WithFollowUps<ToolAnswer> => changed({ isError: false, text });

const countRealms = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<{ total: number }>`SELECT count(*) AS total FROM workspaces`;
  return row?.total ?? 0;
});

/** `create_realm`: makes a realm, tied to a folder or to none; refused for a name or a folder that a realm already has. */
export const createRealmByGuildmaster = (callerId: string, args: ArgumentsOf<"create_realm">) =>
  Effect.gen(function* () {
    if (!(yield* isGuildmasterThread(callerId))) return refused("Only Iskios makes realms here.");
    const checked = yield* checkRealmCreation(args);
    if (checked._tag === "Refused") return refused(checked.text);
    const { folder, name } = checked;
    if (!(yield* consumeReceipt(callerId, "create_realm", args))) return refused(notAuthorizedText);
    const before = yield* countRealms;
    // The realm rules decide last which folder is the realm's: a folder that already has a realm keeps it, whatever
    // name is given, and nothing is made then.
    yield* createRealm(folder, name, null);
    if ((yield* countRealms) === before)
      return refused(`Not done: the folder ${folder} already belongs to a realm. Rename that realm instead.`);
    return done(
      `Made the realm "${name}" ${folder === null ? "tied to no folder" : `tied to ${folder}`}. Tell the owner in a sentence.`,
    );
  }).pipe(
    // A failure of the realm rules, such as a folder that does not exist, comes back to Iskios as a refusal.
    Effect.catchTag("ServiceFailure", (failure) => Effect.succeed(refused(`Not done: ${failure.message}`))),
  );

/** `rename_realm`: renames a realm; refused for an unknown realm or a name another realm has. */
export const renameRealmByGuildmaster = (callerId: string, args: ArgumentsOf<"rename_realm">) =>
  Effect.gen(function* () {
    if (!(yield* isGuildmasterThread(callerId))) return refused("Only Iskios renames realms here.");
    const checked = yield* checkRealmRename(args);
    if (checked._tag === "Refused") return refused(checked.text);
    if (!(yield* consumeReceipt(callerId, "rename_realm", args))) return refused(notAuthorizedText);
    yield* renameRealm(checked.realm.id as WorkspaceId, checked.name);
    return done(`Renamed the realm "${checked.realm.name}" to "${checked.name}".`);
  }).pipe(
    // A failure of the realm rules, such as a folder that does not exist, comes back to Iskios as a refusal.
    Effect.catchTag("ServiceFailure", (failure) => Effect.succeed(refused(`Not done: ${failure.message}`))),
  );
