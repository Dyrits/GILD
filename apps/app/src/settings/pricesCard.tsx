import type { Settings } from "@iskios/contracts";
import { useState } from "react";
import { Text } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { priceStatusTextOf } from "../foundation/labels";
import { styles } from "../foundation/styles";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { Button } from "../ui/button";
import { SettingsCard, ToggleRow } from "./settingsParts";

/**
 * The model price table behind estimated costs: whether Iskios reads the public table, where the prices in use came
 * from, and a button to read it now (budget-control, The price table).
 */
export function PricesCard({
  client,
  onSave,
  settings,
}: {
  client: ServiceClient;
  onSave: (change: Partial<Settings>) => Promise<void> | void;
  settings: Settings;
}) {
  const { data: status } = useServiceQuery(client, { _tag: "ReadPriceStatus" }, `prices:${settings.shouldFetchPrices}`);
  const [error, setError] = useState<string | null>(null);
  const refresh = () =>
    client.request({ _tag: "RefreshPrices" }).then(
      () => setError(null),
      (reason: Error) => setError(reason.message),
    );
  return (
    <SettingsCard icon="gem" title="Model prices · what a turn is estimated to cost">
      <ToggleRow
        label="Fetch prices from models.dev"
        onChange={(shouldFetchPrices) => onSave({ shouldFetchPrices })}
        value={settings.shouldFetchPrices}
      />
      {status !== null && <Text style={styles.muted}>{priceStatusTextOf(status)}</Text>}
      {error !== null && <Text style={styles.error}>{error}</Text>}
      {settings.shouldFetchPrices && <Button isPrimary={false} label="Refresh now" onPress={refresh} />}
    </SettingsCard>
  );
}
