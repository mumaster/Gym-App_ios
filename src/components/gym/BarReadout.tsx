import { useState } from "react";
import { useTranslation } from "../../lib/gym/i18n";

/** Which bar of a chart is tapped (tap it again to clear). */
export function usePickedBar() {
  const [picked, setPicked] = useState<number | null>(null);
  return {
    picked,
    toggle: (i: number) => setPicked((p) => (p === i ? null : i)),
    clear: () => setPicked(null),
  };
}

/** The line above a bar chart that gives the tapped bar's label and value; a
 *  muted hint until one is tapped. Keeps its height so the chart never jumps. */
export function BarReadout({ text }: { text: string | null }) {
  const t = useTranslation();
  return (
    <p
      aria-live="polite"
      className={`tabular mb-2 min-h-5 text-[13px] leading-5 ${
        text ? "font-semibold text-foreground" : "text-muted-foreground"
      }`}
    >
      {text ?? t.common.tapBarHint}
    </p>
  );
}

/** Classes for a bar column's tap target: a faint wash behind the picked one. */
export const barColumn = (on: boolean) =>
  `rounded-xl transition-colors ${on ? "bg-foreground/10" : ""} focus-visible:outline-2 focus-visible:outline-primary`;
