import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { badge } from "./ui";

/** A list as a card, built like a meal's card on the Food tab (Add food's
 *  lists, the Exercises groups): a tinted header band (`card-head`) with a
 *  badge, the title and a count, and the rows under it divided by hairlines
 *  (`border-t border-border`, the caller's). The badge is tonal
 *  (`badge.tonal`) once the list has something in it and muted while it's
 *  empty, not solid like a meal's: these cards sit under a screen's own main
 *  action (Add food's Scan), and a row of solid circles competed with it
 *  (asked for). */
export function ListCard({
  icon: Icon,
  title,
  subtitle,
  filled,
  actions,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  filled: boolean;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="glass overflow-hidden rounded-2xl">
      <div className="card-head flex min-h-[56px] items-center gap-3 px-4 py-2">
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
        {actions ? <span className="flex shrink-0 items-center gap-2">{actions}</span> : null}
      </div>
      {children}
    </section>
  );
}
