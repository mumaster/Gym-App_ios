import { useEffect, useRef } from "react";

const ITEM = 44;

/** iOS-style scroll-snap wheel picker. */
export function WheelPicker({
  values,
  value,
  onChange,
  suffix,
}: {
  values: number[];
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const idx = values.indexOf(value);
    if (ref.current && idx >= 0) ref.current.scrollTop = idx * ITEM;
  }, [values, value]);

  return (
    <div className="relative h-[132px] w-full overflow-hidden rounded-2xl bg-muted">
      <div className="pointer-events-none absolute inset-x-3 top-1/2 h-11 -translate-y-1/2 rounded-xl border border-primary/40 bg-primary/10" />
      <div
        ref={ref}
        onScroll={(e) => {
          const top = e.currentTarget.scrollTop;
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            const idx = Math.max(0, Math.min(values.length - 1, Math.round(top / ITEM)));
            const v = values[idx]; if (v !== undefined && v !== value) onChange(v);
          }, 90);
        }}
        className="no-scrollbar h-full snap-y snap-mandatory overflow-y-scroll py-[44px]"
      >
        {values.map((v) => (
          <div
            key={v}
            className={`flex h-11 snap-center items-center justify-center text-xl font-semibold tabular ${
              v === value ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {v}
            {suffix ? <span className="ml-1 text-sm">{suffix}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
