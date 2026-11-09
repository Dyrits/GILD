import { Crest, crestBands, crestChargeIds, crestDivisions, crestPlates } from "@gild/contracts";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { crestCharges } from "../src/crestCharges";
import {
  bandShape,
  crestOf,
  defaultCrestOf,
  divisionPath,
  palettes,
  plateBox,
  platePath,
  shuffledCrest,
} from "../src/crestShapes";

const isCrest = Schema.is(Crest);

describe("drawing a crest", () => {
  it("cuts every plate to a path inside the grid, and none to nothing", () => {
    expect(platePath("None", plateBox)).toBe("");
    for (const plate of crestPlates.filter((each) => each !== "None")) {
      const d = platePath(plate, plateBox);
      expect(d.startsWith("M"), plate).toBe(true);
      const numbers = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
      expect(numbers.length, plate).toBeGreaterThan(5);
      // Every plate leaves room around it for its trim.
      expect(Math.min(...numbers.filter((value) => value !== 0 && value !== 1)), plate).toBeGreaterThanOrEqual(0);
    }
  });

  it("divides a field into a second-color shape, except a plain one", () => {
    expect(divisionPath("Plain", plateBox)).toBe("");
    for (const division of crestDivisions.filter((each) => each !== "Plain")) {
      expect(divisionPath(division, plateBox).length, division).toBeGreaterThan(0);
    }
  });

  it("lays a band as a fill or a line of the asked width, except none and the bordure", () => {
    expect(bandShape("None", plateBox, 1)).toBeNull();
    expect(bandShape("Bordure", plateBox, 1)).toBeNull();
    for (const band of crestBands.filter((each) => each !== "None" && each !== "Bordure")) {
      expect(bandShape(band, plateBox, 1)?.d.length, band).toBeGreaterThan(0);
    }
    const thin = bandShape("Bend", plateBox, 0.5);
    const wide = bandShape("Bend", plateBox, 2);
    expect(thin?.kind === "stroke" && wide?.kind === "stroke" && wide.width > thin.width).toBe(true);
  });
});

describe("the crest a realm wears before its owner designs one", () => {
  it("is always the same for the same id, and valid", () => {
    expect(defaultCrestOf("realm-1")).toEqual(defaultCrestOf("realm-1"));
    expect(isCrest(defaultCrestOf("realm-1"))).toBe(true);
  });

  it("differs between ids, so most realms look apart", () => {
    const looks = new Set(Array.from({ length: 40 }, (_, index) => JSON.stringify(defaultCrestOf(`realm-${index}`))));
    expect(looks.size).toBeGreaterThan(30);
  });

  it("gives way to the crest the owner designed", () => {
    const designed = shuffledCrest(() => 0.5);
    expect(crestOf(designed, "realm-1")).toBe(designed);
    expect(crestOf(null, "realm-1")).toEqual(defaultCrestOf("realm-1"));
  });

  it("shuffles into a valid crest", () => {
    expect(isCrest(shuffledCrest())).toBe(true);
    expect(isCrest(shuffledCrest(() => 0))).toBe(true);
    expect(isCrest(shuffledCrest(() => 0.999))).toBe(true);
  });

  it("has artwork for every heraldic figure, and valid palettes", () => {
    for (const id of crestChargeIds) expect(crestCharges[id].d, id).toMatch(/^[Mm]/);
    for (const palette of palettes)
      expect(isCrest({ ...defaultCrestOf("x"), colors: palette.colors }), palette.name).toBe(true);
  });
});
