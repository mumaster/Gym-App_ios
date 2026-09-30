import { useRef, type TouchEvent } from "react";

/** A touch that moves more than this (px) is a scroll or drag, not a tap. */
const TAP_SLOP = 10;

/**
 * Focus a text field on tap without iOS scrolling the page to reveal it.
 *
 * iOS Safari pans or scrolls the page to keep a tapped field above the
 * keyboard, even one that's already in view, and then pans back: the page
 * shoots up and bounces. Changing the page on touch-down to get ahead of
 * that doesn't work either, because iOS then treats the tap as a hover and
 * doesn't focus the field, so a second tap was needed.
 *
 * Instead, the tap is handled on touch-end: the default is prevented (so
 * iOS doesn't focus and scroll by itself) and the field is focused here,
 * still inside the tap so the keyboard opens. For that one instant it is
 * moved far up, so Safari finds nothing to scroll into view; the transform
 * is removed before the next frame paints. This is React Aria's
 * usePreventScroll technique. `onTap` runs first, so the layout can start
 * changing in the same tap. A field that already has focus is left alone,
 * so taps inside it still move the caret.
 */
export function useTapFocus(onTap?: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (e: TouchEvent<HTMLInputElement>) => {
      const touch = e.touches[0];
      start.current =
        touch && e.touches.length === 1 ? { x: touch.clientX, y: touch.clientY } : null;
    },
    onTouchEnd: (e: TouchEvent<HTMLInputElement>) => {
      const input = e.currentTarget;
      const touch = e.changedTouches[0];
      const from = start.current;
      start.current = null;
      if (!from || !touch || document.activeElement === input) return;
      if (Math.hypot(touch.clientX - from.x, touch.clientY - from.y) > TAP_SLOP) return;
      e.preventDefault();
      onTap?.();
      const transform = input.style.transform;
      input.style.transform = "translateY(-2000px)";
      input.focus({ preventScroll: true });
      requestAnimationFrame(() => {
        input.style.transform = transform;
      });
    },
  };
}
