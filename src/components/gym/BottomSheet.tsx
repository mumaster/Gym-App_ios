import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "../../lib/gym/i18n";
import { useVisualViewport } from "../../lib/gym/useVisualViewport";

/** Pull-down-to-close, like an iOS sheet: released past this many px, or
 *  flicked down faster than DISMISS_VELOCITY (px/ms), the sheet closes;
 *  otherwise it springs back. UI feel values, not measured ones. */
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 0.5;
/** Movement before a touch counts as a drag or a scroll (px). */
const DRAG_SLOP = 8;
const LEAVE_MS = 220;
/** How long the sheet takes to glide to a new height (going full height for
 *  a search, or content growing): iOS's own sheet curve, a UI feel value. */
const RESIZE_MS = 320;
const SHEET_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const VELOCITY_WINDOW_MS = 100;

/** Whether the touch started inside something that's scrolled away from
 *  its top (the sheet itself or a list in it): then a downward pull
 *  scrolls that back up rather than closing the sheet. */
function scrolledAbove(target: Element, sheet: HTMLElement): boolean {
  for (let el: Element | null = target; el; el = el.parentElement) {
    if (el instanceof HTMLElement && el.scrollTop > 0) {
      const overflowY = getComputedStyle(el).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") return true;
    }
    if (el === sheet) break;
  }
  return false;
}

/** Keyboard taller than this (CSS px) counts as open: the visual viewport
 *  also shrinks a little for Safari's own toolbars, which isn't a keyboard. */
