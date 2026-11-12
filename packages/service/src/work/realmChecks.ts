import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { realFolderOf } from "../core/index.ts";

// The checks Iskios's realm tools make before they act. The provenance module (guildmasterProvenance.ts) runs the
// same ones to decide whether there is anything to ask the owner about, so an action a tool would refuse is never
// put to them as a question.

/** A realm by its folder or its name, tied to a folder or not (unlike `findRealm`, which only finds tied ones). */
export const findRealmOfAnyKind = (given: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const wanted = given.trim();
    const [row] = yield* sql<{ id: string; name: string; path: string | null }>`
      SELECT id, name, path FROM workspaces WHERE path = ${wanted} OR lower(name) = lower(${wanted})
      ORDER BY created_at LIMIT 1`;
    return row ?? null;
  });

/** A realm the tool would act on. */
export interface RealmFound {
  readonly id: string;
  readonly name: string;
  readonly path: string | null;
}

/** What a realm tool found before acting: a refusal with the words that tell Iskios why, or what it would act on. */
export type RealmCheck<Clear> =
  | { readonly _tag: "Refused"; readonly text: string }
  | ({ readonly _tag: "Clear" } & Clear);

const refused = (text: string) => ({ _tag: "Refused", text }) as const;

/** `create_realm`'s checks: a name given, no realm with that name, and no realm already tied to the folder. */
export const checkRealmCreation = (given: { readonly folder?: string | undefined; readonly name: string }) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const name = given.name.trim();
    if (name === "") return refused("Not done: a realm needs a name.");
    if ((yield* findRealmOfAnyKind(name)) !== null)
      return refused(`Not done: a realm "${name}" already exists. Tell the owner, or pick another name.`);
    const folder = given.folder === undefined || given.folder.trim() === "" ? null : given.folder.trim();
    const real = folder === null ? null : ((yield* realFolderOf(folder)) ?? folder);
    if (real !== null) {
      const [tied] = yield* sql<{ id: string }>`SELECT id FROM workspaces WHERE path = ${real} LIMIT 1`;
      if (tied !== undefined)
        return refused(`Not done: the folder ${folder} already belongs to a realm. Rename that realm instead.`);
    }
    return { _tag: "Clear", folder, name, real } as const;
  });

/** `rename_realm`'s checks: the realm exists, a name is given, and no other realm has it. */
export const checkRealmRename = (given: { readonly name: string; readonly realm: string }) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const realm = yield* findRealmOfAnyKind(given.realm);
    if (realm === null) return refused(`Not done: no realm "${given.realm}". Name one of the realms in your context.`);
    const name = given.name.trim();
    if (name === "") return refused("Not done: a realm needs a name.");
    const [other] = yield* sql<{ id: string }>`
      SELECT id FROM workspaces WHERE lower(name) = lower(${name}) AND id <> ${realm.id} LIMIT 1`;
    if (other !== undefined) return refused(`Not done: another realm is already named "${name}".`);
    return { _tag: "Clear", name, realm } as const;
  });
