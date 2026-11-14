import type { RealmAppearance, RealmArchivePreview } from "@iskios/contracts";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CrestBadge } from "../crest/crest";
import { messageOf, type ServiceClient } from "../foundation/client";
import { allMissions } from "../foundation/queries";
import { styles } from "../foundation/styles";
import { colors, outline, radii } from "../foundation/theme";
import { Button } from "../ui/button";
import { RealmDialog } from "../ui/realmDialog";
import { hasRealmNameCollision } from "./realmLabels";
import { comparisonOf, recoveryAppearanceOf } from "./realmRecovery";
import { initialRecoveryFlowOf, type RecoveryFlow, recoveryTitles, transitionRecovery } from "./realmRecoveryFlow";

/** Resolves an archived folder without changing data until all recovery choices have been confirmed. */
export function RealmRecoveryModal({
  client,
  initial,
  onCancel,
  onRecovered,
  proposed,
}: {
  client: ServiceClient;
  initial: RealmArchivePreview;
  onCancel: () => void;
  onRecovered: () => void;
  proposed: RealmAppearance | null;
}) {
  const [preview, setPreview] = useState(initial);
  const [flow, setFlow] = useState(() => initialRecoveryFlowOf(proposed !== null));
  const { step, picks } = flow;
  const [isBusy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const appearance = proposed === null ? preview.realm : recoveryAppearanceOf(preview.realm, proposed, picks);
  const comparison = comparisonOf(preview.realm, proposed ?? preview.realm);
  const proceed = async (next: RecoveryFlow, isWipeConfirmed = false) => {
    if (isBusy) return;
    const chosen = proposed === null ? preview.realm : recoveryAppearanceOf(preview.realm, proposed, next.picks);
    setFlow(next);
    setBusy(true);
    try {
      const active = await client.request(allMissions.request);
      const reviewed = transitionRecovery(next, {
        _tag: "Review",
        hasNameCollision: hasRealmNameCollision(chosen.name, active.workspaces, preview.realm.id),
        isWipeConfirmed,
      });
      setFlow(reviewed);
      if (reviewed.step !== "save") return;
      await client.request({
        _tag: "RestoreRealm",
        allowDuplicateName: reviewed.hasConfirmedName,
        appearance: chosen,
        shouldStartAfresh: reviewed.shouldStartAfresh,
        snapshot: preview.snapshot,
        workspaceId: preview.realm.id,
      });
      onRecovered();
    } catch (reason) {
      setError(messageOf(reason));
      // A stale preview cannot be confirmed again: show fresh counts and restart the choice.
      try {
        setPreview(await client.request({ _tag: "PreviewRealmArchive", workspaceId: preview.realm.id }));
        setFlow(transitionRecovery(next, { _tag: "Retry", hasProposal: proposed !== null }));
      } catch (refresh) {
        setError(messageOf(refresh));
      }
    } finally {
      setBusy(false);
    }
  };
  const choose = (shouldStartAfresh: boolean) => {
    const next = transitionRecovery(flow, {
      _tag: "Choose",
      hasDifferences: comparison.hasCrestDifference || comparison.hasNameDifference,
      shouldStartAfresh,
    });
    setFlow(next);
    if (next.step === "review") void proceed(next);
  };
  const continueRecovery = () => {
    void proceed(transitionRecovery(flow, { _tag: "Continue" }));
  };
  const cancel = () => {
    setFlow(transitionRecovery(flow, { _tag: "Cancel" }));
    onCancel();
  };
  return (
    <RealmDialog isBusy={isBusy} onCancel={cancel} title={recoveryTitles[step]}>
      <Text style={styles.body}>
        {preview.realm.name} · {preview.questCount} quests
        {preview.archivedAt === null ? "" : ` · archived ${new Date(preview.archivedAt).toLocaleDateString()}`}
      </Text>
      {step === "choice" && (
        <>
          <Text style={styles.body}>
            Restore its lore and quests, or start afresh with its old quests kept in the Archive.
          </Text>
          <View style={styles.inlineRow}>
            <Button isDisabled={isBusy} label="Restore" onPress={() => choose(false)} />
            <Button isDisabled={isBusy} label="Start afresh" onPress={() => choose(true)} />
          </View>
        </>
      )}
      {step === "comparison" && (
        <>
          <View style={local.columns}>
            {(["old", "proposed"] as const).map((side) => {
              const candidate = side === "old" ? preview.realm : (proposed ?? preview.realm);
              return (
                <View key={side} style={local.column}>
                  <Text style={styles.muted}>{side === "old" ? "Archived realm" : "New proposal"}</Text>
                  {comparison.hasNameDifference && (
                    <Pressable
                      accessibilityLabel={`${side === "old" ? "Keep" : "Use proposed"} name: ${candidate.name}`}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: picks.name === side }}
                      disabled={isBusy}
                      onPress={() => setFlow(transitionRecovery(flow, { _tag: "Pick", field: "name", value: side }))}
                      style={[local.option, picks.name === side && local.selected]}
                    >
                      <Text style={styles.body}>{candidate.name}</Text>
                      <Text style={styles.muted}>{picks.name === side ? "Selected name" : "Choose name"}</Text>
                    </Pressable>
                  )}
                  {comparison.hasCrestDifference && (
                    <Pressable
                      accessibilityLabel={side === "old" ? "Keep archived crest" : "Use proposed crest"}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: picks.crest === side }}
                      disabled={isBusy}
                      onPress={() => setFlow(transitionRecovery(flow, { _tag: "Pick", field: "crest", value: side }))}
                      style={[local.option, picks.crest === side && local.selected]}
                    >
                      <CrestBadge crest={candidate.crest} id={preview.realm.id} size={80} />
                      <Text style={styles.muted}>{picks.crest === side ? "Selected crest" : "Choose crest"}</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
          <Button isDisabled={isBusy} isPrimary label="Continue" onPress={continueRecovery} />
        </>
      )}
      {step === "wipe" && (
        <>
          <Text style={styles.body}>
            Delete {preview.loreCount} realm-level lore entries from "{preview.realm.name}"? Its {preview.questCount}{" "}
            quests stay archived with their own lore and history. No workspace files change. You can recover the deleted
            lore through the lore panel's Deleted filter.
          </Text>
          <Button
            isDisabled={isBusy}
            label="Wipe lore and start afresh"
            onPress={() => {
              void proceed(transitionRecovery(flow, { _tag: "Continue" }), true);
            }}
          />
        </>
      )}
      {(step === "duplicate" || step === "restore") && (
        <>
          <Text style={styles.body}>
            {step === "duplicate"
              ? `Another active realm is named "${appearance.name}". Keep this name too?`
              : `Restore "${appearance.name}" with its lore and previously active quests?`}
          </Text>
          <Button
            isDisabled={isBusy}
            isPrimary
            label={step === "duplicate" ? "Use this name" : "Restore realm"}
            onPress={() => {
              void proceed(transitionRecovery(flow, { _tag: step === "duplicate" ? "ConfirmName" : "Continue" }));
            }}
          />
        </>
      )}
      {error !== null && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <Button isDisabled={isBusy} label="Cancel" onPress={cancel} />
    </RealmDialog>
  );
}

const local = StyleSheet.create({
  column: { flex: 1, gap: 12, minWidth: 0 },
  columns: { flexDirection: "row", gap: 16 },
  option: { ...outline, alignItems: "center", borderRadius: radii.md, gap: 8, minHeight: 88, padding: 12 },
  selected: { backgroundColor: colors.controlActive, borderColor: colors.accent },
});
