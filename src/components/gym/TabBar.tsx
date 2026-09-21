import { Link, useRouterState } from "@tanstack/react-router";
import { Apple, Dumbbell, CalendarDays, Home, Search } from "lucide-react";

// Equipment moved into Settings (see settings.tsx) — it's a setup/config
// screen someone visits rarely after their first session, not a daily
// destination, so it didn't earn a permanent tab slot. Home sits in the
// literal center of what's left, with two tabs on each side keeping their
// prior relative order (Workout/History before it, Exercises/Nutrition
// after) — center billing matches it being the app's actual landing screen.
const TABS = [
  { to: "/generate", label: "Workout", icon: Dumbbell, emphasize: false },
  { to: "/history", label: "History", icon: CalendarDays, emphasize: false },
  { to: "/", label: "Home", icon: Home, emphasize: true },
  { to: "/exercises", label: "Exercises", icon: Search, emphasize: false },
  { to: "/nutrition", label: "Nutrition", icon: Apple, emphasize: false },
] as const;

export function TabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname.startsWith("/session")) return null;

  return (
    <nav className="safe-bottom-tab fixed inset-x-0 bottom-0 z-40 px-4 pt-2">
      <div className="glass-strong mx-auto flex max-w-md items-stretch justify-between gap-1 rounded-3xl p-1.5 shadow-[var(--shadow-float)]">
        {TABS.map(({ to, label, icon: Icon, emphasize }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? "page" : undefined}
              // Home reads as "slightly larger" than its siblings purely
              // through a bigger icon and a wider flex share (1.35× the
              // others' growth) — min-h stays the identical 54px so the
              // row itself never grows to fit it, it just claims more of
              // the row's existing height/width for itself.
              className={`flex min-h-[54px] min-w-[44px] ${emphasize ? "flex-[1.35]" : "flex-1"} flex-col active:scale-95 items-center justify-center gap-1 rounded-[1.875rem] text-[11px] font-medium transition-colors ${
                active ? "bg-primary/15 text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon
                className={emphasize ? "size-[26px]" : "size-[22px]"}
                strokeWidth={active ? 2.4 : 1.9}
              />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
