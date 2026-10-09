import { useLayoutEffect, useRef, useState } from "react";

/**
 * iOS-style segmented control for a screen's sub-tabs (History, Workout),
 * meant for `Screen`'s sticky `toolbar`, so switching never needs a scroll
 * back up. One component so every screen's tabs look and behave the same.
 *
 * The picked segment's highlight is one element that slides to the new tab
 * with the bottom tab bar's spring (TabBar's `useSelectionPlatter`). It is
 * placed from the picked button's offsets, and only animates once it has been
 * placed, so it doesn't fly in on first paint.
 */
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  labels,
}: {
  tabs: readonly T[];
  value: T;
  onChange: (tab: T) => void;
  labels: Record<T, string>;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ x: 0, y: 0, w: 0, h: 0, placed: false, animate: false });
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => {
      const el = track.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!el) return;
      // offset* ignore transforms, so a button still pressed in doesn't skew it.
      setBox((d) => ({
        x: el.offsetLeft,
        y: el.offsetTop,
        w: el.offsetWidth,
        h: el.offsetHeight,
        placed: true,
        animate: d.placed,
      }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    return () => ro.disconnect();
  }, [value]);

  return (
    <div
      ref={trackRef}
      role="tablist"
      className="relative grid gap-1 rounded-full glass-chip p-1 [--tab-tint:color-mix(in_oklab,var(--primary)_11%,transparent)]"
      style={{
        gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
        // The card header band's tint over the card surface.
        backgroundImage: "linear-gradient(var(--tab-tint), var(--tab-tint))",
      }}
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute left-0 top-0 rounded-full bg-[var(--chart-surface)] shadow-[0_1px_3px_oklch(0_0_0/18%)] motion-reduce:transition-none ${
          box.placed ? "opacity-100" : "opacity-0"
        } ${
          box.animate
            ? "transition-transform duration-[380ms] ease-[cubic-bezier(0.34,1.4,0.64,1)]"
            : ""
        }`}
        style={{
          width: box.w,
          height: box.h,
          transform: `translate(${box.x}px, ${box.y}px)`,
        }}
      />
      {tabs.map((id) => (
        <button
          key={id}
          role="tab"
          aria-selected={id === value}
          onClick={() => onChange(id)}
          className={`tap-target relative min-h-[34px] min-w-0 rounded-full px-2 text-[13.5px] font-semibold transition-colors ${
            id === value ? "text-primary-text" : "text-muted-foreground"
          }`}
        >
          <span className="block truncate">{labels[id]}</span>
        </button>
      ))}
    </div>
  );
}
