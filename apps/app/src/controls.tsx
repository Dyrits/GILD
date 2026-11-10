import type { AttachmentId, MissionState, Skill, ThreadState } from "@gild/contracts";
import { type ReactNode, useRef, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { AttachButton } from "./attachButton";
import { AttachmentStrip } from "./attachmentViews";
import { ChipEditor } from "./chipEditor";
import type { Chip, ChipEditorHandle, Trigger } from "./chipEditorTypes";
import { ChipIcon } from "./chips";
import { messageOf, type ServiceClient } from "./client";
import { styles } from "./styles";
import { colors, stateLabels, stateTones } from "./theme";
import { useAttachments } from "./useAttachments";
import { useWorkspaceEntries } from "./useWorkspaceEntries";

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

/** One way to complete what is typed after a `/` or `@`: the chip it becomes and what the list shows. */
interface Completion extends Chip {
  readonly description: string;
  readonly key: string;
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
  /** Controls shown at the bottom left of the box, such as pickers for what the message starts. */
  accessory?: ReactNode;
  /** The skills a slash offers; a slash-name matching one is highlighted. */
  skills?: ReadonlyArray<Skill>;
  /** The workspace an `@` names files and folders of; with no path (a quest outside a realm) an `@` offers nothing. */
  mentions?: { readonly client: ServiceClient; readonly workspacePath: string | null };
  onBang?: () => void;
  /** Whether an attached terminal can be sent without typed text. */
  hasContent?: boolean;
}) {
  const [text, setText] = useState("");
  const [trigger, setTrigger] = useState<Trigger | null>(null);
  const editor = useRef<ChipEditorHandle>(null);
  const [isSending, setIsSending] = useState(false);
  const files = useAttachments(attachable?.client ?? null);
  // A message may hold images alone.
  const isEmpty = text.trim() === "" && files.ids.length === 0 && !hasContent;
  const refusal = files.ids.length > 0 ? (attachable?.refusal ?? null) : null;
  const cannotSend = isEmpty || files.isBusy || refusal !== null;
  const [error, setError] = useState<string | null>(null);
  const partial = trigger?.character === "/" ? trigger.query : null;
  const mentioned = trigger?.character === "@" ? trigger.query : null;
  const entries = useWorkspaceEntries(mentions?.client, mentions?.workspacePath ?? null, mentioned);
  // What the typed word can be completed to; a name already complete offers nothing more.
  const options: ReadonlyArray<Completion> =
    partial !== null
      ? skills
          .filter((skill) => skill.name !== partial && skill.name.toLowerCase().startsWith(partial.toLowerCase()))
          .slice(0, 6)
          .map((skill) => ({
            description: skill.description,
            key: skill.name,
            kind: "skill" as const,
            label: skill.name,
            token: `/${skill.name}`,
          }))
      : mentioned === null
        ? []
        : entries
            .filter((entry) => entry.path !== mentioned)
            .map((entry) => ({
              description: "",
              key: entry.path,
              kind: entry.kind,
              label: entry.path,
              token: `@${entry.path}`,
            }));
  const [chosen, setChosen] = useState(0);
  const highlighted = options[Math.min(chosen, options.length - 1)];
  const pick = (option: Completion) => editor.current?.insertChip(option);
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
      {options.length > 0 && (
        <View style={styles.skillList}>
          {options.map((option) => (
            <Pressable
              key={option.key}
              onPress={() => pick(option)}
              style={[styles.skillOption, option === highlighted && styles.skillOptionChosen]}
            >
              <ChipIcon kind={option.kind} />
              <Text style={styles.skillName}>{option.label}</Text>
              <Text numberOfLines={1} style={styles.skillDescription}>
                {option.description}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {attachable !== undefined && <AttachmentStrip files={files.files} onRemove={files.remove} />}
      <View style={styles.composerPill}>
        {attachable !== undefined && <AttachButton onFiles={files.attach} />}
        <View style={styles.composerField}>
          <ChipEditor
            {...(onBang === undefined ? {} : { onBang })}
            {...(attachable === undefined ? {} : { onFiles: files.attach })}
            onChange={(value, typed) => {
              setText(value);
              setTrigger(typed);
              setChosen(0);
              onChangeText?.(value);
            }}
            onKeyDown={({ key, shiftKey }) => {
              if (highlighted !== undefined) {
                const moves: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };
                const move = moves[key];
                if (move !== undefined) {
                  setChosen((Math.min(chosen, options.length - 1) + move + options.length) % options.length);
                  return true;
                }
                if (key === "Tab" || (key === "Enter" && !shiftKey)) {
                  pick(highlighted);
                  return true;
                }
              }
              if (key === "Enter" && !shiftKey) {
                void send(onSend);
                return true;
              }
              return false;
            }}
            placeholder={placeholder}
            ref={editor}
          />
        </View>
        {accessory !== undefined && <View style={styles.composerAccessory}>{accessory}</View>}
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
      {refusal !== null && <Text style={styles.error}>{refusal}</Text>}
      {files.error !== null && <Text style={styles.error}>{files.error}</Text>}
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}
