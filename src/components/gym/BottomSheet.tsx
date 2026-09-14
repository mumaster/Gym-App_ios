import { useEffect, useId, useRef, type ReactNode } from "react";

export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const titleId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
      />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="glass-strong safe-bottom relative max-h-[82vh] overflow-y-auto rounded-t-3xl px-5 pt-3 shadow-[var(--shadow-float)] duration-300 animate-in slide-in-from-bottom outline-none"
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border" />
        <div className="mb-3 flex items-center justify-between">
          <h2 id={titleId} className="text-xl font-bold tracking-tight">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground"
          >
            Done
          </button>
        </div>
        <div className="pb-6">{children}</div>
      </div>
    </div>
  );
}
