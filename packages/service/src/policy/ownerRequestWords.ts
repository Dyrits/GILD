import type { RitualScopeOperation } from "@iskios/contracts";

/** The structural actions the service derives from Iskios's tool calls. */
export type StructuralOperation = RitualScopeOperation | "CreateRealm" | "RenameRealm" | "CreateRitual";

/** One structural action as the owner would name it: what, on which target, and to what new value. */
export interface NamedAction {
  readonly operation: StructuralOperation;
  /** The names of the other targets of the same kind, such as the other quests' titles: naming one is ambiguous. */
  readonly rivals?: ReadonlyArray<string>;
  /** The names the target goes by, such as a quest's title or a setting's key; any one may be used. */
  readonly targets: ReadonlyArray<string>;
  /** The new value the owner must name too (a new title or name, a setting's value), or null. */
  readonly value: string | null;
}

const create = ["create", "make", "add", "new", "crée", "créer", "cree", "creer", "ajoute", "ajouter"];
const rename = ["rename", "renames", "retitle", "renomme", "renommer"];

/** The words that name each operation, and the nouns it also needs (a realm, a Ritual), in English and French. */
export const vocabulary: Record<
  StructuralOperation,
  { readonly verbs: ReadonlyArray<string>; readonly nouns: ReadonlyArray<string> }
> = {
  Archive: { nouns: [], verbs: ["archive", "archives", "archiver", "archivé", "archivée"] },
  ChangeSetting: {
    nouns: [],
    verbs: [
      "set",
      "change",
      "turn",
      "switch",
      "enable",
      "disable",
      "mets",
      "mettre",
      "changer",
      "active",
      "activer",
      "désactive",
      "désactiver",
    ],
  },
  CreateRealm: { nouns: ["realm", "royaume"], verbs: create },
  CreateRitual: { nouns: ["ritual", "rituel"], verbs: [...create, "schedule", "planifie"] },
  Done: {
    nouns: [],
    verbs: [
      "done",
      "finish",
      "finished",
      "complete",
      "completed",
      "termine",
      "terminé",
      "terminée",
      "terminer",
      "fini",
      "finie",
    ],
  },
  Rename: { nouns: [], verbs: rename },
  RenameRealm: { nouns: ["realm", "royaume"], verbs: rename },
  Stop: { nouns: [], verbs: ["stop", "stops", "halt", "arrête", "arrete", "arrêter", "arreter", "stoppe", "stopper"] },
};

/** Words that turn a request into a refusal, a doubt, a retraction, or a passing narrative. */
export const blockers = new Set([
  "no",
  "not",
  "never",
  "nor",
  "without",
  "dont",
  "cannot",
  "avoid",
  "stop",
  "wait",
  "hold",
  "postpone",
  "maybe",
  "perhaps",
  "should",
  "could",
  "would",
  "might",
  "if",
  "whether",
  "instead",
  "except",
  "unless",
  "ne",
  "n",
  "pas",
  "jamais",
  "sans",
  "aucun",
  "aucune",
  "peut",
  "si",
  "sauf",
  "plutôt",
  // A retraction, a change of mind, or a passing narrative is not a request (audit SA-03).
  "actually",
  "rather",
  "keep",
  "leave",
  "skip",
  "later",
  "ignore",
  "cancel",
  "undo",
  "revert",
  "forget",
  "oops",
  "sorry",
  "mistake",
  "garde",
  "laisse",
  "finalement",
  "annule",
  "oublie",
  "tard",
  "plutot",
  "is",
  "was",
  "are",
  "were",
  "been",
  "has",
  "have",
  "had",
  "est",
  "était",
  "été",
  "sont",
]);

/** The lowercase words of a text; "don't" gives "do" and "dont", and French "n'archive" gives "n" and "archive". */
export const wordsOf = (text: string) =>
  (
    text
      .toLowerCase()
      .replaceAll("’", "'")
      .match(/[\p{L}\p{N}']+/gu) ?? []
  ).flatMap((word) =>
    word.endsWith("n't") ? [word.slice(0, -3), "dont"] : word.split("'").filter((part) => part !== ""),
  );
