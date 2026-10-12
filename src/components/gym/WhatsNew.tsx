import { BottomSheet } from "./BottomSheet";
import { entriesSince, formatVersion, CURRENT_VERSION } from "../../lib/gym/changelog";
import { useTranslation } from "../../lib/gym/i18n";
import { haptic, useGym } from "../../lib/gym/store";
import { button } from "./ui";

/** The changelog in a sheet: everything newer than `since`, newest first
 *  (so someone several versions behind gets all missed texts together). */
export function WhatsNewSheet({
  open,
  onClose,
  since,
}: {
  open: boolean;
  onClose: () => void;
  since: number;
}) {
  const t = useTranslation();
  const { language } = useGym();
  return (
    <BottomSheet open={open} onClose={onClose} title={t.whatsNew.title}>
      <div className="space-y-4 pb-2">
        <ul className="space-y-3">
          {entriesSince(since).map((entry) => (
            <li key={entry.version} className="rounded-2xl bg-foreground/5 p-3.5">
              <p className="text-[12px] font-semibold tabular-nums text-primary">
                {formatVersion(entry.version)}
              </p>
              <p className="mt-1 text-[14.5px] leading-snug">{entry.text[language]}</p>
            </li>
          ))}
        </ul>
        <button
          onClick={() => {
            haptic(10);
            onClose();
          }}
          className={`${button.primary} w-full`}
        >
          {t.whatsNew.done}
        </button>
      </div>
    </BottomSheet>
  );
}

/** Opens by itself after an update: when the saved last-seen version is older
 *  than this build. New installs start on the current version (store.tsx's
 *  migrate), so they see nothing; people mid-tour wait until it's finished. */
export function WhatsNew() {
  const { hydrated, welcomeSeen, setupSeen, lastSeenVersion, update } = useGym();
  const open = hydrated && welcomeSeen && setupSeen && lastSeenVersion < CURRENT_VERSION;
  return (
    <WhatsNewSheet
      open={open}
      since={lastSeenVersion}
      onClose={() => update({ lastSeenVersion: CURRENT_VERSION })}
    />
  );
}
