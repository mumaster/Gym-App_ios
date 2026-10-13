import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Mounts its children the first time it scrolls into view. For charts that
 * animate in JavaScript (Recharts) and so can't be paused like the CSS bars
 * (lib/gym/inViewAnimation.ts): mounted late, they draw their grow-in then.
 * `className` should give the box its size so nothing jumps when it fills.
 */
export function InView({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const el = ref.current;
    if (seen || !el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return (
    <div ref={ref} className={className} style={style}>
      {seen ? children : null}
    </div>
  );
}
