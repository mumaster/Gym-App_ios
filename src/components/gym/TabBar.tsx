import { Link, useRouterState } from "@tanstack/react-router";
import { Apple, Dumbbell, CalendarDays, Home, type LucideIcon, Search } from "lucide-react";

// Equipment moved into Settings (see settings.tsx) — it's a setup/config
// screen someone visits rarely after their first session, not a daily
// destination, so it didn't earn a permanent tab slot. Home sits in the
// literal center, split off from the other four tabs entirely rather than
// just widened among them — two on each side keep their prior relative
// order (Workout/History before it, Exercises/Nutrition after).
const LEFT_TABS = [
  { to: "/generate", label: "Workout", icon: Dumbbell },
  { to: "/history", label: "History", icon: CalendarDays },
] as const;
const RIGHT_TABS = [
  { to: "/exercises", label: "Exercises", icon: Search },
  { to: "/nutrition", label: "Nutrition", icon: Apple },
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
  return (
    <Link
      to={to}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className="flex min-h-[54px] flex-1 flex-col items-center justify-center gap-1.5 active:scale-95"
    >
      <Icon
        className={`size-[22px] ${active ? "text-primary" : "text-muted-foreground"}`}
        strokeWidth={active ? 2.4 : 1.9}
      />
      {/* Fixed-size dot, always rendered (just transparent when inactive)
          so a tab switching active state never shifts the row's height. */}
      <span className={`size-1 rounded-full ${active ? "bg-primary" : "bg-transparent"}`} />
    </Link>
  );
}

export function TabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname.startsWith("/session")) return null;
  const homeActive = pathname === "/";

  return (
    <nav className="safe-bottom-tab fixed inset-x-0 bottom-0 z-40 px-4 pt-2">
      <div className="mx-auto max-w-md">
        <div className="glass-strong flex items-stretch gap-1 rounded-3xl px-2 py-1 shadow-[var(--shadow-float)]">
          {LEFT_TABS.map((tab) => (
            <TabButton key={tab.to} {...tab} active={pathname.startsWith(tab.to)} />
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
            aria-label="Home"
            aria-current={homeActive ? "page" : undefined}
            className="flex min-h-[54px] flex-1 items-center justify-center active:scale-95"
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
            <span className="glow flex aspect-square h-full items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-float)]">
              <Home className="size-6" strokeWidth={2.2} />
            </span>
          </Link>
          {RIGHT_TABS.map((tab) => (
            <TabButton key={tab.to} {...tab} active={pathname.startsWith(tab.to)} />
          ))}
        </div>
      </div>
    </nav>
  );
}
