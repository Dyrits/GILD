// The geometry and the defaults of a crest, free of any view so they can be tested. The system follows Crest Studio
// (github.com/pauljoda/Crest, MPL-2.0): a plate cut to a shape, a field with a second color where a division puts it,
// a band across the field, an edge, a trim around the plate, and an emblem. Everything is drawn on a 100 by 100 grid.

import type { Crest, CrestEmblem } from "@gild/contracts";
import { crestChargeIds } from "@gild/contracts";

/** A box on the grid. */
export type Box = { height: number; width: number; x: number; y: number };

/** The plate's share of the grid, before any scaling. */
export const plateFraction = 0.78;

/** The plate's box on the 100 by 100 grid, centered. */
export const plateBox: Box = {
  height: 100 * plateFraction,
  width: 100 * plateFraction,
  x: (100 - 100 * plateFraction) / 2,
  y: (100 - 100 * plateFraction) / 2,
};

const n = (value: number) => Math.round(value * 100) / 100;

const polygon = (box: Box, sides: number, rotation: number) => {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const radius = Math.min(box.width, box.height) / 2;
  return `${Array.from({ length: sides }, (_, index) => {
    const angle = rotation + (index / sides) * 2 * Math.PI;
    return `${index === 0 ? "M" : "L"}${n(cx + Math.cos(angle) * radius)} ${n(cy + Math.sin(angle) * radius)}`;
  }).join(" ")} Z`;
};

