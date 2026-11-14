import { Effect, Match } from "effect";
import { SqlClient } from "effect/sql";
import type { NamedAction } from "../policy/index.ts";
import { checkRealmCreation, checkRealmRename } from "./realmChecks.ts";
import type { ArgumentsOf } from "./threadTools.ts";

type RealmAction = {
  shouldAsk: boolean;
  named: NamedAction;
  scoped: null;
  state: object;
  summary: string;
};

const duplicateNameNoteOf = (hasDuplicateName: boolean) =>
  hasDuplicateName ? " Another active realm has this name. Use this name too?" : "";

/** Derives a realm creation and its collision warning before provenance authorizes the exact action. */
export const deriveRealmCreation = Effect.fn("deriveRealmCreation")(function* (args: ArgumentsOf<"create_realm">) {
  const sql = yield* SqlClient.SqlClient;
  const checked = yield* checkRealmCreation(args);
  // A genuinely refused action must not be offered as a question the owner could approve.
  return yield* Match.valueTags(checked, {
    Clear: (realm) =>
      Effect.gen(function* () {
        const existing = yield* sql`SELECT id, name, path FROM workspaces
          WHERE (lower(name) = lower(${realm.name}) OR path = ${realm.real ?? ""}) AND archived_at IS NULL ORDER BY id`;
        return {
          named: { operation: "CreateRealm", targets: [realm.name], value: realm.folder },
          scoped: null,
          shouldAsk: realm.hasDuplicateName,
          state: { existing, folder: realm.real, name: realm.name },
          summary: `Make the realm "${realm.name}", ${realm.real === null ? "tied to no folder" : `tied to ${realm.real}`}.${duplicateNameNoteOf(realm.hasDuplicateName)}`,
        } satisfies RealmAction;
      }),
    Refused: () => Effect.succeed(null),
  });
});

/** Derives an unambiguous realm rename and binds its warning to the current active rival names. */
export const deriveRealmRename = Effect.fn("deriveRealmRename")(function* (args: ArgumentsOf<"rename_realm">) {
  const sql = yield* SqlClient.SqlClient;
  const checked = yield* checkRealmRename(args);
  return yield* Match.valueTags(checked, {
    Clear: ({ hasDuplicateName, name, realm }) =>
      Effect.gen(function* () {
        const rivals = (yield* sql<{ name: string }>`SELECT name FROM workspaces
          WHERE id <> ${realm.id} AND archived_at IS NULL ORDER BY id`).map((row) => row.name);
        return {
          named: {
            operation: "RenameRealm",
            rivals,
            targets: [realm.id, realm.name, ...(realm.path === null ? [] : [realm.path])],
            value: name,
          },
          scoped: null,
          shouldAsk: hasDuplicateName,
          state: { name, realm, rivals },
          summary: `Rename the realm "${realm.name}" to "${name}".${duplicateNameNoteOf(hasDuplicateName)}`,
        } satisfies RealmAction;
      }),
    Refused: () => Effect.succeed(null),
  });
});
