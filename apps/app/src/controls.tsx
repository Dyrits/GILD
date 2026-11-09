import { type MissionState, type Skill, skillTokensOf, type ThreadState } from "@gild/contracts";
import { type ReactNode, useState } from "react";
import { Pressable, Switch, Text, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { styles } from "./styles";
import { colors, stateLabels, stateTones } from "./theme";

// The web's switch takes the thumb's color when on from a prop the native types do not declare.
const webSwitchColors = { activeThumbColor: colors.canvas };

/** An on and off switch in the accent color. */
export function Toggle({ onValueChange, value }: { onValueChange: (value: boolean) => void; value: boolean }) {
  return (
    <Switch
      {...webSwitchColors}
      onValueChange={onValueChange}
      thumbColor={colors.canvas}
      trackColor={{ false: colors.controlActive, true: colors.accent }}
      value={value}
    />
  );
}

/** The glyph before a state that ends: a tick for Done, a cross for Failed; a dot for every other state. */
const stateGlyphs: Partial<Record<ThreadState | MissionState, string>> = { Done: "✓", Failed: "✕" };

/**
 * A state as it is marked on paper: Attention highlighted, Done ticked, Failed crossed, the others a dot of their
 * ink; no tinted pill.
 */
export function StateBadge({ state }: { state: ThreadState | MissionState }) {
  const tone = stateTones[state];
  const glyph = stateGlyphs[state] ?? null;
  return (
    <View style={[styles.badge, state === "Attention" && { backgroundColor: tone.soft }]}>
      {glyph === null ? (
        <View style={[styles.badgeDot, { backgroundColor: tone.color }]} />
      ) : (
        <Text style={[styles.badgeText, { color: tone.color }]}>{glyph}</Text>
      )}
      <Text style={[styles.badgeText, { color: tone.color }]}>{stateLabels[state]}</Text>
    </View>
  );
}

/** The send icon: an arrow drawn in paper ink, pointing up and away from the box. */
function SendArrow() {
  return (
    <Svg
      fill="none"
      height={16}
      stroke={colors.onAccent}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 16 16"
      width={16}
    >
      <Path d="M8 13.5 L 8.2 3" />
      <Path d="M3.5 7.2 L 8.2 2.6 L 12.6 7" />
    </Svg>
  );
}

/** The message's text drawn under the transparent input, with each slash-name of a known skill on a tinted background. */
function SkillHighlights({ skills, text }: { skills: ReadonlyArray<Skill>; text: string }) {
  const tokens = skillTokensOf(text).filter((token) => skills.some((skill) => skill.name === token.name));
  if (tokens.length === 0) return null;
  const parts: ReactNode[] = [];
  let at = 0;
  for (const token of tokens) {
    parts.push(text.slice(at, token.start));
    parts.push(
      <Text key={token.start} style={styles.skillChip}>
        {text.slice(token.start, token.end)}
      </Text>,
    );
    at = token.end;
  }
  parts.push(text.slice(at));
  return (
    <Text pointerEvents="none" style={styles.skillOverlay}>
      {parts}
    </Text>
  );
}

/**
 * A message box that keeps the text until the service accepts it, sent with Enter or the arrow button. While a thread runs, a smaller second
 * button sends the other way (Steer or Queue) and Interrupt ends the thread's current turn (CHG-0039).
 */
export function Composer({
  placeholder,
  onSend,
  alternative,
  onInterrupt,
  onChangeText,
  accessory,
  skills = [],
}: {
  placeholder: string;
  onSend: (text: string) => Promise<unknown>;
  alternative?: { readonly label: string; readonly onSend: (text: string) => Promise<unknown> };
  onInterrupt?: () => Promise<unknown>;
  /** Hears the text as it is typed and cleared, such as to preview what it would send. */
  onChangeText?: (text: string) => void;
  /** Controls shown at the bottom left of the box, such as pickers for what the message starts. */
  accessory?: ReactNode;
  /** The skills a slash offers; a slash-name matching one is highlighted. */
  skills?: ReadonlyArray<Skill>;
}) {
  const [text, setTextState] = useState("");
  const setText = (value: string) => {
    setTextState(value);
    setChosen(0);
    onChangeText?.(value);
  };
  const [isSending, setIsSending] = useState(false);
  const isEmpty = text.trim() === "";
  const [error, setError] = useState<string | null>(null);
  const partial = /(^|\s)\/([\w:.-]*)$/.exec(text)?.[2] ?? null;
  const suggestions =
    partial === null || skills.some((skill) => skill.name === partial)
      ? []
      : skills.filter((skill) => skill.name.toLowerCase().startsWith(partial.toLowerCase())).slice(0, 6);
  const [chosen, setChosen] = useState(0);
  const highlighted = suggestions[Math.min(chosen, suggestions.length - 1)];
  const pick = (skill: Skill) => setText(`${text.slice(0, text.length - (partial?.length ?? 0))}${skill.name} `);
  const send = async (handler: (text: string) => Promise<unknown>) => {
    if (text.trim() === "" || isSending) return;
    setIsSending(true);
    try {
      await handler(text);
      setText("");
      setError(null);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setIsSending(false);
    }
  };
  const interrupt = (handler: () => Promise<unknown>) =>
    handler().then(
      () => setError(null),
      (reason: Error) => setError(reason.message),
    );
  return (
    <View style={styles.composer}>
      {suggestions.length > 0 && (
        <View style={styles.skillList}>
          {suggestions.map((skill) => (
            <Pressable
              key={skill.name}
              onPress={() => pick(skill)}
              style={[styles.skillOption, skill === highlighted && styles.skillOptionChosen]}
            >
              <Text style={styles.skillName}>/{skill.name}</Text>
              <Text numberOfLines={1} style={styles.skillDescription}>
                {skill.description}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <View>
        <SkillHighlights skills={skills} text={text} />
        <TextInput
          multiline
          onChangeText={setText}
          onKeyPress={(event) => {
            const native = event.nativeEvent as { key: string; shiftKey?: boolean };
            if (highlighted !== undefined) {
              const moves: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };
              const move = moves[native.key];
              if (move !== undefined) {
                event.preventDefault();
                setChosen((Math.min(chosen, suggestions.length - 1) + move + suggestions.length) % suggestions.length);
                return;
              }
              if (native.key === "Tab" || (native.key === "Enter" && !native.shiftKey)) {
                event.preventDefault();
                pick(highlighted);
                return;
              }
            }
            if (native.key === "Enter" && !native.shiftKey) {
              event.preventDefault();
              void send(onSend);
            }
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          style={[
            styles.composerInput,
            skillTokensOf(text).some((token) => skills.some((skill) => skill.name === token.name)) &&
              styles.composerInputOverlaid,
          ]}
          value={text}
        />
      </View>
      <View style={styles.composerActions}>
        <View style={styles.composerAccessory}>{accessory}</View>
        {onInterrupt !== undefined && (
          <Pressable onPress={() => interrupt(onInterrupt)} style={styles.buttonSecondary}>
            <Text style={styles.buttonSecondaryText}>Interrupt</Text>
          </Pressable>
        )}
        {alternative !== undefined && (
          <Pressable
            disabled={isSending}
            onPress={() => send(alternative.onSend)}
            style={[styles.buttonSecondary, isSending && styles.buttonDisabled]}
          >
            <Text style={styles.buttonSecondaryText}>{alternative.label}</Text>
          </Pressable>
        )}
        <Pressable
          accessibilityLabel="Send"
          accessibilityRole="button"
          disabled={isSending || isEmpty}
          onPress={() => send(onSend)}
          style={[styles.sendButton, (isSending || isEmpty) && styles.buttonDisabled]}
        >
          <SendArrow />
        </Pressable>
      </View>
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}
