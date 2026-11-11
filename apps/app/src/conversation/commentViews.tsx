import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { countedOf } from "../foundation/labels";
import { styles as shared } from "../foundation/styles";
import { colors, fontSizes, fonts, outline, round } from "../foundation/theme";
import { aboutLabels, type Comment, type SentComment } from "./comments";
import { useComments } from "./useComments";

const styles = StyleSheet.create({
  actions: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "flex-end" },
  box: { ...outline, ...round, backgroundColor: colors.canvas, gap: 8, marginTop: 6, padding: 10 },
  note: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.md, lineHeight: 19 },
  quote: {
    borderLeftColor: colors.edge,
    borderLeftWidth: 3,
    color: colors.textMuted,
    fontFamily: fonts.sans,
    fontSize: fontSizes.sm,
    fontStyle: "italic",
    paddingLeft: 8,
  },
  row: { gap: 4, paddingVertical: 6 },
  sent: { gap: 6, marginTop: 8 },
  sentItem: { gap: 3 },
  tray: { ...outline, ...round, backgroundColor: colors.surface, gap: 2, marginBottom: 6, padding: 10 },
  trayList: { maxHeight: 180 },
  where: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.xs },
});

/** A small field for one comment: a quote above it, Enter saves, Escape cancels. */
export function CommentBox({
  initial = "",
  onCancel,
  onSave,
  quote,
  saveLabel,
}: {
  initial?: string;
  onCancel: () => void;
  onSave: (note: string) => void;
  quote: string;
  saveLabel: string;
}) {
  const [note, setNote] = useState(initial);
  const save = () => {
    if (note.trim() !== "") onSave(note.trim());
  };
  return (
    <View style={styles.box}>
      <Text numberOfLines={2} style={styles.quote}>
        {quote}
      </Text>
      <TextInput
        accessibilityLabel="Comment"
        autoFocus
        multiline
        onChangeText={setNote}
        onKeyPress={(event) => {
          const { key, shiftKey } = event.nativeEvent as { key: string; shiftKey?: boolean };
          if (key === "Enter" && shiftKey !== true) {
            event.preventDefault();
            save();
          } else if (key === "Escape") onCancel();
        }}
        placeholder="Comment; it is sent with your next message…"
        placeholderTextColor={colors.textMuted}
        style={shared.input}
        value={note}
      />
      <View style={styles.actions}>
        <Pressable onPress={onCancel}>
          <Text style={shared.link}>Cancel</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={note.trim() === ""}
          onPress={save}
          style={[shared.buttonSecondary, note.trim() === "" && shared.buttonDisabled]}
        >
          <Text style={shared.buttonSecondaryText}>{saveLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** One waiting comment in the tray: what it is about, its note, and ways to change or drop it. */
function TrayRow({ comment }: { comment: Comment }) {
  const comments = useComments();
  const [isEditing, setIsEditing] = useState(false);
  if (comments === null) return null;
  if (isEditing)
    return (
      <CommentBox
        initial={comment.note}
        onCancel={() => setIsEditing(false)}
        onSave={(note) => {
          comments.update(comment.id, note);
          setIsEditing(false);
        }}
        quote={comment.quote}
        saveLabel="Save"
      />
    );
  return (
    <View style={styles.row}>
      <Text style={styles.where}>
        On {aboutLabels[comment.about]}
        {comment.isSelection ? ", a passage" : ""}
      </Text>
      <Text numberOfLines={2} style={styles.quote}>
        {comment.quote}
      </Text>
      <Text style={styles.note}>{comment.note}</Text>
      <View style={styles.actions}>
        <Pressable onPress={() => setIsEditing(true)}>
          <Text style={shared.link}>Edit</Text>
        </Pressable>
        <Pressable accessibilityLabel="Remove comment" onPress={() => comments.remove(comment.id)}>
          <Text style={shared.link}>Remove</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** The comments waiting above the message box; empty when there are none. */
export function CommentTray() {
  const comments = useComments();
  if (comments === null || comments.items.length === 0) return null;
  return (
    <View style={styles.tray}>
      <Text style={shared.stepsCount}>{countedOf(comments.items.length, "comment")} · sent with your next message</Text>
      <ScrollView style={styles.trayList}>
        {comments.items.map((comment) => (
          <TrayRow comment={comment} key={comment.id} />
        ))}
      </ScrollView>
    </View>
  );
}

/** The comments a sent message carried, drawn under its text as the passages they were about. */
export function SentComments({ items }: { items: ReadonlyArray<SentComment> }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.sent}>
      {items.map((item) => (
        <View key={`${item.about}:${item.quote}:${item.note}`} style={styles.sentItem}>
          <Text style={styles.where}>
            Comment on {aboutLabels[item.about]}
            {item.isSelection ? ", a passage" : ""}
          </Text>
          <Text numberOfLines={3} style={styles.quote}>
            {item.quote}
          </Text>
          <Text style={styles.note}>{item.note}</Text>
        </View>
      ))}
    </View>
  );
}
