import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Apple,
  BookmarkPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Droplet,
  Dumbbell,
  Flame,
  Heart,
  Image as ImageIcon,
  Minus,
  Plus,
  ScanBarcode,
  SlidersHorizontal,
  Search,
  Timer,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { AnatomyPreview } from "./AnatomyMap";
import { useLocale, useTranslation } from "../../lib/gym/i18n";
import { READINESS_EMOJI } from "../../lib/gym/readiness";
import { haptic, useGym } from "../../lib/gym/store";

/**
 * First-launch tour: one swipeable step per part of the app, each with a
 * small mock-up filled with example data (a chest-and-triceps session, a
 * breakfast and lunch, a squat PR, a run from a watch…). Everything shown is
 * made up for illustration, drawn with the app's own tokens so it follows
 * the chosen theme and accent; nothing here reads or writes the user's data
 * except `welcomeSeen` (and `language`, from the switch in the corner).
 *
 * The example numbers follow the app's own rules so the tour doesn't promise
 * something the app won't do: a 45-min session is 3 × 6–10 on compounds and
 * 3 × 10–14 on accessories (generator.ts's shapeFor), rests are 2:00, 80 kg
 * × 10 on every set twice becomes 82.5 kg × 6 (progression.ts, 2.5% upper
 * body rounded to a 2.5 kg step), the squat PR's estimate is Epley's
 * (100 × (1 + 6/30) = 120), the foods are NEVO 2025/9.0 values, and the
 * bodyweight suggestion is bodyweight.ts's arithmetic for an 80 kg cut at
 * the moderate 0.75%/week (0.6 kg) with a 0.4 kg/week trend: 0.2 × 7700 / 7
 * ≈ 220 kcal a day less.
 */
export function WelcomeTour() {
  const { hydrated, welcomeSeen, update, language } = useGym();
  if (!hydrated || welcomeSeen) return null;
  return <Tour language={language} onDone={() => update({ welcomeSeen: true })} />;
}

