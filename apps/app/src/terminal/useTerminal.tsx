import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { messageOf } from "../foundation/client";
import { styles } from "../foundation/styles";
import { colors } from "../foundation/theme";
import { TerminalPanel } from "./terminalPanel";
import type { TerminalPanelHandle } from "./terminalPanelTypes";
import { messageWithTerminal } from "./terminalSnapshot";

/** Attaches the owner's shell transcript to messages from either kind of conversation. */
export function useTerminal(id: string, cwd: string | null) {
  const [hasTerminal, setHasTerminal] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panel = useRef<TerminalPanelHandle>(null);
  const isAvailable = typeof window !== "undefined" && window.iskios !== undefined;
  const sessionId = `${id}:${cwd ?? "home"}`;
  const open = () => {
    setHasTerminal(true);
    setIsVisible(true);
    requestAnimationFrame(() => panel.current?.focus());
  };
  const close = () => {
    void window.iskios
      ?.terminalClose(sessionId)
      .then(() => {
        setHasTerminal(false);
        setIsVisible(false);
        setIsReady(false);
        setError(null);
      })
      .catch((reason) => setError(messageOf(reason)));
  };
  return {
    hasContent: hasTerminal && isReady,
    onBang: isAvailable ? open : null,
    panel: !hasTerminal ? null : (
      <View style={[styles.messageRow, styles.messageRowUser, { width: "88%" }]}>
        <View style={[styles.messageCard, styles.messageCardUser, { flex: 1, gap: 4, padding: 8 }]}>
          <View style={styles.row}>
            <Text style={[styles.muted, styles.flex, { color: colors.textSecondary }]}>Terminal</Text>
            <Pressable onPress={isVisible ? () => setIsVisible(false) : open}>
              <Text style={[styles.link, { color: colors.textSecondary }]}>{isVisible ? "Hide" : "Show"}</Text>
            </Pressable>
            <Pressable onPress={close}>
              <Text style={[styles.link, { color: colors.textSecondary }]}>Close shell</Text>
            </Pressable>
          </View>
          {error !== null && <Text style={styles.error}>{error}</Text>}
          <View style={{ display: isVisible ? "flex" : "none" }}>
            <TerminalPanel cwd={cwd} id={sessionId} key={sessionId} onReady={() => setIsReady(true)} ref={panel} />
          </View>
        </View>
      </View>
    ),
    prepare: async (text: string) => {
      if (!hasTerminal) return text;
      if (panel.current === null) throw new Error("The terminal is not ready.");
      const snapshot = await panel.current.snapshot();
      return messageWithTerminal(text, snapshot.cwd, snapshot.text);
    },
    sent: () => {
      setHasTerminal(false);
      setIsVisible(false);
      setIsReady(false);
    },
  };
}
