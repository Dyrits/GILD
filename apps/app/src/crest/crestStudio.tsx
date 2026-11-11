// Crest Studio for a realm: design its crest from previews of the parts, as Crest's Studio does (github.com/pauljoda/Crest,
// MPL-2.0). The designed crest is kept on the realm, and its quests wear it.

import {
  type Crest,
  crestBands,
  crestChargeIds,
  crestDivisions,
  crestFinishes,
  crestPlates,
  crestTrims,
} from "@iskios/contracts";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { emblemPaths } from "../foundation/emblems";
import { colors, fontSizes, fonts, outline, radii } from "../foundation/theme";
import { CrestView } from "./crest";
import { crestCharges } from "./crestCharges";
import { crestOf, shuffledCrest } from "./crestShapes";

type Step = "Shape" | "Field" | "Band" | "Emblem" | "Border" | "Finish" | "Colors";
const steps: ReadonlyArray<Step> = ["Shape", "Field", "Band", "Emblem", "Border", "Finish", "Colors"];

/** Names for the plates, divisions, bands and trims, as the studio words them. */
const titles: Record<string, string> = {
  Badge: "Badge",
  Banner: "Banner",
  Barry: "Bars",
  Beaded: "Beaded",
  Bend: "Bend",
  Bordure: "Bordure",
  Canton: "Canton",
  Checky: "Checks",
  Chevron: "Chevron",
  Chief: "Chief",
  Cross: "Cross",
  DoubleLine: "Double line",
  Embossed: "Embossed",
  Fess: "Fess",
  Flat: "Flat",
  FrenchShield: "French shield",
  Gyronny: "Wedges",
  Hexagon: "Hexagon",
  Line: "Line",
  Lozenge: "Lozenge",
  None: "None",
  Octagon: "Octagon",
  Oval: "Oval",
  Pale: "Pale",
  Pall: "Pall",
  Paly: "Stripes",
  PerBend: "Diagonal",
  PerChevron: "Chevron",
  PerFess: "Horizontal",
  PerPale: "Vertical",
  PerSaltire: "Crossed",
  Pile: "Pile",
  Plain: "Plain",
  Quarterly: "Quartered",
  Round: "Round",
  RoundedSquare: "Rounded square",
  Roundel: "Roundel",
  Saltire: "Saltire",
  Seal: "Seal",
  Sheen: "Sheen",
  Shield: "Shield",
  Sunburst: "Sunburst",
};

/** The dyes the color rows offer. */
const swatches = [
  "#8b1e1a",
  "#b8352d",
  "#d65a31",
  "#a6501f",
  "#d98a3f",
  "#d9ad4f",
  "#f2d98a",
  "#efdcae",
  "#d8c27a",
  "#6c8f4e",
  "#2f5e3a",
  "#2f7fa8",
  "#1d4d7a",
  "#1f2d4a",
  "#52657a",
  "#9eb3c0",
  "#dfe6ea",
  "#6e4a8c",
  "#33363b",
  "#26262b",
  "#2b1d12",
  "#ffffff",
] as const;

const layers = [
  ["field", "Field"],
  ["secondField", "Second field"],
  ["band", "Band"],
  ["emblem", "Emblem"],
  ["trim", "Border"],
  ["edge", "Edge"],
] as const;

