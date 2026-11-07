import type { MissionState, ThreadState } from "@openmission/contracts";
import { type ReactNode, useState } from "react";
import { Pressable, Switch, Text, TextInput, View } from "react-native";
import { styles } from "./styles";
import { colors, stateTones } from "./theme";

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

/** A state as a soft tinted pill with a dot. */
export function StateBadge({ state }: { state: ThreadState | MissionState }) {
  const tone = stateTones[state];
  return (
    <View style={[styles.badge, { backgroundColor: tone.soft }]}>
      <View style={[styles.badgeDot, { backgroundColor: tone.color }]} />
      <Text style={[styles.badgeText, { color: tone.color }]}>{state}</Text>
    </View>
  );
}

export /** One choice among a few options, shown as chips. */
function Choice<T extends string | null>({
  options,
  value,
  label,
  onChange,
}: {
  options: ReadonlyArray<T>;
  value: T;
  label: (option: T) => string;
  onChange: (option: T) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map((option) => (
        <Pressable
          key={String(option)}
          onPress={() => onChange(option)}
          style={[styles.chip, option === value && styles.chipSelected]}
        >
          <Text numberOfLines={1} style={[styles.chipText, option === value && styles.chipTextSelected]}>
            {label(option)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * One choice among a few options, shown as a compact pill that opens its list below it, as a composer's
 * model and effort pickers are.
 */
export function Menu<T extends string | null>({
  accessibilityLabel,
  options,
  value,
  label,
  onChange,
}: {
  accessibilityLabel: string;
  options: ReadonlyArray<T>;
  value: T;
  label: (option: T) => string;
  onChange: (option: T) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <View style={[styles.menu, isOpen && styles.menuOpen]}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        onPress={() => setIsOpen(!isOpen)}
        style={[styles.menuButton, isOpen && styles.menuButtonOpen]}
      >
        <Text numberOfLines={1} style={styles.menuButtonText}>
          {label(value)}
        </Text>
        <Text style={styles.menuCaret}>▾</Text>
      </Pressable>
      {isOpen && (
        <View style={styles.menuList}>
          {options.map((option) => (
            <Pressable
              accessibilityRole="menuitem"
              key={String(option)}
              onPress={() => {
                onChange(option);
                setIsOpen(false);
              }}
              style={[styles.menuItem, option === value && styles.menuItemSelected]}
            >
              <Text numberOfLines={1} style={[styles.menuItemText, option === value && styles.chipTextSelected]}>
                {label(option)}
              </Text>
              {option === value && <Text style={styles.chipTextSelected}>✓</Text>}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export /**
 * A message box that keeps the text until the service accepts it. While a thread runs, a smaller second
 * button sends the other way (Steer or Queue) and Interrupt ends the thread's current turn (CHG-0039).
 */
function Composer({
  placeholder,
  onSend,
  alternative,
  onInterrupt,
  onChangeText,
  accessory,
}: {
  placeholder: string;
  onSend: (text: string) => Promise<unknown>;
  alternative?: { readonly label: string; readonly onSend: (text: string) => Promise<unknown> };
  onInterrupt?: () => Promise<unknown>;
  /** Hears the text as it is typed and cleared, such as to preview what it would send. */
  onChangeText?: (text: string) => void;
  /** Controls shown at the bottom left of the box, such as pickers for what the message starts. */
  accessory?: ReactNode;
}) {
  const [text, setTextState] = useState("");
  const setText = (value: string) => {
    setTextState(value);
    onChangeText?.(value);
  };
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      <TextInput
        multiline
        onChangeText={setText}
        onKeyPress={(event) => {
          const native = event.nativeEvent as { key: string; shiftKey?: boolean };
          if (native.key === "Enter" && !native.shiftKey) {
            event.preventDefault();
            void send(onSend);
          }
        }}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        style={styles.composerInput}
        value={text}
      />
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
          disabled={isSending}
          onPress={() => send(onSend)}
          style={[styles.button, isSending && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>Send</Text>
        </Pressable>
      </View>
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}