const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${n(cx - rx)} ${n(cy)} A${n(rx)} ${n(ry)} 0 1 0 ${n(cx + rx)} ${n(cy)} A${n(rx)} ${n(ry)} 0 1 0 ${n(cx - rx)} ${n(cy)} Z`;

const scalloped = (box: Box, scallops: number) => {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const outer = Math.min(box.width, box.height) / 2;
  const inner = outer * 0.9;
  let d = "";
  for (let index = 0; index < scallops; index++) {
    const start = (index / scallops) * 2 * Math.PI - Math.PI / 2;
    const end = ((index + 1) / scallops) * 2 * Math.PI - Math.PI / 2;
    const mid = (start + end) / 2;
    if (index === 0) d += `M${n(cx + Math.cos(start) * inner)} ${n(cy + Math.sin(start) * inner)}`;
    d += ` Q${n(cx + Math.cos(mid) * outer * 1.08)} ${n(cy + Math.sin(mid) * outer * 1.08)} ${n(cx + Math.cos(end) * inner)} ${n(cy + Math.sin(end) * inner)}`;
  }
  return `${d} Z`;
};

/** The outline of a plate within a box. */
export const platePath = (plate: Crest["plate"], box: Box, teeth = 14): string => {
  const { x, y, width: w, height: h } = box;
  const p = (px: number, py: number) => `${n(x + px * w)} ${n(y + py * h)}`;
  switch (plate) {
    case "None":
      return "";
    case "Round":
      return ellipse(x + w / 2, y + h / 2, w / 2, h / 2);
    case "Oval":
      return ellipse(x + w / 2, y + h / 2, w * 0.39, h / 2);
    case "Shield":
      return `M${p(0.06, 0.08)} L${p(0.94, 0.08)} L${p(0.94, 0.46)} Q${p(0.94, 0.86)} ${p(0.5, 0.98)} Q${p(0.06, 0.86)} ${p(0.06, 0.46)} Z`;
    case "FrenchShield":
      return `M${p(0.08, 0.04)} L${p(0.92, 0.04)} L${p(0.92, 0.7)} Q${p(0.92, 0.97)} ${p(0.5, 0.97)} Q${p(0.08, 0.97)} ${p(0.08, 0.7)} Z`;
    case "Lozenge":
      return `M${p(0.5, 0.02)} L${p(0.96, 0.5)} L${p(0.5, 0.98)} L${p(0.04, 0.5)} Z`;
    case "Hexagon":
      return polygon(box, 6, -Math.PI / 2);
    case "Octagon":
      return polygon(box, 8, Math.PI / 8);
    case "RoundedSquare": {
      const rx = w * 0.22;
      const ry = h * 0.22;
      const [x0, y0, x1, y1] = [x + w * 0.05, y + h * 0.05, x + w * 0.95, y + h * 0.95];
      return `M${n(x0 + rx)} ${n(y0)} H${n(x1 - rx)} A${n(rx)} ${n(ry)} 0 0 1 ${n(x1)} ${n(y0 + ry)} V${n(y1 - ry)} A${n(rx)} ${n(ry)} 0 0 1 ${n(x1 - rx)} ${n(y1)} H${n(x0 + rx)} A${n(rx)} ${n(ry)} 0 0 1 ${n(x0)} ${n(y1 - ry)} V${n(y0 + ry)} A${n(rx)} ${n(ry)} 0 0 1 ${n(x0 + rx)} ${n(y0)} Z`;
    }
    case "Seal":
      return scalloped(box, Math.max(6, teeth));
    case "Banner":
      return `M${p(0.12, 0.04)} L${p(0.88, 0.04)} L${p(0.88, 0.76)} L${p(0.5, 0.97)} L${p(0.12, 0.76)} Z`;
    case "Badge": {
      const r = w * 0.44;
      const cx = x + w / 2;
      const cy = y + h * 0.44;
      const dx = r * Math.cos((20 * Math.PI) / 180);
      const dy = r * Math.sin((20 * Math.PI) / 180);
      return `M${n(cx - dx)} ${n(cy + dy)} A${n(r)} ${n(r)} 0 1 1 ${n(cx + dx)} ${n(cy + dy)} L${p(0.5, 0.98)} Z`;
    }
  }
};

/** The part of the field that takes the second color, as a path to fill; empty for a plain field. */
export const divisionPath = (division: Crest["division"], box: Box, count = 4): string => {
  const { x, y, width: w, height: h } = box;
  const p = (px: number, py: number) => `${n(x + px * w)} ${n(y + py * h)}`;
  const rect = (rx: number, ry: number, rw: number, rh: number) =>
    `M${n(rx)} ${n(ry)} h${n(rw)} v${n(rh)} h${n(-rw)} Z`;
  const cells = Math.max(2, count);
  switch (division) {
    case "Plain":
      return "";
    case "PerPale":
      return rect(x + w / 2, y, w / 2, h);
    case "PerFess":
      return rect(x, y + h / 2, w, h / 2);
    case "PerBend":
      return `M${p(1, 0)} L${p(1, 1)} L${p(0, 1)} Z`;
    case "PerChevron":
      return `M${p(0, 0.48)} L${p(0.5, 0.68)} L${p(1, 0.48)} L${p(1, 1)} L${p(0, 1)} Z`;
    case "Quarterly":
      return `${rect(x + w / 2, y, w / 2, h / 2)} ${rect(x, y + h / 2, w / 2, h / 2)}`;
    case "PerSaltire":
      return `M${p(0, 0)} L${p(1, 0)} L${p(0.5, 0.5)} Z M${p(0, 1)} L${p(1, 1)} L${p(0.5, 0.5)} Z`;
    case "Gyronny": {
      const wedges = cells * 2;
      const cx = x + w / 2;
      const cy = y + h / 2;
      const radius = Math.max(w, h);
      let d = "";
      for (let index = 0; index < wedges; index += 2) {
        const a = (index / wedges) * 2 * Math.PI - Math.PI / 2;
        const b = ((index + 1) / wedges) * 2 * Math.PI - Math.PI / 2;
        d += `M${n(cx)} ${n(cy)} L${n(cx + Math.cos(a) * radius)} ${n(cy + Math.sin(a) * radius)} L${n(cx + Math.cos(b) * radius)} ${n(cy + Math.sin(b) * radius)} Z `;
      }
      return d.trim();
    }
    case "Barry":
      return Array.from({ length: Math.floor(cells / 2) }, (_, i) =>
        rect(x, y + (2 * i + 1) * (h / cells), w, h / cells),
      ).join(" ");
    case "Paly":
      return Array.from({ length: Math.floor(cells / 2) }, (_, i) =>
        rect(x + (2 * i + 1) * (w / cells), y, w / cells, h),
      ).join(" ");
    case "Checky": {
      let d = "";
      for (let row = 0; row < cells; row++)
        for (let column = 0; column < cells; column++)
          if ((row + column) % 2 === 1)
            d += `${rect(x + column * (w / cells), y + row * (h / cells), w / cells, h / cells)} `;
      return d.trim();
    }
  }
};

/** A band, either a shape to fill or a line to stroke at a width; null for none. The bordure is drawn from the plate. */
export type BandShape = { d: string; kind: "fill" } | { d: string; kind: "stroke"; width: number };

/** The band laid across the field, centered on the box. */
export const bandShape = (band: Crest["band"], box: Box, widthFactor: number): BandShape | null => {
  const { x, y, width: w, height: h } = box;
  const p = (px: number, py: number) => `${n(x + px * w)} ${n(y + py * h)}`;
  const thickness = Math.min(w, h) * 0.17 * widthFactor;
  const line = (d: string): BandShape => ({ d, kind: "stroke", width: n(thickness) });
  const rect = (rx: number, ry: number, rw: number, rh: number) =>
    `M${n(rx)} ${n(ry)} h${n(rw)} v${n(rh)} h${n(-rw)} Z`;
  switch (band) {
    case "None":
    case "Bordure":
      return null;
    case "Pale":
      return { d: rect(x + w / 2 - thickness / 2, y, thickness, h), kind: "fill" };
    case "Fess":
      return { d: rect(x, y + h / 2 - thickness / 2, w, thickness), kind: "fill" };
    case "Bend":
      return line(`M${p(-0.1, -0.1)} L${p(1.1, 1.1)}`);
    case "Chevron":
      return line(`M${p(0.04, 0.78)} L${p(0.5, 0.34)} L${p(0.96, 0.78)}`);
    case "Cross":
      return {
        d: `${rect(x + w / 2 - thickness / 2, y, thickness, h)} ${rect(x, y + h / 2 - thickness / 2, w, thickness)}`,
        kind: "fill",
      };
    case "Saltire":
      return line(`M${p(-0.1, -0.1)} L${p(1.1, 1.1)} M${p(1.1, -0.1)} L${p(-0.1, 1.1)}`);
    case "Chief":
      return { d: rect(x, y, w, thickness * 1.4), kind: "fill" };
    case "Pall":
      return line(
        `M${p(0.02, 0.02)} L${p(0.5, 0.5)} M${p(0.98, 0.02)} L${p(0.5, 0.5)} M${p(0.5, 0.5)} L${p(0.5, 1.02)}`,
      );
    case "Pile": {
      const half = 0.28 * widthFactor;
      return { d: `M${p(0.5 - half, -0.02)} L${p(0.5 + half, -0.02)} L${p(0.5, 0.8)} Z`, kind: "fill" };
    }
    case "Canton": {
      const side = Math.min(w, h) * 0.36 * widthFactor;
      return { d: rect(x, y, side, side), kind: "fill" };
    }
    case "Roundel": {
      const r = (Math.min(w, h) * 0.34 * widthFactor) / 2;
      return { d: ellipse(x + w / 2, y + h / 2, r, r), kind: "fill" };
    }
  }
};

/** The plate's box scaled about its center, for the outlines of a trim. */
export const scaledBox = (box: Box, scale: number): Box => ({
  height: box.height * scale,
  width: box.width * scale,
  x: box.x + (box.width * (1 - scale)) / 2,
  y: box.y + (box.height * (1 - scale)) / 2,
});

/** Rays around the center, as a sunburst. */
export const raysPath = (rays: number, inner: number, outer: number, thickness: number): string => {
  const step = (2 * Math.PI) / rays;
  const spread = (step * Math.min(0.45, thickness)) / 2;
  let d = "";
  for (let index = 0; index < rays; index++) {
    const angle = index * step - Math.PI / 2;
    d += `M${n(50 + Math.cos(angle - spread) * 100 * inner)} ${n(50 + Math.sin(angle - spread) * 100 * inner)} L${n(50 + Math.cos(angle) * 100 * outer)} ${n(50 + Math.sin(angle) * 100 * outer)} L${n(50 + Math.cos(angle + spread) * 100 * inner)} ${n(50 + Math.sin(angle + spread) * 100 * inner)} Z `;
  }
  return d.trim();
};

/** Dots around the center, as a beaded border. */
export const beadsPath = (beads: number, radius: number, beadRadius: number): string => {
  let d = "";
  for (let index = 0; index < beads; index++) {
    const angle = (index / beads) * 2 * Math.PI - Math.PI / 2;
    d += `${ellipse(50 + Math.cos(angle) * 100 * radius, 50 + Math.sin(angle) * 100 * radius, 100 * beadRadius, 100 * beadRadius)} `;
  }
  return d.trim();
};

/** A set of layer colors with a name, from which a crest takes its look. */
export type Palette = { colors: Crest["colors"]; name: string };

const palette = (
  name: string,
  field: string,
  secondField: string,
  band: string,
  trim: string,
  emblem: string,
  edge: string,
): Palette => ({ colors: { band, edge, emblem, field, secondField, trim }, name });

/** The palettes a crest starts from, in the guild's dyes. */
export const palettes: ReadonlyArray<Palette> = [
  palette("Lion", "#8b1e1a", "#5e1210", "#d9ad4f", "#d9ad4f", "#f2d98a", "#3b0f0c"),
  palette("Winter", "#dfe6ea", "#9eb3c0", "#52657a", "#52657a", "#33465a", "#52657a"),
  palette("Storm", "#1f2d4a", "#324a73", "#c9a24a", "#c9a24a", "#e9d9a8", "#101a2e"),
  palette("Dragon", "#2b1a17", "#6e1f17", "#d65a31", "#d65a31", "#f0b070", "#120a09"),
  palette("Meadow", "#2f5e3a", "#6c8f4e", "#d8c27a", "#d8c27a", "#f1e6b8", "#1b3a23"),
  palette("Iron", "#33363b", "#585d65", "#b7a26a", "#b7a26a", "#d6d1c0", "#17181b"),
  palette("River", "#1d4d7a", "#2f7fa8", "#c8603a", "#c8603a", "#eaf1f5", "#0f2d49"),
  palette("Sun", "#a6501f", "#d98a3f", "#f0cf7a", "#f0cf7a", "#fff0c4", "#5a2a0e"),
  palette("Vigil", "#26262b", "#3c3c44", "#c9c2a6", "#c9c2a6", "#ece7d3", "#0e0e10"),
  palette("Parchment", "#efdcae", "#d9c08a", "#8b1e1a", "#8b1e1a", "#2b1d12", "#8a6a2f"),
];

/** A stable number from text, so a thing's look stays the same between renders and sessions. */
export const hashOf = (text: string) => {
  let hash = 7;
  for (const char of text) hash = (hash * 33 + char.charCodeAt(0)) % 1_000_003;
  return hash;
};

/** Plates a crest starts on when none was chosen; the rest are for the owner to pick. */
const startingPlates = [
  "Shield",
  "FrenchShield",
  "Round",
  "Hexagon",
  "Octagon",
  "RoundedSquare",
  "Seal",
  "Badge",
] as const;
const startingDivisions = ["Plain", "Plain", "PerPale", "PerFess", "PerBend", "Quarterly", "PerChevron"] as const;
const startingBands = ["None", "None", "Fess", "Pale", "Bend", "Chevron", "Chief"] as const;
const startingTrims = ["None", "None", "Line", "DoubleLine", "Beaded"] as const;

/** The crest a realm or a quest wears until its owner designs one: taken from its id, so it is always the same. */
export const defaultCrestOf = (id: string): Crest => {
  const hash = hashOf(id);
  const pick = <T>(list: ReadonlyArray<T>, salt: number) => list[Math.floor(hash / salt) % list.length] as T;
  const colors = pick(palettes, 3).colors;
  return {
    band: pick(startingBands, 7),
    bandWidth: 1,
    colors,
    division: pick(startingDivisions, 11),
    edge: 0.35,
    emblem: { _tag: "Charge", id: pick(crestChargeIds, 1) },
    emblemScale: 1,
    finish: "Flat",
    plate: pick(startingPlates, 13),
    trim: pick(startingTrims, 17),
  };
};

/** The crest to draw: the one the owner designed, or the one the id gives. */
export const crestOf = (designed: Crest | null | undefined, id: string): Crest => designed ?? defaultCrestOf(id);

/** The same crest with its emblem replaced. */
export const withEmblem = (crest: Crest, emblem: CrestEmblem): Crest => ({ ...crest, emblem });

/** A random crest, for Shuffle: any plate, field, band, trim, finish, charge and palette, within reason. */
export const shuffledCrest = (random: () => number = Math.random): Crest => {
  const pick = <T>(list: ReadonlyArray<T>) => list[Math.floor(random() * list.length)] as T;
  return {
    band: pick(["None", "Fess", "Pale", "Bend", "Chevron", "Cross", "Saltire", "Chief", "Pile"] as const),
    bandWidth: 1,
    colors: pick(palettes).colors,
    division: pick([
      "Plain",
      "PerPale",
      "PerFess",
      "PerBend",
      "PerChevron",
      "Quarterly",
      "PerSaltire",
      "Barry",
      "Paly",
    ] as const),
    edge: pick([0, 0.2, 0.35, 0.5]),
    emblem: { _tag: "Charge", id: pick(crestChargeIds) },
    emblemScale: 1,
    finish: pick(["Flat", "Sheen", "Embossed"] as const),
    plate: pick(startingPlates),
    trim: pick(["None", "Line", "DoubleLine", "Beaded", "Seal"] as const),
  };
};
