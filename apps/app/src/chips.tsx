import { type MentionToken, mentionTokensOf, type Skill, skillTokensOf, type WorkspaceEntry } from "@gild/contracts";
import { type ReactNode, useEffect, useState } from "react";
import { Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { ServiceClient } from "./client";
import { styles } from "./styles";
import { colors } from "./theme";

// A chosen skill or workspace path drawn as a small chip with an icon, in the conversation and in the suggestion list.

const ICON_SIZE = 12;

/** The paths that draw each icon, in a 16-point box. */
export const iconPaths = {
  file: ["M3.5 1.5 H9.5 L12.5 4.5 V14.5 H3.5 Z", "M9.5 1.5 V4.5 H12.5"],
  folder: ["M1.5 3.5 H6 L7.5 5 H14.5 V13 H1.5 Z"],
  skill: ["M2.5 5.5 H6 a1.5 1.5 0 0 1 3 0 H11.5 V8 a1.5 1.5 0 0 1 0 3 V13.5 H2.5 Z"],
} as const;

export type ChipKind = keyof typeof iconPaths;

/** A small outline icon: a file, a folder, or a puzzle piece for a skill. */
export function ChipIcon({ kind }: { kind: ChipKind }) {
  return (
    <Svg
      fill="none"
      height={ICON_SIZE}
      stroke={colors.accentText}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      viewBox="0 0 16 16"
      width={ICON_SIZE}
    >
      {iconPaths[kind].map((path) => (
        <Path d={path} key={path} />
      ))}
    </Svg>
  );
}

/** What a path in a workspace is, or null when it is not there; known answers are kept while the app runs. */
const kinds = new Map<string, WorkspaceEntry["kind"] | null>();

/** Which of the `@`-paths name a file or a folder of the workspace; the others are plain text. */
export function useMentionKinds(
  client: ServiceClient | undefined,
  workspacePath: string | null,
  paths: ReadonlyArray<string>,
): ReadonlyMap<string, WorkspaceEntry["kind"]> {
  const [, setVersion] = useState(0);
  const key = paths.join("\0");
  // biome-ignore lint/correctness/useExhaustiveDependencies: the key identifies the paths.
  useEffect(() => {
    if (client === undefined || workspacePath === null) return;
    let isCurrent = true;
    for (const path of new Set(paths)) {
      const known = `${workspacePath}\0${path}`;
      if (kinds.has(known)) continue;
      kinds.set(known, null);
      client.request({ _tag: "ListWorkspaceEntries", query: path, workspacePath }).then(
        (entries) => {
          kinds.set(known, entries.find((entry) => entry.path === path)?.kind ?? null);
          if (isCurrent) setVersion((version) => version + 1);
        },
        () => kinds.delete(known),
      );
    }
    return () => {
      isCurrent = false;
    };
  }, [client, workspacePath, key]);
  const found = new Map<string, WorkspaceEntry["kind"]>();
  for (const path of paths) {
    const kind = workspacePath === null ? null : kinds.get(`${workspacePath}\0${path}`);
    if (kind !== null && kind !== undefined) found.set(path, kind);
  }
  return found;
}

/** The chosen names and paths in a text, in order, each with the icon it draws: known skills, and paths found in the workspace. */
export const chipsOf = (
  text: string,
  skills: ReadonlyArray<Skill>,
  mentions: ReadonlyMap<string, WorkspaceEntry["kind"]>,
): ReadonlyArray<{ readonly end: number; readonly kind: ChipKind; readonly start: number }> =>
  [
    ...skillTokensOf(text)
      .filter((token) => skills.some((skill) => skill.name === token.name))
      .map((token) => ({ end: token.end, kind: "skill" as const, start: token.start })),
    ...mentionTokensOf(text).flatMap((token: MentionToken) => {
      const kind = mentions.get(token.path);
      return kind === undefined ? [] : [{ end: token.end, kind, start: token.start }];
    }),
  ].sort((first, second) => first.start - second.start);

/** A message's text with each chosen skill or workspace path as a chip with its icon. */
export function ChipText({
  client,
  skills,
  text,
  workspacePath,
}: {
  client: ServiceClient;
  skills: ReadonlyArray<Skill>;
  text: string;
  workspacePath: string | null;
}) {
  const mentions = useMentionKinds(
    client,
    workspacePath,
    mentionTokensOf(text).map((token) => token.path),
  );
  const chips = chipsOf(text, skills, mentions);
  if (chips.length === 0) return <Text style={styles.body}>{text}</Text>;
  const parts: ReactNode[] = [];
  let at = 0;
  for (const chip of chips) {
    parts.push(text.slice(at, chip.start));
    parts.push(
      <View key={chip.start} style={styles.mentionChip}>
        <ChipIcon kind={chip.kind} />
        <Text style={styles.mentionChipText}>{text.slice(chip.start + 1, chip.end)}</Text>
      </View>,
    );
    at = chip.end;
  }
  parts.push(text.slice(at));
  return <Text style={styles.body}>{parts}</Text>;
}
