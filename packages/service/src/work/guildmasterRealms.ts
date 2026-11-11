import type { WorkspaceId } from "@iskios/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import type { ToolAnswer } from "../core/index.ts";
import { changed, unchanged, type WithFollowUps } from "./commands.ts";
import { isGuildmasterThread, isQuotedByOwner } from "./guildmaster.ts";
import type { ArgumentsOf } from "./threadTools.ts";
import { createRealm, renameRealm } from "./workspaces.ts";

// Iskios's realm tools (quest coordination, CHG-0174): at the owner's request, which their own quoted words prove, it
// makes a realm and renames one. Only Iskios calls them, and never on its own.

const refused = (text: string): WithFollowUps<ToolAnswer> => unchanged({ isError: true, text });
const done = (text: string): WithFollowUps<ToolAnswer> => changed({ isError: false, text });

/** The words that tell Iskios to ask the owner first, with what it was about to do. */
const askFirst = (doing: string) =>
  `Not done: ${doing} only when the owner asks for it in their latest message. Quote their exact words as quote, or ask them first.`;

/** A realm by its folder or its name, tied to a folder or not (unlike `findRealm`, which only finds tied ones). */
const findRealmOfAnyKind = (given: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const wanted = given.trim();
    const [row] = yield* sql<{ id: string; name: string }>`
      SELECT id, name FROM workspaces WHERE path = ${wanted} OR lower(name) = lower(${wanted})
      ORDER BY created_at LIMIT 1`;
    return row ?? null;
  });

const countRealms = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<{ total: number }>`SELECT count(*) AS total FROM workspaces`;
  return row?.total ?? 0;
});

/** `create_realm`: makes a realm, tied to a folder or to none; refused for a name or a folder that a realm already has. */
export const createRealmByGuildmaster = (callerId: string, args: ArgumentsOf<"create_realm">) =>
  Effect.gen(function* () {
    if (!(yield* isGuildmasterThread(callerId))) return refused("Only Iskios makes realms here.");
    if (!(yield* isQuotedByOwner(callerId, args.quote))) return refused(askFirst("make a realm"));
    const name = args.name.trim();
    if (name === "") return refused("Not done: a realm needs a name.");
    if ((yield* findRealmOfAnyKind(name)) !== null)
      return refused(`Not done: a realm "${name}" already exists. Tell the owner, or pick another name.`);
    const folder = args.folder === undefined || args.folder.trim() === "" ? null : args.folder.trim();
    const before = yield* countRealms;
    // A folder that already has a realm keeps it, whatever name is given: nothing is made then.
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
    if (!(yield* isQuotedByOwner(callerId, args.quote))) return refused(askFirst("rename a realm"));
    const realm = yield* findRealmOfAnyKind(args.realm);
    if (realm === null) return refused(`Not done: no realm "${args.realm}". Name one of the realms in your context.`);
    const name = args.name.trim();
    if (name === "") return refused("Not done: a realm needs a name.");
    const sql = yield* SqlClient.SqlClient;
    const [other] = yield* sql<{ id: string }>`
      SELECT id FROM workspaces WHERE lower(name) = lower(${name}) AND id <> ${realm.id} LIMIT 1`;
    if (other !== undefined) return refused(`Not done: another realm is already named "${name}".`);
    yield* renameRealm(realm.id as WorkspaceId, name);
    return done(`Renamed the realm "${realm.name}" to "${name}".`);
  }).pipe(
    // A failure of the realm rules, such as a folder that does not exist, comes back to Iskios as a refusal.
    Effect.catchTag("ServiceFailure", (failure) => Effect.succeed(refused(`Not done: ${failure.message}`))),
  );
