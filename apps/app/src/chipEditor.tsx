import { useImperativeHandle, useState } from "react";
import { TextInput } from "react-native";
import { type ChipEditorProps, triggerOfEnd } from "./chipEditorTypes";
import { styles } from "./styles";
import { colors } from "./theme";

/** The message box's text field where chips cannot be drawn inside the text: a chosen skill or path is written into it as its token. */
export function ChipEditor({ onChange, onKeyDown, placeholder, ref }: ChipEditorProps) {
  const [text, setText] = useState("");
  const change = (value: string) => {
    setText(value);
    onChange(value, triggerOfEnd(value));
  };
  useImperativeHandle(ref, () => ({
    clear: () => change(""),
    insertChip: (chip) => {
      const typed = triggerOfEnd(text);
      change(`${text.slice(0, text.length - (typed === null ? 0 : typed.query.length + 1))}${chip.token} `);
    },
  }));
  return (
    <TextInput
      multiline
      onChangeText={change}
      onKeyPress={(event) => {
        const native = event.nativeEvent as { key: string; shiftKey?: boolean };
        if (onKeyDown({ key: native.key, shiftKey: native.shiftKey === true })) event.preventDefault();
      }}
      placeholder={placeholder}
      placeholderTextColor={colors.placeholder}
      style={styles.composerInput}
      value={text}
    />
  );
}
