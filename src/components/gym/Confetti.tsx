import { useMemo } from "react";

const COLORS = [
  "var(--primary)",
  "oklch(0.85 0.18 95)",
  "oklch(0.72 0.22 350)",
  "oklch(0.75 0.17 245)",
  "oklch(0.95 0 0)",
];

/** Lightweight CSS confetti burst. `big` doubles the volume and size. */
export function Confetti({ big = false }: { big?: boolean }) {
  const count = big ? 160 : 70;
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * (big ? 1.2 : 0.6),
        duration: (big ? 2.4 : 1.9) + Math.random() * 1.6,
        size: (big ? 10 : 6) + Math.random() * (big ? 16 : 8),
        rotate: Math.random() * 360,
        color: COLORS[i % COLORS.length]!,
      })),
    [count, big],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size * 0.55}px`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ["--confetti-rotate" as string]: `${p.rotate}deg`,
          }}
        />
      ))}
    </div>
  );
}
