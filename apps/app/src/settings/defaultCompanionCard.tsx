import type { BackupCompanion, HarnessList, Settings } from "@iskios/contracts";
import type { ServiceClient } from "../foundation/client";
import { effortLabel, harnessLabels, modelLabelOf } from "../foundation/formatting";
import { Row } from "../quests/questPanel";
import { CompanionTable } from "./companionTable";
import { SettingsCard } from "./settingsParts";

/** What the backups are worth in a row's value. */
const backupsValueOf = (backups: ReadonlyArray<BackupCompanion>) =>
  backups.length === 0 ? "None" : backups.length === 1 ? "1 backup" : `${backups.length} backups`;

/**
 * The Companion every new quest starts with, read as the quest panel reads a thread's (harness, model, and its
 * backups), with a column at its right whose chevron opens the Companions tab on it.
 */
export function DefaultCompanionCard({
  client,
  harnesses,
  onSave,
  settings,
}: {
  client: ServiceClient;
  harnesses: HarnessList | null;
  onSave: (change: Partial<Settings>) => void;
  settings: Settings;
}) {
  const models = harnesses?.harnesses.find((candidate) => candidate.name === settings.defaultHarness)?.models;
  return (
    <SettingsCard icon="sliders" summary="New quests always start with this Companion and its backups" title="Default">
      <CompanionTable
        client={client}
        focus="Default"
        harnesses={harnesses}
        onChange={(runner) =>
          onSave({ defaultEffort: runner.effort, defaultHarness: runner.harness, defaultModel: runner.model })
        }
        rank={0}
        rows={
          <>
            <Row
              icon="chip"
              label="Harness"
              mark={settings.defaultHarness}
              value={harnessLabels[settings.defaultHarness]}
            />
            <Row
              icon="model"
              label="Model"
              value={`${modelLabelOf(settings.defaultModel, models)} · ${effortLabel(settings.defaultEffort)}`}
            />
            <Row icon="shield" label="Backups" value={backupsValueOf(settings.backups)} />
          </>
        }
        runner={{
          accountId: null,
          effort: settings.defaultEffort,
          harness: settings.defaultHarness,
          model: settings.defaultModel,
        }}
      />
    </SettingsCard>
  );
}
