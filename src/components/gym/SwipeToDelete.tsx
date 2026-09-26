import { useRef, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";

/** How far a row opens to show its delete button, in px. */
const OPEN_X = -84;

/**
 * A row that slides left to reveal a delete button, like iOS lists. Vertical
 * drags are left to the page (`touch-pan-y`), so scrolling still works; a
 * horizontal drag past half the button's width snaps it open. While open, a
 * tap on the row closes it instead of triggering the row's own action, and a
 * swipe never counts as a tap. The button grows with the drag rather than
 * sitting under the row, so a translucent row never shows red through it.
 *
 * Deleting is also available from the row's own edit screen, which is the
 * path for keyboard and screen-reader users — the revealed button is hidden
 * from them while closed.
 */
export function SwipeToDelete({
  children,
  onDelete,
  deleteLabel,
}: {
  children: ReactNode;
  onDelete: () => void;
  deleteLabel: string;
}) {
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; base: number; axis: "x" | "y" | null } | null>(null);
  const swiped = useRef(false);

  return (
    <div className="relative overflow-hidden">
      <div
        className={`touch-pan-y ${dragging ? "" : "transition-transform duration-200 ease-out"}`}
        style={{ transform: `translateX(${x}px)` }}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, base: x, axis: null };
          swiped.current = false;
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x;
          const dy = e.clientY - d.y;
          if (d.axis === null) {
            if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
              d.axis = "x";
              e.currentTarget.setPointerCapture(e.pointerId);
            } else if (Math.abs(dy) > 8) {
              d.axis = "y";
            }
          }
          if (d.axis !== "x") return;
          swiped.current = true;
          setDragging(true);
          setX(Math.max(OPEN_X * 1.4, Math.min(0, d.base + dx)));
        }}
        onPointerUp={() => {
          if (drag.current?.axis === "x") setX((cur) => (cur < OPEN_X / 2 ? OPEN_X : 0));
          drag.current = null;
          setDragging(false);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDragging(false);
          setX(0);
        }}
        onClickCapture={(e) => {
          if (swiped.current || x !== 0) {
            e.stopPropagation();
            e.preventDefault();
            if (!swiped.current) setX(0);
          }
          swiped.current = false;
        }}
      >
        {children}
      </div>
      <button
        onClick={() => {
          setX(0);
          onDelete();
        }}
        aria-label={deleteLabel}
        aria-hidden={x === 0}
        tabIndex={x === 0 ? -1 : 0}
        className="absolute inset-y-0 right-0 flex items-center justify-center overflow-hidden bg-destructive text-destructive-foreground"
        style={{
          width: Math.max(0, -x),
          transition: dragging ? "none" : "width 200ms ease-out",
        }}
      >
        <Trash2 className="size-5 shrink-0" />
      </button>
    </div>
  );
}
