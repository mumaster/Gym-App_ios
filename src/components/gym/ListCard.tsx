import { useId, type ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { badge } from "./ui";

/** A list as a card, built like a meal's card on the Food tab (Add food's
 *  lists, the Exercises groups): a tinted header band (`card-head`) with a
 *  badge, the title and a count, and the rows under it divided by hairlines
 *  (`border-t border-border`, the caller's). The badge is tonal
 *  (`badge.tonal`) once the list has something in it and muted while it's
 *  empty, not solid like a meal's: these cards sit under a screen's own main
 *  action (Add food's Scan), and a row of solid circles competed with it
 *  (asked for). With `fold`, the band is a button that folds the rows away
 *  (Exercises' muscle groups, asked for: the full list was too much), with a
 *  chevron that points down while open. */
export function ListCard({
  icon: Icon,
  title,
  subtitle,
  filled,
  actions,
  fold,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  filled: boolean;
  actions?: ReactNode;
  fold?: { open: boolean; onToggle: () => void } | undefined;
  children: ReactNode;
}) {
  const bodyId = useId();
  const heading = (
    <>
      <span aria-hidden className={`${filled ? badge.tonal : badge.off} size-9`}>
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[17px] font-bold leading-tight">{title}</span>
        {/* Not text-muted-foreground: on a card inside a sheet the band
            sits on a lighter surface, and muted grey measured 4.43:1. */}
        <span className="tabular mt-0.5 block truncate text-[12.5px] text-foreground/75">
          {subtitle}
        </span>
      </span>
    </>
  );
  return (
    <section className="glass overflow-hidden rounded-2xl">
      {fold ? (
        <button
          onClick={fold.onToggle}
          aria-expanded={fold.open}
          aria-controls={bodyId}
          className="card-head flex min-h-[56px] w-full items-center gap-3 px-4 py-2 text-left active:brightness-95"
        >
          {heading}
          <ChevronDown
            aria-hidden
            className={`size-5 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none ${
              fold.open ? "" : "-rotate-90"
            }`}
          />
        </button>
      ) : (
        <div className="card-head flex min-h-[56px] items-center gap-3 px-4 py-2">
          {heading}
          {actions ? <span className="flex shrink-0 items-center gap-2">{actions}</span> : null}
        </div>
      )}
      {fold && !fold.open ? null : <div id={bodyId}>{children}</div>}
    </section>
  );
}
