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
    <nav className="safe-bottom-tab fixed inset-x-0 bottom-0 z-40 px-4 pt-8">
      {/* relative anchor for the Home button below — it's positioned
          against THIS box, not the pill's own (which would shift if the
          pill's own padding/height ever changes). */}
      <div className="relative mx-auto max-w-md">
        <div className="glass-strong flex items-stretch gap-1 rounded-3xl px-2 py-1 shadow-[var(--shadow-float)]">
          {LEFT_TABS.map((tab) => (
            <TabButton key={tab.to} {...tab} active={pathname.startsWith(tab.to)} />
          ))}
          {/* Empty space the size of the Home button below, so the side
              tabs never render underneath it. */}
          <div className="w-16 shrink-0" aria-hidden="true" />
          {RIGHT_TABS.map((tab) => (
            <TabButton key={tab.to} {...tab} active={pathname.startsWith(tab.to)} />
          ))}
        </div>

        {/* The one tile on this bar that's deliberately "loose" from the
            rest — a raised circle centered on the pill's own top edge
            (half overlapping down into it, half floating free above),
            rather than just a wider slot inside the same row like the
            other four. Filled with bg-primary/text-primary-foreground so
            it follows whichever accent color is chosen in Settings, the
            same as every other themed surface in the app — nothing about
            it is hardcoded. Always solid, not muted when inactive: it's
            the app's one permanently-emphasized action, not a tab whose
            color should fade based on where you currently are. */}
        <Link
          to="/"
          aria-label="Home"
          aria-current={homeActive ? "page" : undefined}
          className="glow absolute left-1/2 top-0 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-float)] active:scale-95"
        >
          <Home className="size-7" strokeWidth={2.2} />
        </Link>
      </div>
    </nav>
  );
}