function Tour({ language, onDone }: { language: "en" | "nl"; onDone: () => void }) {
  const t = useTranslation();
  const { update } = useGym();
  const navigate = useNavigate();
  const scroller = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const slides: { key: string; title: string; body: string; mock: ReactNode }[] = [
    { key: "intro", title: t.welcome.introTitle, body: t.welcome.introBody, mock: <IntroMock /> },
    {
      key: "workout",
      title: t.welcome.workoutTitle,
      body: t.welcome.workoutBody,
      mock: <WorkoutMock />,
    },
    {
      key: "session",
      title: t.welcome.sessionTitle,
      body: t.welcome.sessionBody,
      mock: <SessionMock />,
    },
    {
      key: "progress",
      title: t.welcome.progressTitle,
      body: t.welcome.progressBody,
      mock: <ProgressMock />,
    },
    { key: "plan", title: t.welcome.planTitle, body: t.welcome.planBody, mock: <PlanMock /> },
    { key: "food", title: t.welcome.foodTitle, body: t.welcome.foodBody, mock: <FoodMock /> },
    {
      key: "limits",
      title: t.welcome.limitsTitle,
      body: t.welcome.limitsBody,
      mock: <LimitsMock />,
    },
    { key: "home", title: t.welcome.homeTitle, body: t.welcome.homeBody, mock: <HomeMock /> },
    { key: "watch", title: t.welcome.watchTitle, body: t.welcome.watchBody, mock: <WatchMock /> },
    { key: "ready", title: t.welcome.readyTitle, body: t.welcome.readyBody, mock: null },
  ];
  const last = slides.length - 1;

  useEffect(() => {
    dialog.current?.focus();
  }, []);

  const goTo = (i: number) => {
    const el = scroller.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: i * el.clientWidth, behavior: reduce ? "auto" : "smooth" });
  };

  const onScroll = () => {
    const el = scroller.current;
    if (!el || !el.clientWidth) return;
    setIndex(Math.max(0, Math.min(last, Math.round(el.scrollLeft / el.clientWidth))));
  };

  const finish = (to?: "/generate" | "/equipment" | "/nutrition") => {
    haptic(15);
    if (to) navigate({ to });
    onDone();
  };

  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label={t.welcome.dialogLabel}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") goTo(Math.min(last, index + 1));
        if (e.key === "ArrowLeft") goTo(Math.max(0, index - 1));
      }}
      className="fixed inset-0 z-[80] flex flex-col bg-background outline-none"
    >
      <div className="safe-top shrink-0">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-3 px-4 pb-1">
          <div className="flex rounded-full bg-secondary p-0.5" role="group">
            {(["en", "nl"] as const).map((l) => (
              <button
                key={l}
                onClick={() => update({ language: l })}
                aria-pressed={language === l}
                aria-label={l === "en" ? "English" : "Nederlands"}
                className={`min-h-[32px] rounded-full px-3 text-[12.5px] font-bold uppercase ${
                  language === l
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          {index < last ? (
            <button
              onClick={() => finish()}
              className="min-h-[40px] rounded-full px-3 text-[15px] font-semibold text-muted-foreground"
            >
              {t.welcome.skip}
            </button>
          ) : null}
        </div>
      </div>

      <div
        ref={scroller}
        onScroll={onScroll}
        className="no-scrollbar flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
      >
        {slides.map((s, i) => (
          <section
            key={s.key}
            aria-roledescription="slide"
            aria-label={t.welcome.stepOf(i + 1, slides.length)}
            inert={i !== index}
            className="no-scrollbar h-full w-full shrink-0 snap-center snap-always overflow-y-auto"
          >
            <div className="mx-auto flex min-h-full w-full max-w-xl flex-col px-5">
              {s.mock ? (
                <div className="flex flex-1 flex-col justify-center py-2">
                  {i > 0 ? (
                    <p className="mb-1.5 text-center text-[10.5px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80">
                      {t.welcome.example}
                    </p>
                  ) : null}
                  <div inert aria-hidden className="pointer-events-none select-none">
                    {s.mock}
                  </div>
                </div>
              ) : (
                <div className="flex-1" />
              )}
              <div className="shrink-0 pb-3 pt-1.5">
                <h2 className="text-[24px] font-bold leading-tight tracking-tight">{s.title}</h2>
                <p className="mt-1.5 text-[15px] leading-snug text-muted-foreground">{s.body}</p>
                {s.key === "ready" ? (
                  <div className="mt-5 space-y-2">
                    <ReadyAction
                      icon={<Dumbbell className="size-5" />}
                      label={t.welcome.readyWorkout}
                      primary
                      onClick={() => finish("/generate")}
                    />
                    <ReadyAction
                      icon={<Apple className="size-5" />}
                      label={t.welcome.readyFood}
                      onClick={() => finish("/nutrition")}
                    />
                    <ReadyAction
                      icon={<SlidersHorizontal className="size-5" />}
                      label={t.welcome.readyEquipment}
                      onClick={() => finish("/equipment")}
                    />
                    <button
                      onClick={() => finish()}
                      className="min-h-[44px] w-full rounded-2xl text-[15px] font-semibold text-muted-foreground"
                    >
                      {t.welcome.readyLook}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ))}
      </div>

      <div className="safe-bottom shrink-0">
        <div className="mx-auto flex w-full max-w-xl items-center gap-3 px-5 pt-2">
          <button
            onClick={() => goTo(Math.max(0, index - 1))}
            aria-label={t.welcome.back}
            className={`flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground ${index === 0 ? "invisible" : ""}`}
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="flex flex-1 items-center justify-center gap-1">
            {slides.map((s, i) => (
              <button
                key={s.key}
                onClick={() => goTo(i)}
                aria-label={t.welcome.goTo(i + 1, slides.length)}
                aria-current={i === index ? "step" : undefined}
                className="flex h-8 items-center justify-center px-[3px]"
              >
                <span
                  className={`block h-1.5 rounded-full transition-all duration-300 ${
                    i === index ? "w-5 bg-primary" : "w-1.5 bg-foreground/25"
                  }`}
                />
              </button>
            ))}
          </div>
          {index < last ? (
            <button
              onClick={() => goTo(index + 1)}
              className="flex min-h-[48px] shrink-0 items-center gap-1 rounded-full bg-primary pl-5 pr-4 text-[16px] font-bold text-primary-foreground active:scale-95"
            >
              {t.welcome.next}
              <ChevronRight className="size-5" />
            </button>
          ) : (
            <span className="w-12 shrink-0" />
          )}
        </div>
      </div>
    </div>
  );
}

function ReadyAction({
  icon,
  label,
  primary,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex min-h-[54px] w-full items-center gap-3 rounded-2xl px-4 text-left text-[16px] font-semibold active:scale-[0.985] ${
        primary ? "glow bg-primary text-primary-foreground" : "glass text-foreground"
      }`}
    >
      <span className={primary ? "" : "text-primary-text"}>{icon}</span>
      <span className="min-w-0 flex-1">{label}</span>
      <ChevronRight className="size-5 opacity-60" />
    </button>
  );
}

/* ---------- mock-ups ---------- */

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`glass rounded-2xl p-3 ${className}`}>{children}</div>;
}

