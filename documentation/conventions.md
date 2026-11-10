# Conventions

How code is written in this project. Project-agnostic: every rule could be transposed to another project on the same stack. Product rules live in requirements, domain terms in the glossary, and a requirement outranks any rule here. Formatting, import order, and key, attribute, and member sorting are Biome's job (`biome.json`), not this file's.

## Naming

- **A module is named for the noun it owns** (`orders.ts`, `sessions.ts`); a React hook lives in `useThing.ts`: it follows the common TypeScript and React practice, so a newcomer or an agent finds code where they expect it.
- **Functions start with a verb** (`readSettings`, `listOrders`, `insertOrder`); a pure derivation is named `thingOf` (`titleOf`, `summaryOf`), and a layer `thingLayer`: the name says whether a call acts or only computes. Same reason as above: it matches widespread practice.
- **Words are written out**, except abbreviations everyone reads at once (`sql`, `cwd`, `id`, `url`): a spelled-out name needs no glossary.
- **A local name is one word when the context makes it clear** (`turn`, `draft`, `sql`): the surrounding function already says what kind of turn or draft it is. Fields are nested only where they form a group that travels together (`usage: { input, output }`), never to shorten a name: flat records cross contracts, storage, and schemas without conversion, and nesting cannot express a prefixed boolean.
- **A boolean carries a prefix** (`is`, `has`, `should`, `can`): the name shows at once that the value is a boolean. A name fixed by an external format, such as a third-party protocol field, keeps its given name.
- **A test double says what it is**, by the word `fake` or `stand-in` in its name or by living under `test/fixtures/`; no symbol prefix such as `$`: `$` already means streams, stores, or jQuery elsewhere, and a double that is easy to miss can slip into production code.

## Size

- **A block is extracted once it can carry its own name**, and a file is split by responsibility past about 250 lines: named steps read as an outline of the work, and a small file keeps a review on one responsibility.

## Layout

- **A folder holds modules that depend only on folders before it**, so folder imports run one way and never in a ring: a ring of folders only looks separate, and a change still crosses all of them. Check it from the import graph before cutting a folder.
- **A folder's `index.ts` exports only what other folders import**: the file is the folder's interface, and a name nobody outside uses stays internal. Outside code imports the folder through it; inside the folder, files import each other directly, so loading never loops through the index.
- **A split file stays in its folder**, and the part another folder needs is moved down to the shared folder that folder already depends on, not imported back up.
- **Tests mirror the folders** (`test/<folder>/<module>.test.ts`) and import through the folder's `index.ts` where it exports what they use; a test that needs an internal name imports the file, which shows where the interface is too narrow. Shared fixtures stay in `test/fixtures/`.

## Types and absence

- **Own values are never set to `undefined`; deliberate absence is `null`**: `undefined` only arrives from outside, from a side effect or an API (a missing row or array element, `Map.get`, an omitted optional field), so it never means "decided to be empty". Where an API requires `undefined`, write `void 0`.
- **No `any` and no non-null `!`**: both switch off the checks the strict compiler options exist for.
- **`satisfies` checks a shape; `as` is reserved** for applying a brand to identifiers read from storage and for `as Error` on a caught value: an `as` elsewhere hides a mismatch the compiler would report.

## Branching

- **No `switch`; a value selects from an object keyed by it**, typed with `satisfies Record<Key, …>` (`stateColors`, `modelLabels`): the compiler reports a missing key, which is what `switch` exhaustiveness would give, and the mapping reads as data.
- **Branching on a tagged union uses `Match.valueTags`** in Effect code: one handler per `_tag`, each narrowed to its case, and a missing tag fails to compile.
- **A key from outside is checked with `Object.hasOwn(map, key)`**, never `key in map`: `in` also finds inherited names such as `toString`.

## Errors

These follow Effect's own guide (`packages/service/node_modules/effect/AGENTS.md`).

- **Effect code never throws**: an expected failure is a `Schema.TaggedError` class, raised with `return yield* new TheError(...)` or a small constructor (`notFound(...)`), so it stays typed in the error channel and callers must handle it.
- **Unexpected failures become defects** with `Effect.orDie` where a fiber starts: a bug or a broken store is not something a caller can recover from, and its error type should not leak into every signature.
- **Configuration is read through `Config`**, never with a guard that throws at import: a missing variable then fails the program as an ordinary Effect failure.
- **Code outside Effect (UI components, the desktop shell) reports failure by rejecting a promise**, and every promise chain started at the top ends in a handler that shows the failure: an unhandled rejection fails silently.
- **Logging happens only at the process top**, where the program's exit is observed: lower layers return failures instead of logging and continuing.

## State and side effects

- **I/O, time, and randomness run inside an Effect; time is read through `Clock`**, and a synchronous platform call is wrapped in `Effect.sync`: tests can then drive time with `TestClock` and replace I/O with fakes.
- **Service interfaces expose only `readonly` fields**: a caller cannot change a service's state behind its back.

## Comments

- **Every exported item and seam gets a one-sentence `/** */`** saying what it owns or means, not how it works.
- **Comment wherever the reason is not obvious from the code**: `//` explains why, never what. Comment often when it is needed; a missing why is the first thing a later change breaks.
- **Provisional behavior cites the record that will settle it** (a specification or changelog entry); no bare `TODO`: the citation says when the code may change and who decides.

## Tests

- **A `describe` names an activity and each test title is a present-tense behavior sentence**, one behavior per test: a failing title then reads as the broken behavior.
- **External systems are replaced by fakes** (a fake layer, a stand-in executable, a real database in a temporary folder), never module mocks such as `vi.mock`: a fake exercises the real seam, and a mock tests the wiring of the test.
- **Time is driven with `TestClock`; a check against a live external system is opt-in** through an environment variable: the default run stays fast, deterministic, and free.

## Modules and dependencies

- **Exports are named; `export default` is used only where a framework requires it**: named exports keep one name across imports and searches.
- **The Effect ecosystem or the platform comes first; a new library is added only for a job neither covers**, with the reason in the change description: each dependency is code to audit and upgrade.
