import { dayIndexToDate, type CalendarDay } from "../../lib/gym/streak";

/** GitHub-style contribution grid: one column per week, Monday-first rows. */
export function StreakCalendar({ columns }: { columns: CalendarDay[][] }) {
  return (
    <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
      {columns.map((column, i) => (
        <div key={i} className="flex flex-col gap-1">
          {column.map((day) => {
            const label = `${dayIndexToDate(day.dayIndex).toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}${day.isToday ? " (today)" : ""} — ${day.trained ? "trained" : "no session"}`;
            return (
              <div
                key={day.dayIndex}
                role="img"
                aria-label={label}
                title={label}
                className={`size-[10px] rounded-[2px] ${
                  day.trained ? "bg-primary" : "bg-muted"
                } ${day.isToday ? "ring-1 ring-primary ring-offset-1 ring-offset-background" : ""}`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