/** A choice among a few sizes: a row of labelled pills. */
function Choices<T extends number>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: T) => void;
  options: ReadonlyArray<readonly [T, string]>;
  value: T;
}) {
  return (
    <View style={local.choices}>
      <Text style={local.choiceLabel}>{label}</Text>
      <View style={local.pills}>
        {options.map(([option, name]) => (
          <Pressable
            accessibilityRole="button"
            key={option}
            onPress={() => onChange(option)}
            style={[local.pill, option === value && local.pillOn]}
          >
            <Text style={[local.pillText, option === value && local.pillTextOn]}>{name}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** A crest with a plate: the studio has no bare emblem, since there would be no field to color. */
const withPlate = (crest: Crest): Crest => (crest.plate === "None" ? { ...crest, plate: "Round" } : crest);

/** One option of a step, drawn as the crest would look with it. */
function Tile({ crest, isOn, label, onPress }: { crest: Crest; isOn: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected: isOn }}
      onPress={onPress}
      style={[local.tile, isOn && local.tileOn]}
    >
      <CrestView crest={crest} size={52} />
      <Text numberOfLines={1} style={local.tileLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A row of dyes for one layer. */
function Dyes({ onChange, value }: { onChange: (color: string) => void; value: string }) {
  return (
    <View style={local.dyes}>
      {swatches.map((color) => (
        <Pressable
          accessibilityLabel={color}
          accessibilityRole="button"
          key={color}
          onPress={() => onChange(color)}
          style={[local.dye, { backgroundColor: color }, color.toLowerCase() === value.toLowerCase() && local.dyeOn]}
        />
      ))}
    </View>
  );
}

/**
 * The studio for one realm's crest, in a window over the screen: a preview above the steps (start from, shape, field,
 * band, emblem, border, finish, colors), each choosing from previews of the crest itself; Shuffle and Undo; Done keeps
 * the crest on the realm.
 */
export function CrestStudio({
  id,
  initial,
  name,
  onCancel,
  onDone,
}: {
  /** Identifies the realm (or folder) the crest is for: its default crest comes from this. */
  id: string;
  /** The crest to start from, or null for the default the id gives. */
  initial: Crest | null;
  name: string;
  onCancel: () => void;
  /** Keeps the designed crest, or null for the default; resolves when the caller has kept it. */
  onDone: (crest: Crest | null) => Promise<unknown>;
}) {
  const onClose = onCancel;
  // It starts from the crest the realm shows now, designed or not, so the owner adjusts what they see.
  const [crest, setCrest] = useState<Crest>(() => withPlate(crestOf(initial, id)));
  // What the emblem's text field holds, which may be empty while the crest keeps its last text.
  const [emblemText, setEmblemText] = useState(crest.emblem._tag === "Text" ? crest.emblem.text : "");
  const [history, setHistory] = useState<ReadonlyArray<Crest>>([]);
  const [step, setStep] = useState<Step>("Shape");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const apply = (next: Crest) => {
    setHistory([...history, crest]);
    setCrest(next);
  };
  const undo = () => {
    const previous = history[history.length - 1];
    if (previous === undefined) return;
    setHistory(history.slice(0, -1));
    setCrest(previous);
  };
  const save = (designed: Crest | null) => {
    setIsSaving(true);
    onDone(designed).then(undefined, (reason: Error) => {
      setError(reason.message);
      setIsSaving(false);
    });
  };
  const tiles = <K extends keyof Crest>(key: K, options: ReadonlyArray<Crest[K]>) =>
    options.map((option) => (
      <Tile
        crest={{ ...crest, [key]: option }}
        isOn={crest[key] === option}
        key={String(option)}
        label={titles[String(option)] ?? String(option)}
        onPress={() => apply({ ...crest, [key]: option })}
      />
    ));
  const plateAndEmblem = (next: Partial<Crest>) => ({ ...crest, ...next });
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <View style={local.backdrop}>
        <Pressable accessibilityLabel="Close the studio" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={local.window}>
          <View style={local.header}>
            <Text style={local.title}>Crest of {name}</Text>
            <Pressable accessibilityLabel="Close the studio" accessibilityRole="button" onPress={onClose}>
              <Text style={local.close}>✕</Text>
            </Pressable>
          </View>
          <View style={local.stage}>
            <View style={local.preview}>
              <CrestView crest={crest} size={150} />
            </View>
            <View style={local.stageSide}>
              <Text style={local.stageHint}>Choose from the previews. Each part keeps its own color.</Text>
              <View style={local.actions}>
                <Pressable accessibilityRole="button" onPress={() => apply(shuffledCrest())} style={local.action}>
                  <Text style={local.actionText}>Shuffle</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={history.length === 0}
                  onPress={undo}
                  style={[local.action, history.length === 0 && local.actionOff]}
                >
                  <Text style={local.actionText}>Undo</Text>
                </Pressable>
              </View>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={local.stepBar}>
            {steps.map((each) => (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: each === step }}
                key={each}
                onPress={() => setStep(each)}
                style={[local.step, each === step && local.stepOn]}
              >
                <Text style={[local.stepText, each === step && local.stepTextOn]}>{each}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <ScrollView contentContainerStyle={local.body} style={local.bodyScroll}>
            {step === "Shape" && (
              <>
                <View style={local.grid}>
                  {tiles(
                    "plate",
                    crestPlates.filter((plate) => plate !== "None"),
                  )}
                </View>
                <Choices
                  label="Edge"
                  onChange={(edge) => apply({ ...crest, edge })}
                  options={[
                    [0, "None"],
                    [0.2, "Fine"],
                    [0.35, "Medium"],
                    [0.6, "Bold"],
                  ]}
                  value={crest.edge}
                />
              </>
            )}
            {step === "Field" && <View style={local.grid}>{tiles("division", crestDivisions)}</View>}
            {step === "Band" && (
              <>
                <View style={local.grid}>{tiles("band", crestBands)}</View>
                <Choices
                  label="Width"
                  onChange={(bandWidth) => apply({ ...crest, bandWidth })}
                  options={[
                    [0.6, "Thin"],
                    [1, "Medium"],
                    [1.5, "Wide"],
                  ]}
                  value={crest.bandWidth}
                />
              </>
            )}
            {step === "Emblem" && (
              <>
                <Text style={local.section}>Heraldry</Text>
                <View style={local.grid}>
                  {crestChargeIds.map((id) => (
                    <Tile
                      crest={plateAndEmblem({ emblem: { _tag: "Charge", id } })}
                      isOn={crest.emblem._tag === "Charge" && crest.emblem.id === id}
                      key={id}
                      label={crestCharges[id].name}
                      onPress={() => apply({ ...crest, emblem: { _tag: "Charge", id } })}
                    />
                  ))}
                </View>
                <Text style={local.section}>Line drawings</Text>
                <View style={local.grid}>
                  {Object.keys(emblemPaths).map((name) => (
                    <Tile
                      crest={plateAndEmblem({ emblem: { _tag: "Glyph", name } })}
                      isOn={crest.emblem._tag === "Glyph" && crest.emblem.name === name}
                      key={name}
                      label={name}
                      onPress={() => apply({ ...crest, emblem: { _tag: "Glyph", name } })}
                    />
                  ))}
                </View>
                <Text style={local.section}>A letter or an emoji</Text>
                <TextInput
                  accessibilityLabel="Letter or emoji"
                  maxLength={8}
                  onChangeText={(text) => {
                    setEmblemText(text);
                    const trimmed = text.trim();
                    if (trimmed === "") return;
                    const next: Crest = { ...crest, emblem: { _tag: "Text", text: trimmed } };
                    // Typing in the field is one step to undo, not one per key.
                    if (crest.emblem._tag === "Text") setCrest(next);
                    else apply(next);
                  }}
                  placeholder="C"
                  placeholderTextColor={colors.placeholder}
                  style={local.input}
                  value={crest.emblem._tag === "Text" ? emblemText : ""}
                />
                <Choices
                  label="Size"
                  onChange={(emblemScale) => apply({ ...crest, emblemScale })}
                  options={[
                    [0.7, "Small"],
                    [1, "Medium"],
                    [1.15, "Large"],
                  ]}
                  value={crest.emblemScale}
                />
              </>
            )}
            {step === "Border" && <View style={local.grid}>{tiles("trim", crestTrims)}</View>}
            {step === "Finish" && <View style={local.grid}>{tiles("finish", crestFinishes)}</View>}
            {step === "Colors" &&
              layers.map(([key, label]) => (
                <View key={key} style={local.layer}>
                  <Text style={local.choiceLabel}>{label}</Text>
                  <Dyes
                    onChange={(color) => apply({ ...crest, colors: { ...crest.colors, [key]: color } })}
                    value={crest.colors[key]}
                  />
                </View>
              ))}
          </ScrollView>
          {error !== null && <Text style={local.error}>{error}</Text>}
          <View style={local.footer}>
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={() => save(crest)}
              style={[local.done, isSaving && local.actionOff]}
            >
              <Text style={local.doneText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const local = StyleSheet.create({
  action: {
    ...outline,
    backgroundColor: colors.canvas,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  actionOff: { opacity: 0.4 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionText: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.base, fontWeight: "600" },
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(20,10,6,0.6)",
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  body: { gap: 14, padding: 16 },
  bodyScroll: { flexGrow: 0, maxHeight: 330 },
  choiceLabel: {
    color: colors.textMuted,
    fontFamily: fonts.sans,
    fontSize: 12,
  },
  choices: { alignItems: "center", flexDirection: "row", gap: 12 },
  close: { color: colors.textMuted, fontSize: fontSizes.lg, paddingHorizontal: 6 },
  done: { backgroundColor: colors.edge, borderRadius: radii.sm, paddingHorizontal: 22, paddingVertical: 8 },
  doneText: {
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: fontSizes.base,
    fontWeight: "700",
  },
  dye: { borderColor: "rgba(43,29,18,0.35)", borderRadius: radii.pill, borderWidth: 1, height: 26, width: 26 },
  dyeOn: { borderColor: colors.text, borderWidth: 3 },
  dyes: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  error: { color: colors.dangerText, fontFamily: fonts.sans, paddingHorizontal: 16 },
  footer: { flexDirection: "row", gap: 10, justifyContent: "flex-end", padding: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  input: {
    ...outline,
    backgroundColor: colors.canvas,
    borderRadius: radii.sm,
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: 18,
    paddingHorizontal: 10,
    paddingVertical: 6,
    width: 120,
  },
  layer: { gap: 6 },
  pill: {
    ...outline,
    backgroundColor: colors.canvas,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  pillOn: { backgroundColor: colors.edge },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pillText: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fontSizes.base },
  pillTextOn: { color: colors.text, fontWeight: "700" },
  preview: {
    alignItems: "center",
    backgroundColor: colors.sidebar,
    borderRadius: radii.lg,
    justifyContent: "center",
    padding: 18,
  },
  section: {
    color: colors.textMuted,
    fontFamily: fonts.sans,
    fontSize: 12,
  },
  stage: { flexDirection: "row", gap: 18, padding: 16 },
  stageHint: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.base },
  stageSide: { flex: 1, gap: 12, justifyContent: "center" },
  step: {
    borderBottomColor: "transparent",
    borderBottomWidth: 3,
    paddingBottom: 8,
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  stepBar: { borderBottomColor: colors.border, borderBottomWidth: 1, flexGrow: 0 },
  stepOn: { borderBottomColor: colors.danger },
  stepText: {
    color: colors.textMuted,
    fontFamily: fonts.sans,
    fontSize: fontSizes.sm,
    fontWeight: "700",
  },
  stepTextOn: { color: colors.text },
  tile: {
    alignItems: "center",
    backgroundColor: "rgba(214,183,132,0.28)",
    borderColor: "transparent",
    borderRadius: radii.lg,
    borderWidth: 2,
    gap: 4,
    padding: 8,
    width: 84,
  },
  tileLabel: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  tileOn: { borderColor: colors.accent },
  title: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.xl, fontWeight: "700" },
  window: {
    ...outline,
    backgroundColor: colors.page,
    borderRadius: radii.xl,
    maxWidth: 640,
    overflow: "hidden",
    width: "100%",
  },
});
