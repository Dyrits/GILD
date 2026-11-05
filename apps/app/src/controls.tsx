import type { ThreadState } from "@openmission/contracts";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { stateColors } from "./formatting";
import { styles } from "./styles";

export function StateBadge({ state }: { state: ThreadState }) {
  return (
    <View style={[styles.badge, { backgroundColor: stateColors[state] }]}>
      <Text style={styles.badgeText}>{state}</Text>
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

export /** A message box that keeps the text until the service accepts it. */
function Composer({ placeholder, onSend }: { placeholder: string; onSend: (text: string) => Promise<unknown> }) {
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    if (text.trim() === "" || isSending) return;
    setIsSending(true);
    try {
      await onSend(text);
      setText("");
      setError(null);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setIsSending(false);
    }
  };
  return (
    <View style={styles.composer}>
      <TextInput
        multiline
        onChangeText={setText}
        onKeyPress={(event) => {
          const native = event.nativeEvent as { key: string; shiftKey?: boolean };
          if (native.key === "Enter" && !native.shiftKey) {
            event.preventDefault();
            void send();
          }
        }}
        placeholder={placeholder}
        style={styles.input}
        value={text}
      />
      <Pressable disabled={isSending} onPress={send} style={[styles.button, isSending && styles.buttonDisabled]}>
        <Text style={styles.buttonText}>Send</Text>
      </Pressable>
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}
