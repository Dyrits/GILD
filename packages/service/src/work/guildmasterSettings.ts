import { Settings } from "@iskios/contracts";
import { Effect, Schema } from "effect";
import { readSettings, type ToolAnswer, writeSettings } from "../core/index.ts";
import { changed, unchanged, type WithFollowUps } from "./commands.ts";
import { isGuildmasterThread, isQuotedByOwner } from "./guildmaster.ts";
import type { ArgumentsOf } from "./threadTools.ts";

// Iskios's settings tools (quest coordination, CHG-0193): it reads the owner's settings, and changes one at the owner's
// request, which their own quoted words prove. Only Iskios calls them, and never on its own.

/**
 * The settings Iskios never changes: what agents may do without asking and what they may spend. The owner sets them in
 * the Charter, because a quest's text could otherwise talk Iskios into widening them.
 */
export const settingsKeptFromIskios = [
  "approvalLevel",
  "defaultMissionBudget",
  "globalBudget",
  "globalBudgetPeriod",
  "shouldFetchPrices",
] as const satisfies ReadonlyArray<keyof Settings>;

const isKept = (key: string) => (settingsKeptFromIskios as ReadonlyArray<string>).includes(key);

/** The value as parsed JSON, or undefined when the text is not JSON. */
const jsonOf = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

const refused = (text: string): WithFollowUps<ToolAnswer> => unchanged({ isError: true, text });

/** The settings' names, which `change_setting` takes: every setting Iskios may change. */
export const changeableSettings = (Object.keys(Settings.fields) as ReadonlyArray<keyof Settings>).filter(
  (key) => !isKept(key),
);

/** `read_settings`: the owner's settings as JSON, with the names Iskios may not change. Only Iskios reads them. */
export const readSettingsByGuildmaster = (callerId: string) =>
  Effect.gen(function* () {
    if (!(yield* isGuildmasterThread(callerId))) return refused("Only Iskios reads the settings here.");
    const settings = yield* readSettings;
    return unchanged({
      isError: false,
      text: `${JSON.stringify(settings)}\n\nYou may not change: ${settingsKeptFromIskios.join(", ")}; the owner sets those in the Charter.`,
    } satisfies ToolAnswer);
  });

/**
 * `change_setting`: sets one setting to a new value, kept whole, as the settings screen would save it; refused for a
 * setting kept from Iskios, an unknown one, or a value the setting does not accept.
 */
export const changeSettingByGuildmaster = (callerId: string, args: ArgumentsOf<"change_setting">) =>
  Effect.gen(function* () {
    if (!(yield* isGuildmasterThread(callerId))) return refused("Only Iskios changes the settings here.");
    if (!(yield* isQuotedByOwner(callerId, args.quote)))
      return refused(
        "Not done: change a setting only when the owner asks for it in their latest message. Quote their exact words as quote, or ask them first.",
      );
    if (isKept(args.setting))
      return refused(`Not done: ${args.setting} is the owner's alone to change, in the Charter. Tell them where.`);
    if (!(changeableSettings as ReadonlyArray<string>).includes(args.setting))
      return refused(`Not done: no setting "${args.setting}". Read the settings first; use a name from them.`);
    const value = jsonOf(args.value);
    if (value === undefined)
      return refused(`Not done: value must be JSON text, such as true, 14, or "Steer"; ${args.value} is not.`);
    const before = yield* readSettings;
    const after = { ...before, [args.setting]: value };
    // The value must decode as the setting, whole: a wrong shape or range changes nothing.
    if (Schema.decodeUnknownExit(Settings)(after)._tag === "Failure")
      return refused(
        `Not done: ${JSON.stringify(value)} is not a value ${args.setting} accepts. Read the settings for its shape.`,
      );
    yield* writeSettings(after as Settings);
    return changed({
      isError: false,
      text: `Changed ${args.setting} from ${JSON.stringify(before[args.setting as keyof Settings])} to ${JSON.stringify(value)}. Tell the owner in a sentence.`,
    } satisfies ToolAnswer);
  }).pipe(Effect.catchTag("ServiceFailure", (failure) => Effect.succeed(refused(`Not done: ${failure.message}`))));
