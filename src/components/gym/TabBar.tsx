import { Link, useRouterState } from "@tanstack/react-router";
import { Dumbbell, CalendarDays, LayoutGrid, Search } from "lucide-react";

const TABS = [
  { to: "/", label: "Workout", icon: Dumbbell },
  { to: "/equipment", label: "Equipment", icon: LayoutGrid },
  { to: "/history", label: "History", icon: CalendarDays },
  { to: "/exercises", label: "Exercises", icon: Search },
] as const;

export function TabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname.startsWith("/session")) return null;

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 px-4 pt-2">
      <div className="glass-strong mx-auto flex max-w-md items-stretch justify-between gap-1 rounded-3xl p-1.5 shadow-[var(--shadow-float)]">
        {TABS.map(({ to, label, icon: Icon }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={`flex min-h-[54px] min-w-[44px] flex-1 flex-col active:scale-95 items-center justify-center gap-1 rounded-[1.875rem] text-[11px] font-medium transition-colors ${
                active ? "bg-primary/15 text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 1.9} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
