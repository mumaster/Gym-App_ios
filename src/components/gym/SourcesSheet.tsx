import { useTranslation } from "../../lib/gym/i18n";
import { SOURCES, type SourceGroup } from "../../lib/gym/sources";
import { BottomSheet } from "./BottomSheet";

const GROUPS: SourceGroup[] = ["training", "tracking", "nutrition"];

/** Settings → Sources: every published source behind the app's fixed
 *  numbers, in one place rather than on each screen (see sources.ts). */
export function SourcesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslation();
  return (
    <BottomSheet open={open} onClose={onClose} title={t.sources.title}>
      <p className="text-[13.5px] leading-snug text-muted-foreground">{t.sources.intro}</p>
      {GROUPS.map((group) => (
        <section key={group} className="mt-5">
          <h3 className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t.sources.groups[group]}
          </h3>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-muted/50">
            {SOURCES.filter((s) => s.group === group).map((s) => (
              <li key={s.id} className="px-3.5 py-2.5">
                <p className="text-[14px] font-semibold leading-snug">{t.sources.uses[s.id]}</p>
                {s.refs.map((ref) => (
                  <p key={ref} className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">
                    {ref}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="mt-4 text-[11.5px] leading-snug text-muted-foreground">{t.sources.note}</p>
    </BottomSheet>
  );
}
