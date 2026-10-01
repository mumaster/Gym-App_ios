import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useLayoutEffect, useRef, useState } from "react";
import { Apple, BookOpen, Dumbbell, CalendarDays, Home, type LucideIcon } from "lucide-react";
import { useTranslation } from "../../lib/gym/i18n";
import { HapticSwitch } from "./HapticSwitch";

// Equipment moved into Settings (see settings.tsx) — it's a setup/config
// screen someone visits rarely after their first session, not a daily
// destination, so it didn't earn a permanent tab slot. Home sits in the
// literal center, split off from the other four tabs entirely rather than
// just widened among them — two on each side keep their prior relative
// order (Workout/History before it, Exercises/Nutrition after). Labels are
// translation keys; each tab shows its label under the icon (Apple's HIG
// gives every tab a label). Exercises uses a book rather than a magnifying
// glass, which read as "search".
const LEFT_TABS = [
  { to: "/generate", labelKey: "workout", icon: Dumbbell },
  { to: "/history", labelKey: "history", icon: CalendarDays },
] as const;
const RIGHT_TABS = [
  { to: "/exercises", labelKey: "exercises", icon: BookOpen },
  { to: "/nutrition", labelKey: "nutrition", icon: Apple },
] as const;

function TabButton({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}) {
  const navigate = useNavigate();
  return (
    <Link
      to={to}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      data-tab={active ? "active" : ""}
      className="relative flex min-h-[54px] min-w-0 flex-1 flex-col items-center justify-center gap-[3px] active:scale-95"
    >
      <Icon
        className={`size-[22px] ${active ? "text-primary-text" : "text-muted-foreground"}`}
        strokeWidth={active ? 2.4 : 1.9}
      />
      <span
        aria-hidden
        className={`max-w-full truncate text-[10px] font-semibold leading-3 tracking-[-0.01em] ${
          active ? "text-primary-text" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
      {/* Real iPhone haptic tick on tap — see HapticSwitch.tsx. <Link>
          cancels its click to navigate in-app, which would also cancel the
          switch, so the overlay navigates itself instead. */}
      <HapticSwitch onTap={() => void navigate({ to })} />
    </Link>
  );
}

/** Where the selected tab's glass lozenge sits (relative to the row), and
 *  whether it should animate there: only when moving from one visible tab
 *  to another, so it doesn't fly in from the corner on first paint or when
 *  leaving Home. */
function useSelectionPlatter(pathname: string) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ x: 0, y: 0, w: 0, h: 0, visible: false, animate: false });
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const measure = () => {
      const el = row.querySelector<HTMLElement>('[data-tab="active"]');
      if (!el) {
        setBox((d) => ({ ...d, visible: false, animate: false }));
        return;
      }
      // offset* ignore transforms, so a tab still pressed in
      // (active:scale-95) doesn't skew the measurement. Tabs are direct
      // children of the (relative) row, so these are row coordinates.
      setBox((d) => ({
        x: el.offsetLeft,
        y: el.offsetTop,
        w: el.offsetWidth,
        h: el.offsetHeight,
        visible: true,
        animate: d.visible,
      }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    return () => ro.disconnect();
  }, [pathname]);
  return { rowRef, box };
}

export function TabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const t = useTranslation();
  const navigate = useNavigate();
  const { rowRef, box } = useSelectionPlatter(pathname);
  if (pathname.startsWith("/session")) return null;
  const homeActive = pathname === "/";

  return (
    <nav className="safe-bottom-tab view-transition-tab-bar fixed inset-x-0 bottom-0 z-40 px-4 pt-2">
      {/* Scroll edge effect: page content fades out as it passes under the
          bar (see styles.css). It starts at the nav's own top, so buttons pinned
          just above the bar (Generate, Start workout) aren't faded. */}
      <div aria-hidden className="scroll-edge-bottom pointer-events-none absolute inset-0 -z-10" />
      <div className="mx-auto max-w-md">
        <div
          ref={rowRef}
          className="glass-bar relative flex items-stretch gap-1 rounded-full px-2 py-1"
        >
          {/* The selected tab's glass lozenge, as on iOS 26's tab bar: one
              element for the whole bar, sliding between tabs with a slight
              overshoot. First in the row so it paints under the tabs. Fades
              out on screens that aren't a tab (Home, Settings, Equipment) —
              Home's own circle is its indicator. */}
          <span
            aria-hidden
            className={`pointer-events-none absolute left-0 top-0 rounded-full bg-foreground/[0.09] shadow-[inset_0_1px_0_oklch(1_0_0/12%)] motion-reduce:transition-none ${
              box.visible ? "opacity-100" : "opacity-0"
            } ${
              box.animate
                ? "transition-[transform,opacity] duration-[380ms] ease-[cubic-bezier(0.34,1.4,0.64,1)]"
                : "transition-opacity duration-200"
            }`}
            style={{
              width: box.w,
              height: box.h,
              transform: `translate(${box.x}px, ${box.y}px)`,
            }}
          />
          {LEFT_TABS.map(({ labelKey, ...tab }) => (
            <TabButton
              key={tab.to}
              {...tab}
              label={t.tabbar[labelKey]}
              active={pathname.startsWith(tab.to)}
            />
          ))}
          {/* Home used to be a detached circle raised above the pill's own
              top edge (`absolute`, `-translate-y-1/2`), which pushed the
              bar's total footprint taller than the other four tabs' own
              row and needed extra top padding on <nav> plus a larger
              --tab-bar-content-clearance everywhere else to keep from
              clipping page content under it (see CLAUDE.md). Reported as
              wanting that space back: Home is now an ordinary flex-1 cell
              in the same row as the other four, same `min-h-[54px]`, no
              longer poking above the bar at all — the badge inside it is
              what stays visually distinct, not the row's own height. */}
          <Link
            to="/"
            aria-label={t.tabbar.home}
            aria-current={homeActive ? "page" : undefined}
            className="relative flex min-h-[54px] w-14 shrink-0 items-center justify-center active:scale-95"
          >
            {/* Solid bg-primary/text-primary-foreground, always — the one
                permanently-emphasized action on this bar, so (unlike the
                other four tabs' icon-color-only active state) its fill
                never mutes just because you're not currently on `/`.
                Follows whichever accent is chosen in Settings like every
                other themed surface; nothing here is hardcoded. `h-full`
                (rather than a fixed `size-*`) makes it exactly as tall as
                the row itself, edge-to-edge with the other tabs' own
                min-h-[54px] cell; `aspect-square` keeps the width locked
                to that same height so rounded-full still yields a true
                circle (same radius top/bottom/left/right) instead of
                stretching into a pill/oval shape. */}
            {/* shrink-0 rather than flex-1: the cell is only as wide as its
                circle, which leaves the four labelled tabs room for their
                labels (Dutch "Oefeningen" was truncating at 390pt). */}
            {/* The glow only while Home is the current screen: always-on,
                it read as the selected tab from every other screen too.
                Elsewhere it's a dim version of itself (asked for, twice:
                55% opacity still read as active): the fill is the accent
                mixed 30% into the page background (in oklab: oklch
                interpolates the hue towards black's 0° and came out orange), so a dark tint in dark
                mode and a pale one in light, with a muted icon and no
                shadow. */}
            <span
              className={`flex aspect-square h-full items-center justify-center rounded-full transition-[background-color,color,box-shadow] duration-300 ${
                homeActive
                  ? "glow bg-primary text-primary-foreground shadow-[var(--shadow-float)]"
                  : "text-foreground/55"
              }`}
              style={
                homeActive
                  ? undefined
                  : {
                      backgroundColor: "color-mix(in oklab, var(--primary) 30%, var(--background))",
                    }
              }
            >
              <Home className="size-6" strokeWidth={2.2} />
            </span>
            <HapticSwitch onTap={() => void navigate({ to: "/" })} />
          </Link>
          {RIGHT_TABS.map(({ labelKey, ...tab }) => (
            <TabButton
              key={tab.to}
              {...tab}
              label={t.tabbar[labelKey]}
              active={pathname.startsWith(tab.to)}
            />
          ))}
        </div>
      </div>
    </nav>
  );
}
