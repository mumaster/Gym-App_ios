import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { SETTINGS_BUTTON_GUTTER, SettingsButton } from "./SettingsButton";

export function Screen({
  title,
  subtitle,
  action,
  toolbar,
  children,
  padBottom = true,
  fitWhenShort = false,
}: {
  title: string;
  subtitle?: string | undefined;
  action?: ReactNode;
  /** Pinned in the sticky header under the title (a search field), so it
   *  stays at the top of the screen however far the page scrolls. */
  toolbar?: ReactNode;
  children: ReactNode;
  padBottom?: boolean;
  /** While the content already ends above the tab bar, drop the tab-bar
   *  padding and pin the page like Home's, so a page that fits on one screen
   *  can't be scrolled or bounced. Longer content keeps the padding and
   *  scrolls as before. */
  fitWhenShort?: boolean;
}) {
  const mainRef = useRef<HTMLElement>(null);
  const fits = useFitsAboveTabBar(mainRef, fitWhenShort);
  const pb = fits
    ? "pb-0"
    : padBottom
      ? "pb-[calc(var(--tab-bar-content-clearance)+var(--tab-bar-clearance))]"
      : "pb-8";
  return (
    // While it fits, the page is pinned like Home's (fixed, overflow hidden):
    // a document exactly the screen's height still rubber-bands on iOS.
    <div
      className={
        fits ? "fixed inset-0 overflow-hidden bg-background" : "min-h-[100dvh] bg-background"
      }
    >
      <header className="safe-top view-transition-header sticky top-0 z-30 pb-2">
        {/* Separate layer for the blur: WebKit can bleed backdrop-filter
            onto an element's own text when applied directly to the element
            that contains it, instead of confining it to what's behind.
            glass-header (not glass-strong) so this reads as the page's own
            black turned translucent, not a distinct gray panel/bar sitting
            on top of it — see that utility's own comment in styles.css.
            Solid with a toolbar instead: the page scrolls right up under a
            pinned search field, and through the tint its chips and labels
            showed behind the field. */}
        <div className={`absolute inset-0 ${toolbar ? "bg-background" : "glass-header"}`} />
        <div
          className={`relative mx-auto grid min-h-[42px] w-full max-w-xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 ${SETTINGS_BUTTON_GUTTER}`}
        >
          <div className="min-w-0">
            <h1 className="truncate text-[26px] font-bold leading-tight tracking-tight text-foreground">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {action}
          <SettingsButton />
        </div>
        {toolbar ? (
          <div className="relative mx-auto w-full max-w-xl px-4 pt-2">{toolbar}</div>
        ) : null}
      </header>
      <main ref={mainRef} className={`mx-auto w-full max-w-xl px-4 pt-3 ${pb}`}>
        {children}
      </main>
    </div>
  );
}

/** Space kept between the content and the tab bar's top for it to count as
 *  fitting (a layout choice, the same 12 px gap used elsewhere). */
const FIT_GAP_PX = 12;

/** Whether `main`'s content ends at least FIT_GAP_PX above the floating tab
 *  bar's pill. Measured without main's own bottom padding, so dropping the
 *  padding doesn't change the answer. */
function useFitsAboveTabBar(mainRef: RefObject<HTMLElement | null>, enabled: boolean) {
  const [fits, setFits] = useState(false);
  useEffect(() => {
    const main = mainRef.current;
    if (!enabled || !main) {
      setFits(false);
      return;
    }
    const check = () => {
      const pill = document.querySelector("nav .glass-bar");
      if (!pill) return setFits(false);
      const pad = parseFloat(getComputedStyle(main).paddingBottom) || 0;
      const contentBottom = main.getBoundingClientRect().bottom - pad + window.scrollY;
      setFits(contentBottom + FIT_GAP_PX <= pill.getBoundingClientRect().top);
    };
    check();
    // The header (status-bar inset) and the tab bar (home-indicator inset)
    // move the content or the pill without resizing main, so watch them too.
    const ro = new ResizeObserver(check);
    for (const el of [main, main.previousElementSibling, document.querySelector("nav")]) {
      // border-box: the insets are padding, which content-box sizes miss.
      if (el) ro.observe(el, { box: "border-box" });
    }
    window.addEventListener("resize", check);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", check);
    };
  }, [mainRef, enabled]);
  return fits;
}

export function Card({
  children,
  className = "",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`glass w-full rounded-2xl text-left ${onClick ? "active:scale-[0.985] transition-transform" : ""} ${className}`}
    >
      {children}
    </Tag>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1.5 mt-4 px-1 text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  );
}
