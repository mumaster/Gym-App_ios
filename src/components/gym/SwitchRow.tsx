import type { ReactNode } from "react";

/** One row of a grouped settings card: a label and short description with an
 *  iOS switch. The knob is always white, like the platform's. `disabled`
 *  dims the row and ignores taps (a switch that only matters while another
 *  one is on). `desc` is optional; `className` replaces the row's padding
 *  when it sits in a card that has its own (the session's settings card). */
export function SwitchRow({
  label,
  desc,
  ariaLabel,
  on,
  onToggle,
  disabled = false,
  className = "px-4 py-3",
}: {
  label: ReactNode;
  desc?: string;
  ariaLabel: string;
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 ${className} ${disabled ? "opacity-50" : ""}`}
    >
      <div className="min-w-0">
        <p className="text-[15px] font-semibold">{label}</p>
        {desc ? <p className="text-[12px] leading-snug text-muted-foreground">{desc}</p> : null}
      </div>
      <button
        role="switch"
        aria-checked={on}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={onToggle}
        className={`tap-target h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${
          on ? "bg-primary" : "bg-secondary"
        }`}
      >
        <span
          className={`absolute top-[2px] size-[27px] rounded-full bg-white shadow-[0_1px_3px_oklch(0_0_0/35%)] transition-all ${
            on ? "left-[22px]" : "left-[2px]"
          }`}
        />
      </button>
    </div>
  );
}
