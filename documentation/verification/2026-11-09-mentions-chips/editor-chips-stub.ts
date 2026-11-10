export const iconPaths = {
  file: ["M3.5 1.5 H9.5 L12.5 4.5 V14.5 H3.5 Z", "M9.5 1.5 V4.5 H12.5"],
  folder: ["M1.5 3.5 H6 L7.5 5 H14.5 V13 H1.5 Z"],
  skill: ["M2.5 5.5 H6 a1.5 1.5 0 0 1 3 0 H11.5 V8 a1.5 1.5 0 0 1 0 3 V13.5 H2.5 Z"],
} as const;
export type ChipKind = keyof typeof iconPaths;
