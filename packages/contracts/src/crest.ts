import { Schema } from "effect";

// A realm's crest: the drawn sign its quests wear. The system follows Crest's Studio (github.com/pauljoda/Crest,
// MPL-2.0): a plate, a field that may be divided, a band across it, an edge, a trim around the plate, and an emblem,
// each with its own color. The vocabulary is Gild's own; the drawing is the app's (crest.tsx).

/** The outline the crest is cut to; None leaves the emblem alone. */
export const crestPlates = [
  "None",
  "Round",
  "Shield",
  "FrenchShield",
  "Lozenge",
  "Seal",
  "Hexagon",
  "Octagon",
  "RoundedSquare",
  "Oval",
  "Banner",
  "Badge",
] as const;

/** How the field takes its second color. */
export const crestDivisions = [
  "Plain",
  "PerPale",
  "PerFess",
  "PerBend",
  "PerChevron",
  "Quarterly",
  "PerSaltire",
  "Gyronny",
  "Barry",
  "Paly",
  "Checky",
] as const;

/** A band laid across the field. */
export const crestBands = [
  "None",
  "Pale",
  "Fess",
  "Bend",
  "Chevron",
  "Cross",
  "Saltire",
  "Chief",
  "Bordure",
  "Pall",
  "Pile",
  "Canton",
  "Roundel",
] as const;

/** What frames the plate. */
export const crestTrims = ["None", "Line", "DoubleLine", "Seal", "Sunburst", "Beaded"] as const;

/** The light laid over the field. */
export const crestFinishes = ["Flat", "Sheen", "Embossed"] as const;

/** The heraldic figures with bundled artwork (game-icons.net, CC BY 3.0; see the credits beside the artwork). */
export const crestChargeIds = [
  "anchor",
  "axes",
  "bat",
  "bear",
  "boar",
  "castle",
  "direwolf",
  "dragon",
  "dragonHead",
  "eagle",
  "falcon",
  "fox",
  "griffin",
  "horse",
  "hydra",
  "kraken",
  "lily",
  "lion",
  "pine",
  "raven",
  "rose",
  "scales",
  "scorpion",
  "seahorse",
  "serpent",
  "stag",
  "sword",
  "swords",
  "trident",
  "unicorn",
  "willow",
  "wyvern",
] as const;

/** The name of a bundled heraldic figure. */
export type CrestChargeId = (typeof crestChargeIds)[number];

const Color = Schema.String.check(Schema.isPattern(/^#[0-9a-fA-F]{6}$/));

/** What the crest carries: a heraldic figure, one of the app's line emblems, or a letter or emoji. */
export const CrestEmblem = Schema.Union([
  Schema.TaggedStruct("Charge", { id: Schema.Literals(crestChargeIds) }),
  Schema.TaggedStruct("Glyph", { name: Schema.String.check(Schema.isMaxLength(40)) }),
  Schema.TaggedStruct("Text", { text: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(8)) }),
]);
export type CrestEmblem = typeof CrestEmblem.Type;

/** The composition of one crest. Sizes are fractions: edge 0 to 1, emblem scale 0.4 to 1.2, band width 0.5 to 2. */
export const Crest = Schema.Struct({
  band: Schema.Literals(crestBands),
  bandWidth: Schema.Number.check(Schema.isBetween({ maximum: 2, minimum: 0.5 })),
  colors: Schema.Struct({
    band: Color,
    edge: Color,
    emblem: Color,
    field: Color,
    secondField: Color,
    trim: Color,
  }),
  division: Schema.Literals(crestDivisions),
  edge: Schema.Number.check(Schema.isBetween({ maximum: 1, minimum: 0 })),
  emblem: CrestEmblem,
  emblemScale: Schema.Number.check(Schema.isBetween({ maximum: 1.2, minimum: 0.4 })),
  finish: Schema.Literals(crestFinishes),
  plate: Schema.Literals(crestPlates),
  trim: Schema.Literals(crestTrims),
});
export type Crest = typeof Crest.Type;
