import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { useAppUpdates } from "../foundation/useAppUpdates";
import { UpdateModal } from "./updateModal";

/**
 * A quiet notice in the top bar once a newer release has downloaded: pressing it opens the question that installs
 * it. Later closes the question and hides the notice until the next release; the Workshop's Updates section keeps
 * the way to install.
 */
export function UpdateNotice() {
  const updates = useAppUpdates();
  const [isAsking, setIsAsking] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const status = updates?.state?.status;
  if (updates === null || status === undefined || status._tag !== "Ready" || dismissed === status.version) return null;
  return (
    <>
      <Pressable
        accessibilityLabel={`Iskios ${status.version} is ready to install`}
        accessibilityRole="button"
        onPress={() => setIsAsking(true)}
        style={({ pressed }) => [local.notice, pressed && local.pressed]}
      >
        <Text style={local.text}>Update ready · {status.version}</Text>
      </Pressable>
      {isAsking && (
        <UpdateModal
          bridge={updates.bridge}
          notes={status.notes}
          onClose={() => {
            setIsAsking(false);
            setDismissed(status.version);
          }}
          version={status.version}
        />
      )}
    </>
  );
}

const local = StyleSheet.create({
  notice: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pressed: { opacity: 0.7 },
  text: { color: colors.accentText, fontFamily: fonts.sans, fontSize: fontSizes.sm, fontWeight: "600" },
});
