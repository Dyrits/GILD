import type { WorkspaceChoice } from "@iskios/contracts";
import { useRef, useState } from "react";
import { Pressable, type StyleProp, Text, TextInput, type TextStyle, View } from "react-native";
import { messageOf, type ServiceClient } from "../foundation/client";
import { allMissions } from "../foundation/queries";
import { styles } from "../foundation/styles";
import { Button } from "../ui/button";
import { RealmDialog } from "../ui/realmDialog";
import { hasRealmNameCollision } from "./realmLabels";

/** Renames a realm inline, asking before accepting a duplicate active label. */
export function RealmName({
  client,
  realm,
  textStyle,
}: {
  client: ServiceClient;
  realm: WorkspaceChoice;
  textStyle: StyleProp<TextStyle>;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const editing = useRef<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [isBusy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const edit = (name: string | null) => {
    editing.current = name;
    setDraft(name);
  };
  const save = async (name: string, allowDuplicateName = false) => {
    if (isBusy || name.trim() === "" || name.trim() === realm.name) return;
    edit(null);
    setBusy(true);
    try {
      const active = await client.request(allMissions.request);
      if (!allowDuplicateName && hasRealmNameCollision(name, active.workspaces, realm.id)) {
        setPending(name);
        return;
      }
      await client.request({ _tag: "RenameRealm", allowDuplicateName, name, workspaceId: realm.id });
      setError(null);
      setPending(null);
    } catch (reason) {
      setError(messageOf(reason));
      edit(name);
    } finally {
      setBusy(false);
    }
  };
  const submit = () => {
    const name = editing.current;
    if (name !== null) {
      edit(null);
      void save(name.trim());
    }
  };
  return (
    <View style={styles.flex}>
      {draft === null ? (
        <Pressable
          accessibilityHint="Press to rename the realm"
          accessibilityRole="button"
          disabled={isBusy}
          onPress={() => edit(realm.name)}
        >
          <Text numberOfLines={3} style={textStyle}>
            {realm.name}
          </Text>
        </Pressable>
      ) : (
        <TextInput
          accessibilityLabel="Realm name"
          autoFocus
          editable={!isBusy}
          maxLength={80}
          onBlur={submit}
          onChangeText={edit}
          onSubmitEditing={submit}
          style={textStyle}
          value={draft}
        />
      )}
      {error !== null && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {pending !== null && (
        <RealmDialog isBusy={isBusy} onCancel={() => setPending(null)} title="Use the same realm name?">
          <Text style={styles.body}>Another active realm is named "{pending}". Use this name too?</Text>
          <View style={styles.inlineRow}>
            <Button isDisabled={isBusy} label="Cancel" onPress={() => setPending(null)} />
            <Button
              isDisabled={isBusy}
              label="Use this name"
              onPress={() => {
                void save(pending, true);
              }}
            />
          </View>
        </RealmDialog>
      )}
    </View>
  );
}
