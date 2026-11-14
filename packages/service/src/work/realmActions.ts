import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import type { NamedAction } from "../policy/index.ts";
import { checkRealmCreation, checkRealmRename } from "./realmChecks.ts";
import type { ArgumentsOf } from "./threadTools.ts";

type RealmAction = {
  mustAsk: boolean;
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
  if (checked._tag === "Refused") return null;
  const existing = yield* sql`SELECT id, name, path FROM workspaces
    WHERE (lower(name) = lower(${checked.name}) OR path = ${checked.real ?? ""}) AND archived_at IS NULL ORDER BY id`;
  return {
    mustAsk: checked.hasDuplicateName,
    named: { operation: "CreateRealm", targets: [checked.name], value: checked.folder },
    scoped: null,
    state: { existing, folder: checked.real, name: checked.name },
    summary: `Make the realm "${checked.name}", ${checked.real === null ? "tied to no folder" : `tied to ${checked.real}`}.${duplicateNameNoteOf(checked.hasDuplicateName)}`,
  } satisfies RealmAction;
});

/** Derives an unambiguous realm rename and binds its warning to the current active rival names. */
export const deriveRealmRename = Effect.fn("deriveRealmRename")(function* (args: ArgumentsOf<"rename_realm">) {
  const sql = yield* SqlClient.SqlClient;
  const checked = yield* checkRealmRename(args);
  if (checked._tag === "Refused") return null;
  const { name, realm } = checked;
  const rivals = (yield* sql<{ name: string }>`SELECT name FROM workspaces
    WHERE id <> ${realm.id} AND archived_at IS NULL ORDER BY id`).map((row) => row.name);
  return {
    mustAsk: checked.hasDuplicateName,
    named: {
      operation: "RenameRealm",
      rivals,
      targets: [realm.id, realm.name, ...(realm.path === null ? [] : [realm.path])],
      value: name,
    },
    scoped: null,
    state: { name, realm, rivals },
    summary: `Rename the realm "${realm.name}" to "${name}".${duplicateNameNoteOf(checked.hasDuplicateName)}`,
  } satisfies RealmAction;
});
