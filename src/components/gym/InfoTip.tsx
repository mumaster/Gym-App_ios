import { useState, type ReactNode } from "react";
import { Info } from "lucide-react";

/** The small (i) behind a card's explanation: the text stays hidden until the
 *  user taps. Put `button` next to the card's title and `panel` right under
 *  that row. Shared so every explanation looks and behaves the same. */
export function useInfoTip(ariaLabel: string, text: ReactNode, large = false) {
  const [open, setOpen] = useState(false);
  return {
    button: (
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel}
        aria-expanded={open}
        className={`tap-target flex shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground active:scale-90 ${large ? "size-9" : "size-6"}`}
      >
        <Info className={large ? "size-[18px]" : "size-3.5"} aria-hidden />
      </button>
    ),
    panel: open ? (
      <div className="space-y-1.5 text-[12.5px] leading-snug text-muted-foreground">{text}</div>
    ) : null,
  };
}

/** A card heading with its (i): title on the left, the info panel below. */
export function InfoHeading({
  title,
  ariaLabel,
  children,
}: {
  title: string;
  ariaLabel: string;
  children: ReactNode;
}) {
  const info = useInfoTip(ariaLabel, children);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-[15px] font-semibold">{title}</p>
        {info.button}
      </div>
      {info.panel}
    </div>
  );
}
