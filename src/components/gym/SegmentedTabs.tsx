/**
 * iOS-style segmented control for a screen's sub-tabs (History, Workout),
 * meant for `Screen`'s sticky `toolbar`, so switching never needs a scroll
 * back up. One component so every screen's tabs look and behave the same.
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
  return (
    <div
      role="tablist"
      className="grid gap-1 rounded-full bg-secondary p-1"
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map((id) => (
        <button
          key={id}
          role="tab"
          aria-selected={id === value}
          onClick={() => onChange(id)}
          className={`tap-target min-h-[34px] min-w-0 rounded-full px-2 text-[13.5px] font-semibold transition-colors ${
            id === value
              ? "bg-background text-foreground shadow-[0_1px_3px_oklch(0_0_0/25%)]"
              : "text-muted-foreground"
          }`}
        >
          <span className="block truncate">{labels[id]}</span>
        </button>
      ))}
    </div>
  );
}
