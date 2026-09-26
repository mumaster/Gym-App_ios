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
      className="relative flex min-h-[54px] min-w-0 flex-1 flex-col items-center justify-center gap-[3px] pt-1 active:scale-95"
    >
      <Icon
        className={`size-[22px] ${active ? "text-primary" : "text-muted-foreground"}`}
        strokeWidth={active ? 2.4 : 1.9}
      />
      <span
        aria-hidden
        className={`max-w-full truncate text-[10px] font-semibold leading-3 tracking-[-0.01em] ${
          active ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
      {/* Placeholder for the active dot, always present so the row never
          shifts. The visible dot is one element in TabBar that slides to
          whichever placeholder is active. */}
      <span data-tab-dot={active ? "active" : ""} className="size-1" />
      {/* Real iPhone haptic tick on tap — see HapticSwitch.tsx. <Link>
          cancels its click to navigate in-app, which would also cancel the
          switch, so the overlay navigates itself instead. */}
      <HapticSwitch onTap={() => void navigate({ to })} />
    </Link>
  );
}

/** Where the sliding dot sits (relative to the row), and whether it should
 *  animate there: only when moving from one visible tab to another, so it
 *  doesn't fly in from the corner on first paint or when leaving Home. */
function useSlidingDot(pathname: string) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [dot, setDot] = useState({ x: 0, y: 0, visible: false, animate: false });
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const measure = () => {
      const el = row.querySelector<HTMLElement>('[data-tab-dot="active"]');
      if (!el) {
        setDot((d) => ({ ...d, visible: false, animate: false }));
        return;
      }
      // offsetLeft/Top ignore transforms, so a tab still pressed in
      // (active:scale-95) doesn't skew the measurement.
      let x = 0;
      let y = 0;
      for (let n: HTMLElement | null = el; n && n !== row;) {
        x += n.offsetLeft;
        y += n.offsetTop;
        n = n.offsetParent as HTMLElement | null;
      }
      setDot((d) => ({ x, y, visible: true, animate: d.visible }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    return () => ro.disconnect();
  }, [pathname]);
  return { rowRef, dot };
}

export function TabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const t = useTranslation();
  const navigate = useNavigate();
  const { rowRef, dot } = useSlidingDot(pathname);
  if (pathname.startsWith("/session")) return null;
  const homeActive = pathname === "/";

  return (
    <nav className="safe-bottom-tab view-transition-tab-bar fixed inset-x-0 bottom-0 z-40 px-4 pt-2">
      <div className="mx-auto max-w-md">
        <div
          ref={rowRef}
          className="glass-strong relative flex items-stretch gap-1 rounded-3xl px-2 py-1 shadow-[var(--shadow-float)]"
        >
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
                it read as the selected tab from every other screen too. */}
            <span
              className={`flex aspect-square h-full items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-float)] transition-shadow duration-300 ${
                homeActive ? "glow" : ""
              }`}
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
          {/* One dot for the whole bar, sliding between tabs with a slight
              overshoot. Fades out on screens that aren't a tab (Home,
              Settings, Equipment). */}
          <span
            aria-hidden
            className={`pointer-events-none absolute left-0 top-0 size-1 rounded-full bg-primary motion-reduce:transition-none ${
              dot.visible ? "opacity-100" : "opacity-0"
            } ${
              dot.animate
                ? "transition-[transform,opacity] duration-[380ms] ease-[cubic-bezier(0.34,1.4,0.64,1)]"
                : "transition-opacity duration-200"
            }`}
            style={{ transform: `translate(${dot.x}px, ${dot.y}px)` }}
          />
        </div>
      </div>
    </nav>
  );
}
