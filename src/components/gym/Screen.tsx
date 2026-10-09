import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { fitFontSize } from "../../lib/gym/name";
import { SETTINGS_BUTTON_GUTTER, SettingsButton } from "./SettingsButton";

export function Screen({
  title,
  subtitle,
  action,
  toolbar,
  children,
  padBottom = true,
  fitWhenShort = false,
  onSpace,
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
  /** With fitWhenShort: called with the room left between the content's end
   *  and the tab bar's pill (negative when it runs under it), so a screen can
   *  use spare height for more content (Home). */
  onSpace?: (px: number) => void;
}) {
  const mainRef = useRef<HTMLElement>(null);
  const fits = useFitsAboveTabBar(mainRef, fitWhenShort, onSpace);
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
          {/* Top-anchored at the offset a lone title gets when centered in the
              42px row, so a subtitle (Home) can't pull the title upward. */}
          <div className="min-w-0 self-start pt-[5px]">
            <FitTitle text={title} />
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
function useFitsAboveTabBar(
  mainRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  onSpace?: (px: number) => void,
) {
  const [fits, setFits] = useState(false);
  const onSpaceRef = useRef(onSpace);
  // Layout effect: ResizeObserver callbacks can run before a plain effect,
  // and must see this render's callback.
  useLayoutEffect(() => {
    onSpaceRef.current = onSpace;
  });
  const checkRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const main = mainRef.current;
    if (!enabled || !main) {
      checkRef.current = null;
      setFits(false);
      return;
    }
    const check = () => {
      const pill = document.querySelector("nav .glass-bar");
      if (!pill) return setFits(false);
      const pad = parseFloat(getComputedStyle(main).paddingBottom) || 0;
      const contentBottom = main.getBoundingClientRect().bottom - pad + window.scrollY;
      const space = pill.getBoundingClientRect().top - contentBottom;
      setFits(space >= FIT_GAP_PX);
      onSpaceRef.current?.(space);
    };
    checkRef.current = check;
    check();
    // The header (status-bar inset) and the tab bar (home-indicator inset)
    // move the content or the pill without resizing main, so watch them too.
    const ro = new ResizeObserver(check);
    for (const el of [main, main.previousElementSibling, document.querySelector("nav")]) {
      // border-box: the insets are padding, which content-box sizes miss.
      if (el) ro.observe(el, { box: "border-box" });
    }
    // A first measurement can land mid page-transition or before fonts and
    // the tab bar have settled, and none of the observers fire when the
    // content ends up where it was measured (Home then kept a stale `room`
    // and dropped its intake bars until the next resize). Measure again once
    // things have settled, and whenever the page comes back.
    const raf = requestAnimationFrame(() => requestAnimationFrame(check));
    const timer = window.setTimeout(check, 350);
    void document.fonts?.ready.then(check);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    window.addEventListener("resize", check);
    window.addEventListener("pageshow", check);
    document.addEventListener("visibilitychange", onVisible);
    window.visualViewport?.addEventListener("resize", check);
    return () => {
      checkRef.current = null;
      ro.disconnect();
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      window.removeEventListener("resize", check);
      window.removeEventListener("pageshow", check);
      document.removeEventListener("visibilitychange", onVisible);
      window.visualViewport?.removeEventListener("resize", check);
    };
  }, [mainRef, enabled]);
  // After every render, too: whatever re-rendered the page (data arriving, an
  // extra drawn) may have moved its bottom edge without resizing `main`. A
  // passive effect, so the parent's layout effects (Home's `drawnCost`) have
  // already run when `onSpace` reads them.
  useEffect(() => {
    checkRef.current?.();
  });
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

const TITLE_MAX_PX = 26;
const TITLE_MIN_PX = 11;

/** The screen title on one line: 26 px, shrunk (down to 11 px) only as far as
 *  the text needs to fit the room beside the settings button. A greeting with
 *  a long name is the case; ellipsis stays as the last resort below 11 px. */
function FitTitle({ text }: { text: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [size, setSize] = useState(TITLE_MAX_PX);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      // Measured at the full size, whatever the current one is.
      const previous = el.style.fontSize;
      el.style.fontSize = `${TITLE_MAX_PX}px`;
      el.style.overflow = "visible";
      const width = el.scrollWidth;
      el.style.fontSize = previous;
      el.style.overflow = "";
      const available = el.clientWidth;
      setSize(fitFontSize(width / TITLE_MAX_PX, available, TITLE_MAX_PX, TITLE_MIN_PX));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // The web font can land after the first measurement and change the width.
    void document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, [text]);
  return (
    <h1
      ref={ref}
      style={{ fontSize: size }}
      className="truncate whitespace-nowrap font-bold leading-tight tracking-tight text-foreground"
    >
      {text}
    </h1>
  );
}
