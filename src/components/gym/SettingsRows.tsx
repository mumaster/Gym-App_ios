import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { text } from "./ui";

/** A tappable row inside a settings card: title, one or two lines of
 *  description and a chevron (or `trailing`). A link when `to` is given.
 *  Shared by Settings and the setup tour so both draw the same rows. */
export function LinkRow({
  to,
  onClick,
  title,
  desc,
  trailing,
  disabled,
}: {
  to?: "/equipment";
  onClick?: () => void;
  title: string;
  desc: string;
  trailing?: ReactNode;
  disabled?: boolean;
}) {
  const cls =
    "flex min-h-[56px] w-full items-center justify-between gap-3 border-t border-border px-4 py-3 text-left active:bg-foreground/5 disabled:opacity-60";
  const inner = (
    <>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold">{title}</span>
        <span className="line-clamp-2 block text-[12.5px] leading-snug text-muted-foreground">
          {desc}
        </span>
      </span>
      {trailing ?? <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />}
    </>
  );
  if (to) {
    return (
      <Link to={to} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button onClick={onClick} disabled={disabled} className={cls}>
      {inner}
    </button>
  );
}

/** A small-caps label over a control, divided from the row above. */
export function PickerSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-t border-border">
      <p className={`${text.eyebrow} px-4 pt-3`}>{label}</p>
      {children}
    </div>
  );
}
