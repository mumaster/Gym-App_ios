import { useEffect, useState } from "react";

export interface VisualViewportBox {
  /** Visible height in CSS px: shrinks by the keyboard's height while it's up. */
  height: number;
  /** How far iOS has panned the page to keep a focused field in view. */
  offsetTop: number;
}

/**
 * The part of the screen that's actually visible, tracked while `active`.
 * iOS Safari doesn't shrink `position: fixed` layouts when the keyboard
 * opens: the keyboard covers the bottom of the layout viewport instead, and
 * Safari pans the page to keep the focused field visible. Sizing an overlay
 * to `window.visualViewport` keeps it exactly above the keyboard, so nothing
 * underneath it has to move. Null when inactive or unsupported.
 */
export function useVisualViewport(active: boolean): VisualViewportBox | null {
  const [box, setBox] = useState<VisualViewportBox | null>(null);

  useEffect(() => {
    const vv = typeof window === "undefined" ? undefined : window.visualViewport;
    if (!active || !vv) {
      setBox(null);
      return;
    }
    let frame = 0;
    const read = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        setBox((cur) =>
          cur && cur.height === vv.height && cur.offsetTop === vv.offsetTop
            ? cur
            : { height: vv.height, offsetTop: vv.offsetTop },
        ),
      );
    };
    setBox({ height: vv.height, offsetTop: vv.offsetTop });
    vv.addEventListener("resize", read);
    vv.addEventListener("scroll", read);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", read);
      vv.removeEventListener("scroll", read);
    };
  }, [active]);

  return box;
}
