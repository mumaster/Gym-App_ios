import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { badge } from "./ui";

/**
 * A card's tinted header band (`card-head`, DESIGN.md §7 Cards), for a card
 * whose content is more than a list: the Workout tab's plan and cardio
 * cards, History's cards. A list card uses `ListCard`, which draws the same
 * band. It sits at the top edge of a `p-4` card (`-mx-4 -mt-4`), so give the
 * card `overflow-hidden`; the band's own padding keeps the badge, title and
 * actions on the card's text line. A long title (an exercise's name) wraps
 * to two lines rather than being cut. Badge tonal while the card has something
 * to show, muted while it's empty, like `ListCard`'s; the subtitle is
 * `text-foreground/75`, since muted grey on the band measured 4.43:1 inside a
 * sheet.
 */
export function CardHead({
  icon: Icon,
  title,
  subtitle,
  filled = true,
  actions,
}: {
  icon: LucideIcon;
  title: ReactNode;
  subtitle?: ReactNode;
  filled?: boolean;
  actions?: ReactNode;
}) {
  return (
    <div className="card-head -mx-4 -mt-4 mb-3 flex min-h-[56px] items-center gap-3 px-4 py-2">
      <span aria-hidden className={`${filled ? badge.tonal : badge.off} size-9`}>
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[17px] font-bold leading-tight">{title}</span>
        {subtitle ? (
          <span className="tabular mt-0.5 block truncate text-[12.5px] text-foreground/75">
            {subtitle}
          </span>
        ) : null}
      </span>
      {actions ? <span className="flex shrink-0 items-center gap-2">{actions}</span> : null}
    </div>
  );
}
