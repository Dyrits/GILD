// Draws a crest (see crestShapes.ts for its parts); the system follows Crest Studio (github.com/pauljoda/Crest, MPL-2.0).

import type { Crest, MissionState } from "@gild/contracts";
import { useId } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { ClipPath, Defs, G, LinearGradient, Path, Stop, Text as SvgText } from "react-native-svg";
import { columnOf } from "./boardColumns";
import { crestCharges } from "./crestCharges";
import {
  type Box,
  bandShape,
  beadsPath,
  crestOf,
  divisionPath,
  plateBox,
  platePath,
  raysPath,
  scaledBox,
} from "./crestShapes";
import { type EmblemName, emblemPaths } from "./emblems";
import { colors, radii } from "./theme";

/** The dot of a quest in the rail: the dye of its column's banner, brightened to read on leather. */
const dotColors = { Attention: "#d0483d", Done: "#4ea26a", Idle: "#9a6fd6", Running: "#4f86d8" } as const;

/** The emblem's share of the plate at scale 1. */
const emblemFraction = 0.62;

/** The light laid over the field: a diagonal sheen, or an embossed top-to-bottom shading. */
function Finish({ finish, id }: { finish: Crest["finish"]; id: string }) {
  if (finish === "Flat") return null;
  const isSheen = finish === "Sheen";
  return (
    <LinearGradient id={id} x1={isSheen ? "0" : "0.5"} x2={isSheen ? "1" : "0.5"} y1="0" y2="1">
      <Stop offset="0" stopColor="#fff" stopOpacity={isSheen ? 0.34 : 0.22} />
      <Stop offset={isSheen ? "0.5" : "0.45"} stopColor="#fff" stopOpacity={isSheen ? 0.06 : 0} />
      <Stop offset="1" stopColor="#000" stopOpacity={isSheen ? 0.1 : 0.26} />
    </LinearGradient>
  );
}

/** The emblem the crest carries, centered on the plate. */
function EmblemView({ box, crest }: { box: Box; crest: Crest }) {
  const side = Math.min(box.width, box.height) * emblemFraction * crest.emblemScale;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const color = crest.colors.emblem;
  const emblem = crest.emblem;
  switch (emblem._tag) {
    case "Charge":
      return (
        <G transform={`translate(${cx - side / 2} ${cy - side / 2}) scale(${side / 512})`}>
          <Path d={crestCharges[emblem.id].d} fill={color} />
        </G>
      );
    case "Glyph": {
      const paths = emblemPaths[emblem.name as EmblemName];
      if (paths === undefined) return null;
      return (
        <G transform={`translate(${cx - side / 2} ${cy - side / 2}) scale(${side / 24})`}>
          {paths.map((d) => (
            <Path
              d={d}
              fill="none"
              key={d}
              stroke={color}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.9}
            />
          ))}
        </G>
      );
    }
    case "Text":
      return (
        <SvgText fill={color} fontSize={side * 0.9} fontWeight="700" textAnchor="middle" x={cx} y={cy + side * 0.32}>
          {emblem.text}
        </SvgText>
      );
  }
}

/**
 * A crest at any size: the plate with its field, its division, its band, its edge and its finish; the trim around it;
 * and the emblem. Taken from the designed crest, or from the id when none was designed.
 */
