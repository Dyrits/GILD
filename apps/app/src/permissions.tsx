import {
  type ApprovalLevel,
  ApprovalLevel as ApprovalLevels,
  type MissionId,
  type StandingPermission,
} from "@openmission/contracts";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { ServiceClient } from "./client";
import { Choice } from "./controls";
import { QuestionLine } from "./questions";
import { styles } from "./styles";
import { useServiceQuery } from "./useServiceQuery";

/** The names of the approval levels (action-approval, Approval level). */
export const levelLabels = {
  CommandsAndEdits: "Also commands and edits",
  RiskyOnly: "Sensitive actions only",
} as const satisfies Record<ApprovalLevel, string>;

/** Whether a standing permission was widened to every mission and workspace. */
const isEverywhere = (permission: StandingPermission) =>
  permission.workspaceId === null && permission.missionId === null;

/** Where a standing permission applies: its workspace, its mission, or everywhere. */
const scopeOf = (permission: StandingPermission) =>
  isEverywhere(permission)
    ? "Everywhere"
    : permission.workspaceId !== null
      ? `In workspace ${permission.workspaceName}`
      : `In ${permission.missionTitle}`;

/** The approval level, standing permissions, and the history of answers. */
export function PermissionsScreen({ client, onBack }: { client: ServiceClient; onBack: () => void }) {
  const [missionFilter, setMissionFilter] = useState<MissionId | null>(null);
  const { data: view, error } = useServiceQuery(
    client,
    { _tag: "ReadPermissions", missionId: missionFilter },
    `permissions-${missionFilter ?? "all"}`,
  );
  const { data: settings } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  const { data: list } = useServiceQuery(
    client,
    { _tag: "ListMissions", isArchived: false, search: null, state: null, workspaceId: null },
    "missions:all",
  );
  const missions = list?.missions ?? null;
  const [actionError, setActionError] = useState<string | null>(null);
  const act = (work: Promise<unknown>) =>
    work.then(
      () => setActionError(null),
      (reason: Error) => setActionError(reason.message),
    );
  const missionTitle = (id: MissionId | null) =>
    id === null ? "All missions" : (missions?.find((mission) => mission.id === id)?.title ?? "Mission");
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.link}>← Settings</Text>
        </Pressable>
        <Text style={styles.heading}>Permissions</Text>
      </View>
      {error !== null && <Text style={styles.error}>{error}</Text>}
      {actionError !== null && <Text style={styles.error}>{actionError}</Text>}
      {view && settings && (
        <>
          <View style={styles.section}>
            <Text style={styles.label}>Approval level</Text>
            <Choice
              label={(level) => levelLabels[level]}
              onChange={(approvalLevel) =>
                act(client.request({ _tag: "UpdateSettings", settings: { ...settings, approvalLevel } }))
              }
              options={ApprovalLevels.literals}
              value={view.level}
            />
            {view.sandboxProblem !== null && view.level === "RiskyOnly" && (
              <Text style={styles.muted}>
                {view.sandboxProblem} Commands run without it; only sensitive actions ask.
              </Text>
            )}
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>Standing permissions</Text>
            {view.permissions.length === 0 && <Text style={styles.muted}>None yet. Always allow adds one.</Text>}
            {view.permissions.map((permission) => (
              <View key={permission.id} style={styles.row}>
                <View style={styles.flex}>
                  <Text style={styles.body}>{permission.sentence}</Text>
                  <Text style={styles.muted}>
                    {permission.pattern} · {scopeOf(permission)}
                  </Text>
                </View>
                {!isEverywhere(permission) && (
                  <Pressable
                    onPress={() => act(client.request({ _tag: "WidenPermission", permissionId: permission.id }))}
                  >
                    <Text style={styles.link}>Allow everywhere</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => act(client.request({ _tag: "RemovePermission", permissionId: permission.id }))}
                >
                  <Text style={styles.error}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>History</Text>
            <Choice
              label={missionTitle}
              onChange={setMissionFilter}
              options={[null, ...(missions ?? []).map((mission) => mission.id)]}
              value={missionFilter}
            />
            {view.history.length === 0 && <Text style={styles.muted}>No answers yet.</Text>}
            {view.history.map((question) => (
              <View key={question.id}>
                <Text numberOfLines={1} style={styles.muted}>
                  {question.missionTitle}
                </Text>
                <Text style={styles.body}>{question.summary}</Text>
                <QuestionLine question={question} />
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}
