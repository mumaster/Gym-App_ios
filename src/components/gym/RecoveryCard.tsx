import { useMemo } from "react";
import { BatteryCharging } from "lucide-react";
import { AnatomyMap } from "./AnatomyMap";
import { CardHead } from "./CardHead";
import { Card } from "./Screen";
import { useTranslation } from "../../lib/gym/i18n";
import { recoveryLevel, regionRecovery } from "../../lib/gym/recovery";
import { useGym } from "../../lib/gym/store";

/** History → Activity: the muscle map showing only recovery, read-only.
 *  Same numbers as the map on the Workout tab (recovery.ts). It shows now,
 *  not the week picked below it, so it sits above the week picker. */
export function RecoveryCard() {
  const t = useTranslation();
  const { workouts } = useGym();
  const recovery = useMemo(() => regionRecovery(workouts), [workouts]);
  const count = Object.values(recovery).filter((r) => recoveryLevel(r)).length;
  return (
    <Card className="overflow-hidden p-4">
      <CardHead
        icon={BatteryCharging}
        title={t.recovery.title}
        subtitle={t.recovery.countLine(count)}
        filled={count > 0}
      />
      <AnatomyMap selected={[]} recovery={recovery} onToggle={() => {}} readOnly />
    </Card>
  );
}