export function CrestView({ crest, size = 44 }: { crest: Crest; size?: number }) {
  // A clip and a gradient are named by the crest instance, so crests drawn together never share one.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const clip = `clip${uid}`;
  const finish = `finish${uid}`;
  const plate = platePath(crest.plate, plateBox);
  const division = divisionPath(crest.division, plateBox);
  const band = bandShape(crest.band, plateBox, crest.bandWidth);
  const lineWidth = Math.max(0.75, 100 * 0.022);
  const trimOutline = (scale: number, width: number) => (
    <Path
      d={platePath(crest.plate, scaledBox(plateBox, scale))}
      fill="none"
      stroke={crest.colors.trim}
      strokeLinejoin="round"
      strokeWidth={width}
    />
  );
  return (
    <View style={{ height: size, width: size }}>
      <Svg height={size} viewBox="0 0 100 100" width={size}>
        <Defs>
          {plate !== "" && (
            <ClipPath id={clip}>
              <Path d={plate} />
            </ClipPath>
          )}
          <Finish finish={crest.finish} id={finish} />
        </Defs>
        {plate !== "" && (
          <>
            <Path d={plate} fill={crest.colors.field} />
            <G clipPath={`url(#${clip})`}>
              {division !== "" && <Path d={division} fill={crest.colors.secondField} fillRule="evenodd" />}
              {band !== null &&
                (band.kind === "fill" ? (
                  <Path d={band.d} fill={crest.colors.band} />
                ) : (
                  <Path d={band.d} fill="none" stroke={crest.colors.band} strokeWidth={band.width} />
                ))}
              {crest.band === "Bordure" && (
                <Path
                  d={plate}
                  fill="none"
                  stroke={crest.colors.band}
                  strokeLinejoin="round"
                  strokeWidth={plateBox.width * 0.09 * crest.bandWidth * 2}
                />
              )}
              {crest.finish !== "Flat" && <Path d={plate} fill={`url(#${finish})`} />}
              {crest.edge > 0 && (
                <Path
                  d={plate}
                  fill="none"
                  stroke={crest.colors.edge}
                  strokeLinejoin="round"
                  strokeWidth={plateBox.width * 0.12 * crest.edge}
                />
              )}
            </G>
            {crest.trim === "Line" && trimOutline(1.1, lineWidth * 0.8)}
            {crest.trim === "DoubleLine" && (
              <>
                {trimOutline(1.09, lineWidth * 0.8)}
                {trimOutline(1.2, lineWidth * 0.6)}
              </>
            )}
            {crest.trim === "Seal" && (
              <Path
                d={platePath("Seal", scaledBox(plateBox, 1.14), 12)}
                fill="none"
                stroke={crest.colors.trim}
                strokeLinejoin="round"
                strokeWidth={lineWidth * 0.8}
              />
            )}
            {crest.trim === "Sunburst" && <Path d={raysPath(12, 0.41, 0.5, 0.35)} fill={crest.colors.trim} />}
            {crest.trim === "Beaded" && <Path d={beadsPath(24, 0.455, 0.018)} fill={crest.colors.trim} />}
          </>
        )}
        <EmblemView box={plate === "" ? { height: 100, width: 100, x: 0, y: 0 } : plateBox} crest={crest} />
      </Svg>
    </View>
  );
}

/**
 * The sign of a realm or a quest, by its id: the crest its owner designed, or the one the id gives. A quest adds a corner
 * dot in the color of its state. A quest in a realm passes the realm's id and crest, so one crest means one realm.
 */
export function CrestBadge({
  crest,
  id,
  isLoose = false,
  size = 18,
  state,
}: {
  crest?: Crest | null;
  id: string;
  /** A quest outside any realm has no crest, only a plain sign. */
  isLoose?: boolean;
  size?: number;
  state?: MissionState;
}) {
  return (
    <View style={{ height: size, width: size }}>
      {isLoose ? (
        // A quest outside any realm has no crest, only a lozenge, in the gold that reads on parchment and leather.
        <View accessibilityLabel="No realm" style={local.loose}>
          <Svg height={size * 0.7} viewBox="0 0 24 24" width={size * 0.7}>
            <Path
              d="M12 2 L21 12 L12 22 L3 12 Z"
              fill={colors.gold}
              fillOpacity={0.35}
              stroke={colors.gold}
              strokeLinejoin="round"
              strokeWidth={2}
            />
          </Svg>
        </View>
      ) : (
        <CrestView crest={crestOf(crest, id)} size={size} />
      )}
      {state !== undefined && (
        <View style={[local.dot, { backgroundColor: dotColors[columnOf(state)], borderColor: colors.leather }]} />
      )}
    </View>
  );
}

const local = StyleSheet.create({
  dot: {
    borderRadius: radii.pill,
    borderWidth: 1.5,
    bottom: -3,
    height: 9,
    position: "absolute",
    right: -3,
    width: 9,
  },
  loose: { alignItems: "center", height: "100%", justifyContent: "center", width: "100%" },
});
