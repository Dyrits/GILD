import type { AttachmentId, MissionState, Skill, ThreadState } from "@iskios/contracts";
import { type ReactNode, useRef, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { AttachButton } from "../attachments/attachButton";
import { AttachmentStrip } from "../attachments/attachmentViews";
import { useAttachments } from "../attachments/useAttachments";
import { messageOf, type ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { colors, stateLabels, stateTones } from "../foundation/theme";
import { ChipEditor } from "./chipEditor";
import type { ChipEditorHandle } from "./chipEditorTypes";
import { ChipIcon } from "./chips";
import { type MenuRow, mentionCategories } from "./mentionMenu";
import { useComposerList } from "./useComposerList";

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

/** A conversation's state shown only by color, with its meaning available to assistive technology. */
export function StateIndicator({ state }: { state: ThreadState | MissionState }) {
  return (
    <View accessibilityLabel={stateLabels[state]} accessible style={styles.badge}>
      <View style={[styles.badgeDot, { backgroundColor: stateTones[state].color }]} />
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

/**
 * A message box that keeps the text until the service accepts it, sent with Enter or the arrow button. While a thread runs, a smaller second
 * button sends the other way (Steer or Queue) and Interrupt ends the thread's current turn (CHG-0039).
 */
export function Composer({
  placeholder,
  onSend,
  alternative,
  attachments: attachable,
  onInterrupt,
  onChangeText,
  accessory,
  onOpenSideQuest,
  skills = [],
  mentions,
  onBang,
  hasContent = false,
}: {
  placeholder: string;
  onSend: (text: string, attachmentIds: ReadonlyArray<AttachmentId>) => Promise<unknown>;
  alternative?: {
    readonly label: string;
    readonly onSend: (text: string, attachmentIds: ReadonlyArray<AttachmentId>) => Promise<unknown>;
  };
  /**
   * Images can be attached to the message (message-attachments): pasted, dropped, or chosen with the file button, and uploaded through
   * the client. `refusal` is why the Companion about to read the message cannot read images, or null; the message is then not sent.
   */
  attachments?: { readonly client: ServiceClient; readonly refusal: string | null };
  onInterrupt?: () => Promise<unknown>;
  /** Hears the text as it is typed and cleared, such as to preview what it would send. */
  onChangeText?: (text: string) => void;
  /** Controls shown under the box, at its right, such as pickers for what the message runs on. */
  accessory?: ReactNode;
  /** Opens a side-quest from the icon beside the attachment button. */
  onOpenSideQuest?: () => void;
  /** The skills a slash offers; a slash-name matching one is highlighted. */
  skills?: ReadonlyArray<Skill>;
  /**
   * What an `@` names: quests, side-quests, and realms, and the files and folders of the workspace when it has a path
   * (CHG-0181). Without it, an `@` offers nothing.
   */
  mentions?: { readonly client: ServiceClient; readonly workspacePath: string | null };
  onBang?: () => void;
  /** Whether an attached terminal can be sent without typed text. */
  hasContent?: boolean;
}) {
  const [text, setText] = useState("");
  const editor = useRef<ChipEditorHandle>(null);
  const [isSending, setIsSending] = useState(false);
  const files = useAttachments(attachable?.client ?? null);
  // A message may hold images alone.
  const isEmpty = text.trim() === "" && files.ids.length === 0 && !hasContent;
  const refusal = files.ids.length > 0 ? (attachable?.refusal ?? null) : null;
  const cannotSend = isEmpty || files.isBusy || refusal !== null;
  const [error, setError] = useState<string | null>(null);
  const list = useComposerList(skills, mentions);
  const choose = (row: MenuRow) => {
    const chip = list.choose(row);
    if (chip !== null) editor.current?.insertChip(chip);
  };
  const send = async (handler: (text: string, attachmentIds: ReadonlyArray<AttachmentId>) => Promise<unknown>) => {
    if (cannotSend || isSending) return;
    setIsSending(true);
    try {
      await handler(text.trim(), files.ids);
      editor.current?.clear();
      files.clear();
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
      (reason) => setError(messageOf(reason)),
    );
  return (
    <View style={styles.composer}>
      {list.rows.length > 0 && (
        <View style={styles.skillList}>
          {list.rows.map((row) =>
            row.type === "heading" ? (
              <Text key={row.key} style={styles.mentionHeading}>
                {mentionCategories[row.category].label}
              </Text>
            ) : (
              <Pressable
                key={row.key}
                onPress={() => choose(row)}
                style={[styles.skillOption, row === list.highlighted && styles.skillOptionChosen]}
              >
                <ChipIcon kind={row.type === "category" ? mentionCategories[row.category].kind : row.chip.kind} />
                <Text style={styles.skillName}>
                  {row.type === "category" ? mentionCategories[row.category].label : row.chip.label}
                </Text>
                <Text numberOfLines={1} style={styles.skillDescription}>
                  {row.type === "category" ? "›" : row.description}
                </Text>
              </Pressable>
            ),
          )}
        </View>
      )}
      {attachable !== undefined && <AttachmentStrip files={files.files} onRemove={files.remove} />}
      <View style={styles.composerPill}>
        {attachable !== undefined && <AttachButton onFiles={files.attach} />}
        {onOpenSideQuest !== undefined && (
          <Pressable
            accessibilityLabel="Open side-quest"
            accessibilityRole="button"
            onPress={onOpenSideQuest}
            style={styles.buttonSecondary}
          >
            <Svg
              fill="none"
              height={18}
              stroke={colors.textDim}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.6}
              viewBox="0 0 20 20"
              width={18}
            >
              <Path d="M5 3v14M5 7h5a5 5 0 0 0 5-5M12 3l3-1 1 3" />
            </Svg>
          </Pressable>
        )}
        <View style={styles.composerField}>
          <ChipEditor
            {...(onBang === undefined ? {} : { onBang })}
            {...(attachable === undefined ? {} : { onFiles: files.attach })}
            onChange={(value, typed) => {
              setText(value);
              list.onTyped(typed);
              onChangeText?.(value);
            }}
            onKeyDown={(key) => {
              const pressed = list.onKey(key);
              if (pressed.chip !== null) editor.current?.insertChip(pressed.chip);
              if (pressed.handled) return true;
              if (key.key === "Enter" && !key.shiftKey) {
                void send(onSend);
                return true;
              }
              return false;
            }}
            placeholder={placeholder}
            ref={editor}
          />
        </View>
        <View style={styles.composerActions}>
          {onInterrupt !== undefined && (
            <Pressable onPress={() => interrupt(onInterrupt)} style={styles.buttonSecondary}>
              <Text style={styles.buttonSecondaryText}>Interrupt</Text>
            </Pressable>
          )}
          {alternative !== undefined && (
            <Pressable
              disabled={isSending || cannotSend}
              onPress={() => send(alternative.onSend)}
              style={[styles.buttonSecondary, (isSending || cannotSend) && styles.buttonDisabled]}
            >
              <Text style={styles.buttonSecondaryText}>{alternative.label}</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityLabel="Send"
            accessibilityRole="button"
            disabled={isSending || cannotSend}
            onPress={() => send(onSend)}
            style={[styles.sendButton, (isSending || cannotSend) && styles.buttonDisabled]}
          >
            <SendArrow />
          </Pressable>
        </View>
      </View>
      {accessory !== undefined && <View style={styles.composerAccessory}>{accessory}</View>}
      {refusal !== null && <Text style={styles.error}>{refusal}</Text>}
      {files.error !== null && <Text style={styles.error}>{files.error}</Text>}
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}
