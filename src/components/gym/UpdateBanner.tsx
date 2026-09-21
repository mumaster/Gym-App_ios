import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { onUpdateAvailable } from "../../pwa";
import { haptic } from "../../lib/gym/store";

/** A dismissible "new version available" pill, shown once a service worker
 *  update has taken over in the background (see pwa.ts's onUpdateAvailable).
 *  Deliberately a prompt, not an automatic reload — the new shell is already
 *  active and will apply on the next navigation regardless, but yanking the
 *  screen out from under someone mid-workout or mid-typing would be worse
 *  than a few extra minutes on the old one. Dismissing just hides the pill
 *  for this session; it doesn't stop the update from applying next launch. */
export function UpdateBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => onUpdateAvailable(() => setVisible(true)), []);

  if (!visible) return null;

  return (
    <div className="safe-top fixed inset-x-0 top-0 z-[90] flex justify-center px-4">
      <div className="glass-strong flex items-center gap-3 rounded-full py-2 pl-4 pr-2 shadow-[var(--shadow-float)]">
        <p className="text-[13px] font-medium text-foreground">A new version is ready</p>
        <button
          onClick={() => {
            haptic(15);
            location.reload();
          }}
          className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-foreground active:scale-95"
        >
          <RefreshCw className="size-3.5" /> Reload
        </button>
      </div>
    </div>
  );
}