function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={`text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground ${className}`}
    >
      {children}
    </p>
  );
}

function Bar({ pct, className = "" }: { pct: number; className?: string }) {
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-muted ${className}`}>
      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

function IntroMock() {
  const t = useTranslation();
  const icons = [Dumbbell, Apple, TrendingUp];
  return (
    <div className="flex flex-col items-center">
      <div className="glow flex size-24 items-center justify-center rounded-[2rem] bg-primary text-primary-foreground">
        <Dumbbell className="size-12" strokeWidth={2.2} />
      </div>
      <p className="mt-4 text-[13px] font-black tracking-[0.5em] text-foreground">FORGE</p>
      <Panel className="mt-6 w-full space-y-3 p-4">
        {t.welcome.introPoints.map((p, i) => {
          const Icon = icons[i] ?? Check;
          return (
            <div key={p} className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Icon className="size-[18px]" />
              </span>
              <span className="text-[14.5px] font-semibold leading-snug">{p}</span>
            </div>
          );
        })}
      </Panel>
    </div>
  );
}

const PLAN = [
  { name: "Barbell Bench Press", scheme: "3 × 6–10", load: "80 kg" },
  { name: "Incline Dumbbell Press", scheme: "3 × 6–10", load: "26 kg" },
  { name: "Dumbbell Flye", scheme: "3 × 10–14", load: "12 kg" },
  { name: "Cable Triceps Pushdown", scheme: "3 × 10–14", load: "25 kg" },
];

function WorkoutMock() {
  const t = useTranslation();
  return (
    <div className="space-y-2.5">
      <div className="mx-auto w-[176px]">
        <AnatomyPreview selected={["chest", "triceps"]} />
      </div>
      <Panel className="p-0">
        <p className="px-3.5 pb-0.5 pt-2.5 text-[12px] font-semibold text-muted-foreground">
          {t.welcome.workoutPlan}
        </p>
        {PLAN.map((e, i) => (
          <div
            key={e.name}
            className={`flex items-center gap-3 px-3.5 py-1 ${i > 0 ? "border-t border-border" : ""}`}
          >
            <span className="tabular flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-bold">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-semibold">{e.name}</span>
              <span className="tabular block text-[11.5px] text-muted-foreground">
                {e.scheme} · {e.load}
              </span>
            </span>
          </div>
        ))}
      </Panel>
    </div>
  );
}

function SessionMock() {
  const t = useTranslation();
  const sets = [
    { w: 80, r: 10, done: true },
    { w: 80, r: 10, done: true },
    { w: 80, r: 10, done: false },
  ];
  return (
    <div className="space-y-2.5">
      <Panel className="p-4">
        <p className="text-[12px] font-semibold uppercase tracking-widest text-primary-text">
          {t.welcome.sessionSet(3, 3)}
        </p>
        <p className="mt-0.5 text-[20px] font-bold leading-tight">Barbell Bench Press</p>
        <div className="mt-3 space-y-1.5">
          {sets.map((s, i) => (
            <div
              key={i}
              className={`tabular flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] ${
                s.done ? "bg-muted/60" : "bg-primary/15 ring-1 ring-primary/40"
              }`}
            >
              <span className="w-4 font-bold text-muted-foreground">{i + 1}</span>
              <span className="flex-1 font-semibold">
                {s.w} kg × {s.r}
              </span>
              {s.done ? (
                <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3" strokeWidth={3.5} />
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span className="flex size-6 items-center justify-center rounded-full bg-secondary">
                    <Minus className="size-3.5" />
                  </span>
                  <span className="flex size-6 items-center justify-center rounded-full bg-secondary">
                    <Plus className="size-3.5" />
                  </span>
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex min-h-[44px] items-center justify-center rounded-xl bg-primary text-[15px] font-bold text-primary-foreground">
          {t.welcome.sessionLog}
        </div>
      </Panel>
      <div className="glass-strong flex items-center gap-3 rounded-full px-4 py-2.5">
        <Timer className="size-5 text-primary-text" />
        <span className="tabular text-[20px] font-bold">1:42</span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t.welcome.sessionRest}
          </span>
          <span className="block truncate text-[12.5px]">{t.welcome.sessionNext}</span>
        </span>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-[12px] font-semibold">
          +30 s
        </span>
      </div>
      <Panel className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <TrendingUp className="size-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="tabular text-[14.5px] font-bold">
            {t.welcome.sessionNextTime}: 82.5 kg × 6
          </p>
          <p className="text-[12.5px] text-muted-foreground">{t.welcome.sessionWhy}</p>
        </div>
      </Panel>
    </div>
  );
}

/** Est. 1RM over eight sessions of the example bench (Epley, rising to
 *  80 kg × 10 ≈ 107). */
const E1RM = [96, 97, 99, 99, 101, 103, 104, 107];

function ProgressMock() {
  const t = useTranslation();
  const w = 300;
  const h = 84;
  const min = 94;
  const max = 108;
  const pts = E1RM.map((v, i) => [
    8 + (i * (w - 16)) / (E1RM.length - 1),
    h - 8 - ((v - min) / (max - min)) * (h - 16),
  ]);
  const sets = [
    { m: "Chest", done: 9, target: 10 },
    { m: "Back", done: 12, target: 20 },
    { m: "Quads", done: 10, target: 10 },
    { m: "Shoulders", done: 5, target: 10 },
  ];
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        <Panel>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Flame className="size-4" />
            </span>
            <span className="tabular text-[24px] font-bold leading-none">6</span>
          </div>
          <p className="mt-1.5 text-[12.5px] font-semibold">{t.welcome.progressStreak}</p>
          <p className="text-[11.5px] text-muted-foreground">{t.welcome.progressStreakSub}</p>
        </Panel>
        <Panel>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Trophy className="size-4" />
            </span>
            <Eyebrow>{t.welcome.progressPr}</Eyebrow>
          </div>
          <p className="mt-1.5 truncate text-[12.5px] font-semibold">Barbell Back Squat</p>
          <p className="tabular text-[13px] font-bold">100 kg × 6</p>
          <p className="tabular text-[11px] text-muted-foreground">≈120 kg est. 1RM</p>
        </Panel>
      </div>
      <Panel>
        <div className="flex items-baseline justify-between gap-2">
          <Eyebrow className="min-w-0 truncate">{t.welcome.progressChart}</Eyebrow>
          <span className="tabular shrink-0 text-[13px] font-bold text-primary-text">107 kg</span>
        </div>
        <svg viewBox={`0 0 ${w} ${h}`} className="mt-1 block h-auto w-full">
          {[0.33, 0.66].map((f) => (
            <line
              key={f}
              x1={0}
              x2={w}
              y1={h * f}
              y2={h * f}
              stroke="var(--border)"
              strokeWidth={1}
            />
          ))}
          <polyline
            points={pts.map((p) => p.join(",")).join(" ")}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {pts.map(([x, y], i) => (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={i === pts.length - 1 ? 4.5 : 3}
              fill="var(--primary)"
              stroke="var(--chart-surface)"
              strokeWidth={2}
            />
          ))}
        </svg>
      </Panel>
      <Panel className="space-y-2">
        <Eyebrow>{t.welcome.progressSets}</Eyebrow>
        {sets.map((s) => (
          <div key={s.m} className="flex items-center gap-3">
            <span className="w-[76px] shrink-0 text-[12.5px] font-semibold">{s.m}</span>
            <Bar pct={(s.done / s.target) * 100} className="flex-1" />
            <span className="tabular w-10 shrink-0 text-right text-[12px] text-muted-foreground">
              {s.done}/{s.target}
            </span>
          </div>
        ))}
      </Panel>
    </div>
  );
}

function PlanMock() {
  const t = useTranslation();
  const locale = useLocale();
  // Monday-first week: Push done Monday, Pull missed Wednesday, Legs Friday.
  const dow = [1, 2, 3, 4, 5, 6, 0].map((d) => t.common.dow[d]!);
  const marks: ("done" | "missed" | "planned" | null)[] = [
    "done",
    null,
    "missed",
    null,
    "planned",
    null,
    null,
  ];
  const wednesday = new Date(2026, 8, 30).toLocaleDateString(locale, { weekday: "long" });
  return (
    <div className="space-y-2.5">
      <Panel className="p-4">
        <p className="text-[12px] font-semibold uppercase tracking-widest text-primary-text">
          {t.welcome.planWeek(3, 5)}
        </p>
        <p className="mt-0.5 text-[20px] font-bold leading-tight">Push / Pull / Legs</p>
        <div className="mt-3 grid grid-cols-7 gap-1">
          {dow.map((d, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase text-muted-foreground">
                {d.slice(0, 2)}
              </span>
              {marks[i] === "done" ? (
                <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
              ) : marks[i] === "missed" ? (
                <span className="size-7 rounded-full border-2 border-dashed border-amber-500" />
              ) : marks[i] === "planned" ? (
                <span className="size-7 rounded-full border-2 border-primary" />
              ) : (
                <span className="flex size-7 items-center justify-center">
                  <span className="size-1.5 rounded-full bg-foreground/25" />
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-end gap-1.5">
          {[1, 2, 3, 4, 5].map((w) => (
            <div key={w} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`w-full rounded-md ${
                  w === 5 ? "h-4 bg-primary/35" : w <= 3 ? "h-8 bg-primary" : "h-8 bg-primary/35"
                }`}
              />
              <span className="text-[10.5px] font-semibold text-muted-foreground">
                {w === 5 ? t.welcome.planDeload : `W${w}`}
              </span>
            </div>
          ))}
        </div>
      </Panel>
      <Panel className="border-amber-500/40 p-3.5">
        <p className="text-[14px] font-bold">{t.schedule.missedTitle("Pull", wednesday)}</p>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">{t.schedule.missedDesc}</p>
        <div className="mt-2.5 flex gap-2">
          <span className="flex min-h-[38px] flex-1 items-center justify-center rounded-xl bg-primary text-[13.5px] font-bold text-primary-foreground">
            {t.schedule.doItToday}
          </span>
          <span className="flex min-h-[38px] flex-1 items-center justify-center rounded-xl bg-secondary text-[13.5px] font-semibold">
            {t.schedule.skip}
          </span>
        </div>
      </Panel>
    </div>
  );
}

// NEVO 2025/9.0 values per 100 g (codes 213, 151, 301, 1392, 658, 920),
// scaled to the portions shown, as the app would log them.
function FoodMock() {
  const t = useTranslation();
  const f = t.welcome.foods;
  const lunch = [
    { name: f.chicken, grams: 150, kcal: 237, p: 46 },
    { name: f.rice, grams: 200, kcal: 292, p: 6 },
    { name: f.broccoli, grams: 150, kcal: 41, p: 6 },
  ];
  return (
    <div className="space-y-2.5">
      <div className="flex gap-2">
        <div className="glass flex h-11 flex-1 items-center gap-2 rounded-2xl px-3">
          <Search className="size-4 text-muted-foreground" />
          <span className="text-[15px]">{t.welcome.foodSearch}</span>
          <span className="h-4 w-px animate-pulse bg-primary" />
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <ScanBarcode className="size-5" />
        </div>
      </div>
      <Panel className="p-0">
        {[
          { name: f.banana, kcal: 92 },
          { name: f.plantain, kcal: 138 },
        ].map((r, i) => (
          <div
            key={r.name}
            className={`flex items-center gap-3 px-3.5 py-2.5 ${i > 0 ? "border-t border-border" : ""}`}
          >
            <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{r.name}</span>
            <span className="tabular text-[12px] text-muted-foreground">
              {t.welcome.foodPer100(r.kcal)}
            </span>
            <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Plus className="size-4" />
            </span>
          </div>
        ))}
      </Panel>
      <div>
        <div className="mb-1.5 flex items-center justify-between px-1">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t.mealTypes.lunch}
            <span className="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="size-2.5" strokeWidth={3.5} />
            </span>
          </p>
          <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11.5px] font-semibold">
            <BookmarkPlus className="size-3.5" />
            {t.welcome.foodSave}
          </span>
        </div>
        <Panel className="p-0">
          {lunch.map((r, i) => (
            <div
              key={r.name}
              className={`flex items-center gap-3 px-3.5 py-2 ${i > 0 ? "border-t border-border" : ""}`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold">{r.name}</p>
                <p className="tabular text-[11.5px] text-muted-foreground">
                  {r.grams} g · P {r.p}
                </p>
              </div>
              <span className="tabular text-[13px] font-semibold">{r.kcal} kcal</span>
            </div>
          ))}
        </Panel>
      </div>
      <p className="px-1 text-[10px] leading-snug text-muted-foreground">
        {t.nutrition.nevoReference}
      </p>
    </div>
  );
}

function LimitsMock() {
  const t = useTranslation();
  const locale = useLocale();
  const n = (v: number) => v.toLocaleString(locale);
  const macros = [
    { k: t.nutrients.protein, v: 118, g: 176 },
    { k: t.nutrients.carbs, v: 160, g: 262 },
    { k: t.nutrients.fat, v: 48, g: 67 },
  ];
  // Eight weeks of weigh-ins drifting down about 0.4 kg a week.
  const kg = [81.9, 81.6, 81.7, 81.2, 81.0, 80.9, 80.5, 80.6, 80.2, 79.9, 80.0, 79.6];
  const w = 300;
  const h = 70;
  const lo = 79.2;
  const hi = 82.2;
  const x = (i: number) => 8 + (i * (w - 16)) / (kg.length - 1);
  const y = (v: number) => h - 6 - ((v - lo) / (hi - lo)) * (h - 12);
  return (
    <div className="space-y-2.5">
      <Panel className="p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="tabular text-[22px] font-bold leading-none">
            {n(1650)}
            <span className="text-[14px] font-semibold text-muted-foreground">
              {" "}
              / {n(2400)} kcal
            </span>
          </p>
          <span className="text-[12.5px] font-semibold text-muted-foreground">
            {t.welcome.limitsLeft(n(750))}
          </span>
        </div>
        <Bar pct={(1650 / 2400) * 100} className="mt-2.5 h-2" />
        <div className="mt-3 grid grid-cols-3 gap-3">
          {macros.map((m) => (
            <div key={m.k}>
              <p className="tabular text-[13.5px] font-bold">
                {m.v}
                <span className="font-medium text-muted-foreground"> / {m.g} g</span>
              </p>
              <Bar pct={(m.v / m.g) * 100} className="mt-1" />
              <p className="mt-1 text-[11px] text-muted-foreground">{m.k}</p>
            </div>
          ))}
        </div>
      </Panel>
      <Panel>
        <div className="flex items-baseline justify-between gap-2">
          <Eyebrow>{t.bodyweight.title}</Eyebrow>
          <span className="tabular text-[13px] font-bold">79.6 kg</span>
        </div>
        <svg viewBox={`0 0 ${w} ${h}`} className="mt-1 block h-auto w-full">
          {kg.map((v, i) => (
            <circle
              key={i}
              cx={x(i)}
              cy={y(v)}
              r={3.5}
              fill="var(--muted-foreground)"
              stroke="var(--chart-surface)"
              strokeWidth={2}
            />
          ))}
          <line
            x1={x(4)}
            y1={y(81.05)}
            x2={x(11)}
            y2={y(79.65)}
            stroke="var(--primary)"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </svg>
        <p className="tabular mt-1.5 text-[12.5px]">
          <span className="font-semibold">{t.bodyweight.trend}</span>{" "}
          {t.bodyweight.perWeek(`−${n(0.4)}`, n(0.5))}. {t.bodyweight.target(n(0.6))}
        </p>
        <p className="tabular mt-1 text-[12.5px] font-semibold text-primary-text">
          {t.bodyweight.suggest(n(2180), `−${n(220)}`)}
        </p>
      </Panel>
    </div>
  );
}

function HomeMock() {
  const t = useTranslation();
  const locale = useLocale();
  const n = (v: number) => v.toLocaleString(locale);
  return (
    <div className="space-y-2.5">
      <p className="px-1 text-[22px] font-bold leading-tight">{t.welcome.homeGreeting}</p>
      <div className="glass glow flex items-center justify-between gap-3 rounded-[22px] p-3.5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-primary-text">
            {t.welcome.planWeek(3, 5)}
          </p>
          <p className="truncate text-[17px] font-bold">{t.welcome.homeNext}</p>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-primary px-3.5 py-2 text-[13px] font-bold text-primary-foreground">
          {t.home.continueCta}
          <ChevronRight className="size-4" />
        </span>
      </div>
      <Panel>
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-sky-400/20 text-sky-400">
            <Droplet className="size-3.5" />
          </span>
          <span className="tabular text-[15px] font-bold">1.5L</span>
          <span className="tabular text-[12.5px] text-muted-foreground">/ 2.5L</span>
        </div>
        <Bar pct={60} className="mt-2" />
        <div className="mt-2.5 grid grid-cols-4 gap-1.5">
          {["+250ml", "+500ml", "+750ml", "+1L"].map((q) => (
            <span
              key={q}
              className="rounded-xl bg-primary/15 py-1.5 text-center text-[12px] font-bold"
            >
              {q}
            </span>
          ))}
        </div>
      </Panel>
      <Panel>
        <p className="text-[13px] font-semibold">{t.home.howAreYouFeeling}</p>
        <div className="mt-2 grid grid-cols-5 gap-1.5">
          {([1, 2, 3, 4, 5] as const).map((s) => (
            <span
              key={s}
              className={`flex h-9 items-center justify-center rounded-xl text-[18px] ${
                s === 4 ? "bg-primary/20 ring-2 ring-primary" : "bg-secondary"
              }`}
            >
              {READINESS_EMOJI[s]}
            </span>
          ))}
        </div>
      </Panel>
      <Panel className="flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Flame className="size-4" />
        </span>
        <span className="tabular text-[15px] font-bold">6</span>
        <span className="text-[12.5px] text-muted-foreground">{t.welcome.progressStreak}</span>
        <span className="ml-auto tabular text-[12.5px] text-muted-foreground">{n(1650)} kcal</span>
      </Panel>
    </div>
  );
}

function WatchMock() {
  const t = useTranslation();
  const zones = [
    { z: "Z1", min: 2 },
    { z: "Z2", min: 6 },
    { z: "Z3", min: 11 },
    { z: "Z4", min: 9 },
    { z: "Z5", min: 2 },
  ];
  const stats = [
    { v: "29:41", u: "" },
    { v: "5'42\"", u: "/km" },
    { v: "158", u: "bpm", heart: true },
    { v: "412", u: "kcal" },
  ];
  return (
    <div className="flex items-stretch gap-2.5">
      <div className="flex w-[74px] shrink-0 flex-col items-center justify-center gap-2">
        <div className="relative h-[132px] w-[66px] overflow-hidden rounded-[14px] bg-muted ring-1 ring-border">
          <div className="absolute inset-x-2 top-3 space-y-1.5">
            <div className="h-1.5 w-8 rounded bg-foreground/30" />
            <div className="h-2.5 w-11 rounded bg-foreground/45" />
            <svg viewBox="0 0 50 34" className="mt-2 w-full">
              <path
                d="M4 28 C10 10 20 30 26 14 S40 6 46 20"
                fill="none"
                stroke="oklch(0.72 0.17 30)"
                strokeWidth={3}
              />
            </svg>
            <div className="h-1.5 w-full rounded bg-foreground/20" />
            <div className="h-1.5 w-9 rounded bg-foreground/20" />
            <div className="h-1.5 w-full rounded bg-foreground/20" />
          </div>
        </div>
        <span className="flex items-center gap-1 text-[10.5px] font-semibold text-muted-foreground">
          <ImageIcon className="size-3" />
          {t.welcome.watchScreenshot}
        </span>
      </div>
      <div className="flex items-center text-muted-foreground">
        <ChevronRight className="size-5" />
      </div>
      <Panel className="min-w-0 flex-1 space-y-2.5">
        <div>
          <Eyebrow>Huawei · {t.welcome.watchRun}</Eyebrow>
          <p className="tabular text-[22px] font-bold leading-tight">5.21 km</p>
        </div>
        <svg viewBox="0 0 160 56" className="block h-14 w-full rounded-xl bg-muted/60">
          <path
            d="M14 44 C30 12 50 46 70 26 S104 8 118 22 S140 44 148 14"
            fill="none"
            stroke="var(--primary)"
            strokeWidth={3}
            strokeLinecap="round"
            style={{ filter: "drop-shadow(0 0 3px var(--primary))" }}
          />
        </svg>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
          {stats.map((s) => (
            <p key={s.v} className="tabular flex items-center gap-1 text-[14px] font-bold">
              {s.heart ? <Heart className="size-3.5 text-primary-text" /> : null}
              {s.v}
              <span className="text-[11px] font-medium text-muted-foreground">{s.u}</span>
            </p>
          ))}
        </div>
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground">{t.welcome.watchZones}</p>
          <div className="mt-1 flex h-10 items-end gap-1">
            {zones.map((z) => (
              <div key={z.z} className="flex flex-1 flex-col items-center gap-0.5">
                <div
                  className="w-full rounded-sm bg-primary"
                  style={{ height: `${(z.min / 11) * 28}px`, opacity: 0.45 + z.min / 20 }}
                />
                <span className="text-[9.5px] text-muted-foreground">{z.z}</span>
              </div>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  );
}
