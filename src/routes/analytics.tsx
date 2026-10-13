import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, ChevronLeft } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { CardHead } from "../components/gym/CardHead";
import { Card, Screen } from "../components/gym/Screen";
import { fetchAnalyticsSummary, type AnalyticsSummary } from "../lib/gym/analyticsAdmin";
import { formatVersion } from "../lib/gym/changelog";
import { useTranslation } from "../lib/gym/i18n";
import { useGym } from "../lib/gym/store";
import { chip } from "../components/gym/ui";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [{ title: "Usage — Forge" }, { name: "robots", content: "noindex" }] }),
  component: AnalyticsScreen,
});

const RANGES = [7, 14, 30, 90] as const;

/** Rounded-pill bars on a grey track (DESIGN.md: all bars share one style). */
function Bars({
  rows,
  empty,
}: {
  rows: { label: string; value: number; note?: string }[];
  empty: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="text-[13px] text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate">{r.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {r.value}
              {r.note ? ` · ${r.note}` : ""}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
            <div
              className="bar-in-x h-full rounded-full bg-primary"
              style={{ width: `${Math.max(3, (r.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="overflow-hidden p-4">
      <CardHead icon={BarChart3} filled title={title} />
      <div className="space-y-3">{children}</div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-foreground/5 p-3">
      <p className="text-[22px] font-bold tabular-nums">{value}</p>
      <p className="text-[12px] text-muted-foreground">{label}</p>
    </div>
  );
}

function AnalyticsScreen() {
  const t = useTranslation();
  const a = t.analytics;
  const { session, hydrated } = useGym();
  const [days, setDays] = useState<number>(14);
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "denied" | "error">("loading");
  const signedIn = !!session;

  useEffect(() => {
    if (!hydrated || !signedIn) return;
    let alive = true;
    setState("loading");
    fetchAnalyticsSummary(days)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setState("ready");
      })
      .catch((e: Error) => {
        if (!alive) return;
        setState(/not allowed|42501/i.test(e.message) ? "denied" : "error");
      });
    return () => {
      alive = false;
    };
  }, [days, hydrated, signedIn]);

  const tourName = (tour: string) => (tour === "setup" ? a.tourSetup : a.tourWelcome);

  return (
    <Screen
      title={a.dashTitle}
      action={
        <Link
          to="/settings"
          aria-label={a.back}
          className="glass flex size-11 items-center justify-center rounded-full"
        >
          <ChevronLeft className="size-5" />
        </Link>
      }
    >
      {!hydrated ? null : !signedIn ? (
        <p className="text-[14px] text-muted-foreground">{a.signIn}</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {RANGES.map((n) => (
              <button
                key={n}
                onClick={() => setDays(n)}
                aria-pressed={days === n}
                className={`${chip.base} ${days === n ? chip.on : chip.off}`}
              >
                {a.last(n)}
              </button>
            ))}
          </div>
          {state === "loading" ? (
            <p className="text-[14px] text-muted-foreground">{a.loading}</p>
          ) : null}
          {state === "denied" ? <p className="text-[14px]">{a.notAllowed}</p> : null}
          {state === "error" ? <p className="text-[14px]">{a.failed}</p> : null}
          {state === "ready" && data ? (
            <>
              <Section title={a.overview}>
                <div className="grid grid-cols-2 gap-2">
                  <Stat label={a.sessionsLabel} value={data.sessions} />
                  <Stat label={a.eventsLabel} value={data.events} />
                  <Stat label={a.installsLabel} value={data.installs} />
                  <Stat label={a.returningLabel} value={data.returning} />
                </div>
                <Bars
                  empty={a.none}
                  rows={data.per_day.map((d) => ({ label: d.day, value: d.sessions }))}
                />
              </Section>
              <Section title={a.setup}>
                {["welcome", "setup"].map((tour) => (
                  <div key={tour} className="space-y-2">
                    <p className="text-[13px] font-semibold">{tourName(tour)}</p>
                    <Bars
                      empty={a.none}
                      rows={data.setup_funnel
                        .filter((r) => r.tour === tour)
                        .map((r) => ({ label: a.step(r.step), value: r.sessions }))}
                    />
                  </div>
                ))}
              </Section>
              <Section title={a.workouts}>
                <Bars
                  empty={a.none}
                  rows={[
                    ["workout.generated", a.generated],
                    ["workout.started", a.started],
                    ["workout.finished", a.finished],
                    ["workout.cancelled", a.cancelled],
                  ].map(([key, label]) => ({ label: label!, value: data.workouts[key!] ?? 0 }))}
                />
              </Section>
              <Section title={a.swaps}>
                <Bars
                  empty={a.none}
                  rows={data.swaps.map((r) => ({ label: r.exercise, value: r.count }))}
                />
              </Section>
              <Section title={a.features}>
                <Bars
                  empty={a.none}
                  rows={data.features.map((r) => ({
                    label: r.feature,
                    value: r.count,
                    note: `${r.sessions}`,
                  }))}
                />
              </Section>
              <Section title={a.screens}>
                <Bars
                  empty={a.none}
                  rows={data.screens.map((r) => ({ label: r.screen, value: r.count }))}
                />
              </Section>
              <Section title={a.errors}>
                <Bars
                  empty={a.none}
                  rows={data.errors.map((r) => ({
                    label: `${r.name}: ${r.message ?? ""}`,
                    value: r.count,
                    ...(r.version ? { note: formatVersion(r.version) } : {}),
                  }))}
                />
              </Section>
              <Section title={a.versions}>
                <Bars
                  empty={a.none}
                  rows={data.versions.map((r) => ({
                    label: r.version ? formatVersion(r.version) : "?",
                    value: r.sessions,
                  }))}
                />
              </Section>
            </>
          ) : null}
        </div>
      )}
    </Screen>
  );
}