const KEYBOARD_MIN_PX = 120;

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  toolbar,
  fullHeight = false,
  scrollKey,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Pinned under the title, outside the scrolling content (a search field). */
  toolbar?: ReactNode;
  /** Fill the screen above the keyboard at a fixed height, so the content
   *  changing (search results as you type) never moves the sheet. */
  fullHeight?: boolean;
  /** Scroll the content back to the top whenever this changes. */
  scrollKey?: unknown;
}) {
  const t = useTranslation();
  const titleId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const viewport = useVisualViewport(open && fullHeight);
  /** Above the keyboard there's no home indicator to clear. */
  const keyboardOpen =
    viewport != null &&
    typeof window !== "undefined" &&
    window.innerHeight - viewport.height > KEYBOARD_MIN_PX;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [scrollKey]);

  // Glide instead of jumping when the sheet's top edge moves: going full
  // height for a search, or content growing or shrinking. After each render
  // the new top is compared with the last one and the sheet animates from
  // the old spot (a FLIP). The top is measured against the visible area, so
  // following iOS's keyboard pan (the overlay's own top) never animates;
  // that has to stay instant. offsetTop ignores transforms, so a drag or a
  // running animation doesn't count as a move.
  const layoutTopRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = containerRef.current;
    const overlay = el?.parentElement;
    if (!open || !el || !overlay) {
      layoutTopRef.current = null;
      return;
    }
    const top = overlay.getBoundingClientRect().top - (viewport?.offsetTop ?? 0) + el.offsetTop;
    const prev = layoutTopRef.current;
    layoutTopRef.current = top;
    if (prev == null || Math.abs(prev - top) < 1 || typeof el.animate !== "function") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    el.animate([{ transform: `translateY(${prev - top}px)` }, { transform: "translateY(0)" }], {
      duration: RESIZE_MS,
      easing: SHEET_EASE,
    });
  });
  const triggerRef = useRef<Element | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  /** How far the sheet is pulled down, in px. */
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Move focus into the sheet on open and back to whatever opened it on
  // close, so keyboard/screen-reader users aren't dropped back at the top
  // of the page — the standard dialog-focus contract this lacked before.
  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement;
    containerRef.current?.focus();
    return () => {
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
    };
  }, [open]);

  // Drag down to close. Touch events rather than pointer events: the sheet
  // scrolls, and a pointer drag gets cancelled the moment the browser starts
  // scrolling, whereas a non-passive touchmove can claim the gesture. A pull
  // starts anywhere in the sheet while it's scrolled to the top (on the
  // handle and title too), is locked to vertical after DRAG_SLOP so sideways
  // swipes and chip rows keep working, and skips text fields. Closing goes
  // through onClose, so it saves exactly like Done or the backdrop does.
  useEffect(() => {
    if (!open) return;
    const sheet = containerRef.current;
    if (!sheet) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let mode: "idle" | "pending" | "drag" | "pass" = "idle";
    let startX = 0;
    let startY = 0;
    let lastY = 0;
    /** Recent positions, for the release speed (px/ms over the last
     *  VELOCITY_WINDOW_MS; one step alone is too noisy). */
    let samples: { y: number; t: number }[] = [];
    let leaveTimer: number | undefined;

    const startAt = (target: Element, x: number, y: number, time: number) => {
      if (target.closest("input, textarea, select, [data-no-sheet-drag]")) {
        mode = "pass";
        return;
      }
      startX = x;
      startY = y;
      lastY = y;
      samples = [{ y, t: time }];
      mode = scrolledAbove(target, sheet) ? "pass" : "pending";
    };
    /** True while this move belongs to the drag (so the page shouldn't scroll). */
    const moveTo = (x: number, y: number, time: number) => {
      if (mode === "idle" || mode === "pass") return false;
      const dx = x - startX;
      const dy = y - startY;
      if (mode === "pending") {
        if (Math.abs(dx) < DRAG_SLOP && Math.abs(dy) < DRAG_SLOP) return false;
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) {
          mode = "pass";
          return false;
        }
        mode = "drag";
        setDragging(true);
      }
      lastY = y;
      samples.push({ y, t: time });
      while (samples.length > 2 && time - samples[0]!.t > VELOCITY_WINDOW_MS) samples.shift();
      setDragY(Math.max(0, dy));
      return true;
    };
    const end = () => {
      const wasDrag = mode === "drag";
      mode = "idle";
      if (!wasDrag) return;
      setDragging(false);
      const dy = lastY - startY;
      const first = samples[0];
      const last = samples[samples.length - 1];
      const velocity =
        first && last && last.t > first.t ? (last.y - first.y) / (last.t - first.t) : 0;
      if (dy > DISMISS_DISTANCE || (velocity > DISMISS_VELOCITY && dy > DRAG_SLOP * 3)) {
        setDragY(sheet.offsetHeight + 40);
        leaveTimer = window.setTimeout(
          () => {
            onCloseRef.current();
            setDragY(0);
          },
          reduceMotion ? 0 : LEAVE_MS,
        );
      } else {
        setDragY(0);
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (e.touches.length !== 1 || !touch) {
        mode = "pass";
        return;
      }
      startAt(e.target as Element, touch.clientX, touch.clientY, e.timeStamp);
    };
    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch && moveTo(touch.clientX, touch.clientY, e.timeStamp)) e.preventDefault();
    };
    // A mouse can pull by the handle and title row only (there's no
    // scroll gesture to share with on a desktop).
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Element;
      if (e.button !== 0 || !target.closest("[data-sheet-grip]") || target.closest("button"))
        return;
      startAt(target, e.clientX, e.clientY, e.timeStamp);
      const onMouseMove = (m: MouseEvent) => {
        if (moveTo(m.clientX, m.clientY, m.timeStamp)) m.preventDefault();
      };
      const onMouseUp = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        end();
      };
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    };

    sheet.addEventListener("touchstart", onTouchStart, { passive: true });
    sheet.addEventListener("touchmove", onTouchMove, { passive: false });
    sheet.addEventListener("touchend", end);
    sheet.addEventListener("touchcancel", end);
    sheet.addEventListener("mousedown", onMouseDown);
    return () => {
      sheet.removeEventListener("touchstart", onTouchStart);
      sheet.removeEventListener("touchmove", onTouchMove);
      sheet.removeEventListener("touchend", end);
      sheet.removeEventListener("touchcancel", end);
      sheet.removeEventListener("mousedown", onMouseDown);
      window.clearTimeout(leaveTimer);
      setDragY(0);
      setDragging(false);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={`fixed z-50 flex flex-col justify-end ${viewport ? "inset-x-0" : "inset-0"}`}
      style={viewport ? { top: viewport.offsetTop, height: viewport.height } : undefined}
    >
      <button
        aria-label={t.bottomSheet.close}
        onClick={onClose}
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        style={{
          opacity: Math.max(0, 1 - dragY / 500),
          transition: dragging ? "none" : `opacity ${LEAVE_MS}ms ease-out`,
        }}
      />
      {/* The title (and toolbar) stay put; only the content below scrolls. */}
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`glass-strong relative flex flex-col overflow-hidden rounded-t-3xl shadow-[var(--shadow-float)] duration-300 animate-in slide-in-from-bottom outline-none motion-reduce:!transition-none ${
          keyboardOpen ? "" : "safe-bottom"
        } ${fullHeight ? "" : "max-h-[82vh]"}`}
        style={{
          height: fullHeight ? "calc(100% - env(safe-area-inset-top) - 0.5rem)" : undefined,
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragging ? "none" : `transform ${LEAVE_MS}ms ${SHEET_EASE}`,
        }}
      >
        <div data-sheet-grip className="shrink-0 cursor-grab px-5 pt-3 active:cursor-grabbing">
          <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border" />
          <div className="mb-3 flex items-center justify-between">
            <h2 id={titleId} className="text-xl font-bold tracking-tight">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground"
            >
              {t.bottomSheet.done}
            </button>
          </div>
        </div>
        {toolbar ? <div className="shrink-0 px-5 pb-3">{toolbar}</div> : null}
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
