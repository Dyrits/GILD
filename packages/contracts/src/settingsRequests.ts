import { Schema, Struct } from "effect";
import { Settings } from "./records.ts";

/** Saves the owner's settings. */
export const UpdateSettings = Schema.TaggedStruct("UpdateSettings", { settings: Settings });
/** Changes some of the owner's settings, merged into the saved ones by the service, so a change made elsewhere meanwhile is kept; of the tiers, only those named change. */
export const ChangeSettings = Schema.TaggedStruct("ChangeSettings", {
  change: Settings.mapFields((fields) => ({
    ...Struct.map(Schema.optionalKey)(fields),
    tiers: Schema.optionalKey(fields.tiers.mapFields(Struct.map(Schema.optionalKey))),
  })),
});
export type SettingsChange = typeof ChangeSettings.Type.change;
