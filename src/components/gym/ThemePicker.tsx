import { useRef } from "react";
import { Check } from "lucide-react";
import { haptic, useGym } from "../../lib/gym/store";
import type { AccentId } from "../../lib/gym/types";

const ACCENTS: { id: AccentId; label: string; swatch: string }[] = [
  { id: "green", label: "Electric Green", swatch: "oklch(0.88 0.24 145)" },
  { id: "blue", label: "Ocean Blue", swatch: "oklch(0.72 0.17 245)" },
  { id: "orange", label: "Sunset Orange", swatch: "oklch(0.78 0.18 55)" },
  { id: "purple", label: "Ultraviolet", swatch: "oklch(0.68 0.2 300)" },
  { id: "pink", label: "Hot Pink", swatch: "oklch(0.72 0.22 350)" },
  { id: "yellow", label: "Volt Yellow", swatch: "oklch(0.88 0.18 95)" },
];

export function ThemePicker() {
  const { accent, customAccent, update } = useGym();
  const wheelRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      {ACCENTS.map((a) => (
        <button
          key={a.id}
          onClick={() => {
            haptic(15);
            update({ accent: a.id });
          }}
          aria-label={a.label}
          className={`flex size-12 items-center justify-center rounded-full border-2 transition-transform active:scale-95 ${
            accent === a.id ? "border-foreground" : "border-transparent"
          }`}
          style={{ backgroundColor: a.swatch }}
        >
          {accent === a.id ? (
            <Check className="size-5 text-background" strokeWidth={3} />
          ) : null}
        </button>
      ))}

      {/* Custom color wheel */}
      <button
        onClick={() => {
          haptic(15);
          wheelRef.current?.click();
        }}
        aria-label="Custom color"
        className={`relative flex size-12 items-center justify-center overflow-hidden rounded-full border-2 transition-transform active:scale-95 ${
          accent === "custom" ? "border-foreground" : "border-border"
        }`}
        style={{
          background:
            accent === "custom"
              ? customAccent
              : "conic-gradient(from 0deg, #f87171, #fbbf24, #a3e635, #34d399, #22d3ee, #818cf8, #e879f9, #f87171)",
        }}
      >
        {accent === "custom" ? (
          <Check className="size-5 text-background" strokeWidth={3} />
        ) : null}
        <input
          ref={wheelRef}
          type="color"
          value={customAccent}
          onChange={(e) => update({ accent: "custom", customAccent: e.target.value })}
          className="pointer-events-none absolute inset-0 size-full opacity-0"
          aria-hidden
          tabIndex={-1}
        />
      </button>
    </div>
  );
}
