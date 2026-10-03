import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Apple,
  Beer,
  BookmarkPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Droplet,
  Dumbbell,
  Flame,
  Heart,
  Image as ImageIcon,
  Plus,
  ScanBarcode,
  Search,
  Settings2,
  SlidersHorizontal,
  Sun,
  TrendingUp,
  Trophy,
  Wine,
} from "lucide-react";
import { AnatomyPreview } from "./AnatomyMap";
import { CARDIO_ICONS } from "./cardioDisplay";
import { useLocale, useTranslation } from "../../lib/gym/i18n";
import { CAFFEINE_DAILY_LIMIT_MG, COFFEE_CAFFEINE_MG } from "../../lib/gym/nutrition";
import { haptic, useGym } from "../../lib/gym/store";

/**
 * First-launch tour: one swipeable step per part of the app, in the order a
 * new user meets them (Home, Workout, a session, History, a plan, cardio,
 * Nutrition's Food, Drinks and Weight tabs, watch screenshots), each with a
 * small mock-up of that screen filled with example data. Everything shown is
 * made up for illustration, drawn with the app's own tokens so it follows
 * the chosen theme and accent; nothing here reads or writes the user's data
 * except `welcomeSeen` (and `language`, from the switch in the corner).
 *
 * The example numbers follow the app's own rules so the tour doesn't promise
 * something the app won't do:
 * - A 45-min session is 3 × 6–10 on compounds and 3 × 10–14 on accessories
 *   (generator.ts's shapeFor), rests are 2:00, and RPE 8 sits inside the
 *   7–9 target, so the next set keeps its weight (progression.ts).
 * - 80 kg × 10 on every set twice becomes 82.5 kg × 6 (2.5% upper body,
 *   rounded to a 2.5 kg step, reps back to the bottom of the range).
 * - The squat PR's estimate is Epley's (100 × (1 + 6/30) = 120).
 * - Cardio: a 45-min moderate walk (4.8 METs, moderate) counts 45 minutes
 *   and a 30-min hard ride (9.0 METs, vigorous) counts 60, so 105 of 150
 *   (cardio.ts's whoMinutes).
 * - The foods are NEVO 2025/9.0 values (codes 151, 1392, 658, 920) scaled
 *   to the portions shown, so the food step carries the NEVO reference; the
 *   lunch's 59 g protein clears the 0.4 g/kg × 80 kg = 32 g per-meal check.
 * - Coffee: 2 espressos and a filter coffee are 80 + 80 + 90 = 250 mg of the
 *   400 mg limit (COFFEE_CAFFEINE_MG).
 * - Limits: 1,650 kcal eaten is 125 g protein, 170 g carbs and 50 g fat plus
 *   10 g fibre at 2 kcal/g; the bodyweight suggestion is bodyweight.ts's
 *   arithmetic for an 80 kg cut at the moderate 0.75%/week (0.6 kg) with a
 *   0.4 kg/week trend: 0.2 × 7700 / 7 ≈ 220 kcal a day less.
 */
export function WelcomeTour() {
  const { hydrated, welcomeSeen, update, language } = useGym();
  if (!hydrated || welcomeSeen) return null;
  return <Tour language={language} onDone={() => update({ welcomeSeen: true })} />;
}

type ReadyTarget = "/generate" | "/equipment" | "/nutrition" | "/settings";

function Tour({ language, onDone }: { language: "en" | "nl"; onDone: () => void }) {
  const t = useTranslation();
  const { update } = useGym();
  const navigate = useNavigate();
  const scroller = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const w = t.welcome;
  const slides: { key: string; title: string; body: string; mock: ReactNode }[] = [
    { key: "intro", title: w.introTitle, body: w.introBody, mock: <IntroMock /> },
    { key: "home", title: w.homeTitle, body: w.homeBody, mock: <HomeMock /> },
    { key: "workout", title: w.workoutTitle, body: w.workoutBody, mock: <WorkoutMock /> },
    { key: "session", title: w.sessionTitle, body: w.sessionBody, mock: <SessionMock /> },
    { key: "progress", title: w.progressTitle, body: w.progressBody, mock: <ProgressMock /> },
    { key: "plan", title: w.planTitle, body: w.planBody, mock: <PlanMock /> },
    { key: "cardio", title: w.cardioTitle, body: w.cardioBody, mock: <CardioMock /> },
    { key: "food", title: w.foodTitle, body: w.foodBody, mock: <FoodMock /> },
    { key: "drinks", title: w.drinksTitle, body: w.drinksBody, mock: <DrinksMock /> },
    { key: "limits", title: w.limitsTitle, body: w.limitsBody, mock: <LimitsMock /> },
    { key: "watch", title: w.watchTitle, body: w.watchBody, mock: <WatchMock /> },
    { key: "ready", title: w.readyTitle, body: w.readyBody, mock: null },
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

  const finish = (to?: ReadyTarget) => {
    haptic(15);
    if (to) navigate({ to });
    onDone();
  };

  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label={w.dialogLabel}
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
              {w.skip}
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
            aria-label={w.stepOf(i + 1, slides.length)}
            inert={i !== index}
            className="no-scrollbar h-full w-full shrink-0 snap-center snap-always overflow-y-auto"
          >
            <div className="mx-auto flex min-h-full w-full max-w-xl flex-col px-5">
              {s.mock ? (
                <div className="flex flex-1 flex-col justify-center py-2">
                  {i > 0 ? (
                    <p className="mb-1.5 text-center text-[10.5px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                      {w.example}
                    </p>
                  ) : null}
                  {/* A little smaller on shorter phones (an iPhone mini's 812 pt),
                      so every step still fits without scrolling. */}
                  <div
                    inert
                    aria-hidden
                    className="pointer-events-none select-none [@media(max-height:840px)]:[zoom:0.92]"
                  >
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
                      label={w.readyWorkout}
                      primary
                      onClick={() => finish("/generate")}
                    />
                    <ReadyAction
                      icon={<Apple className="size-5" />}
                      label={w.readyFood}
                      onClick={() => finish("/nutrition")}
                    />
                    <ReadyAction
                      icon={<SlidersHorizontal className="size-5" />}
                      label={w.readyEquipment}
                      onClick={() => finish("/equipment")}
                    />
                    <ReadyAction
                      icon={<Trophy className="size-5" />}
                      label={w.readyLifts}
                      onClick={() => finish("/settings")}
                    />
                    <button
                      onClick={() => finish()}
                      className="min-h-[44px] w-full rounded-2xl text-[15px] font-semibold text-muted-foreground"
                    >
                      {w.readyLook}
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
            aria-label={w.back}
            className={`flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground ${index === 0 ? "invisible" : ""}`}
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="flex min-w-0 flex-1 items-center justify-center">
            {slides.map((s, i) => (
              <button
                key={s.key}
                onClick={() => goTo(i)}
                aria-label={w.goTo(i + 1, slides.length)}
                aria-current={i === index ? "step" : undefined}
                className="flex h-8 items-center justify-center px-[2px]"
              >
                <span
                  className={`block h-[5px] rounded-full transition-all duration-300 ${
                    i === index ? "w-3.5 bg-primary" : "w-[5px] bg-foreground/25"
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
              {w.next}
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
      className={`flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-4 text-left text-[16px] font-semibold active:scale-[0.985] ${
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

/** A screen's sub-tabs, drawn like SegmentedTabs. */
function MiniTabs({ labels, active }: { labels: string[]; active: number }) {
  return (
    <div
      className="grid gap-1 rounded-full bg-secondary p-1"
      style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }}
    >
      {labels.map((l, i) => (
        <span
          key={l}
          className={`flex min-h-[28px] items-center justify-center truncate rounded-full px-2 text-[12px] font-semibold ${
            i === active
              ? "bg-background text-foreground shadow-[0_1px_3px_oklch(0_0_0/25%)]"
              : "text-muted-foreground"
          }`}
        >
          {l}
        </span>
      ))}
    </div>
  );
}

/** A solid accent badge, like the app's icon badges. */
function Badge({ children, size = "size-8" }: { children: ReactNode; size?: string }) {
  return (
    <span
      className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground`}
    >
      {children}
    </span>
  );
}

/** A drink card's header: the tinted band, badge, label and total. */
function DrinkHead({
  icon,
  label,
  value,
  trailing,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="card-head flex items-center gap-3 px-3.5 py-2.5">
      <Badge size="size-9">{icon}</Badge>
      <div className="min-w-0 flex-1">
        <Eyebrow>{label}</Eyebrow>
        <p className="tabular mt-0.5 truncate text-[20px] font-bold leading-none">{value}</p>
      </div>
      {trailing}
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
              <Badge size="size-9">
                <Icon className="size-[18px]" />
              </Badge>
              <span className="text-[14.5px] font-semibold leading-snug">{p}</span>
            </div>
          );
        })}
      </Panel>
    </div>
  );
}

function HomeMock() {
  const t = useTranslation();
  const locale = useLocale();
  const n = (v: number) => v.toLocaleString(locale);
  const macros = [
    { k: t.nutrients.protein, v: 125, g: 176 },
    { k: t.nutrients.carbs, v: 170, g: 262 },
    { k: t.nutrients.fat, v: 50, g: 67 },
  ];
  // Monday-first: trained Monday and Wednesday, today is Thursday, Legs on Friday.
  const dow = [1, 2, 3, 4, 5, 6, 0].map((d) => t.common.dow[d]!.charAt(0).toUpperCase());
  const marks: ("done" | "planned" | null)[] = ["done", null, "done", null, "planned", null, null];
  return (
    <div className="space-y-2">
      <p className="px-1 text-[22px] font-bold leading-tight">{t.welcome.homeGreeting}</p>
      <div className="glass glow flex items-center justify-between gap-3 rounded-[22px] p-3.5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-primary-text">
            {t.welcome.planWeek(3, 5)}
          </p>
          <p className="truncate text-[17px] font-bold leading-tight">{t.welcome.homeNext}</p>
          <p className="truncate text-[12px] text-muted-foreground">{t.welcome.homeWhen}</p>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary px-3.5 py-2 text-[13px] font-bold text-primary-foreground">
          {t.home.continueCta}
          <ChevronRight className="size-4" />
        </span>
      </div>
      <Panel>
        <div className="flex items-center gap-2">
          <Badge size="size-7">
            <Flame className="size-3.5" />
          </Badge>
          <span className="tabular text-[15px] font-bold">{n(1650)}</span>
          <span className="tabular text-[12.5px] text-muted-foreground">/ {n(2400)} kcal</span>
        </div>
        <Bar pct={(1650 / 2400) * 100} className="mt-2" />
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {macros.map((m) => (
            <div key={m.k} className="rounded-xl bg-muted/60 px-2 py-1.5">
              <p className="tabular text-[13px] font-bold leading-tight">
                {m.v}
                <span className="font-medium text-muted-foreground"> / {m.g} g</span>
              </p>
              <p className="truncate text-[10.5px] text-muted-foreground">{m.k}</p>
            </div>
          ))}
        </div>
      </Panel>
      <Panel>
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-sky-400/20 text-sky-400">
            <Droplet className="size-3.5" />
          </span>
          <span className="tabular text-[15px] font-bold">1.5L</span>
          <span className="tabular text-[12.5px] text-muted-foreground">/ 2.6L</span>
        </div>
        <Bar pct={58} className="mt-2" />
        <div className="mt-2 grid grid-cols-4 gap-1.5">
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
      <Panel className="flex items-center gap-2.5 py-2.5">
        <Badge size="size-7">
          <Flame className="size-3.5" />
        </Badge>
        <span className="tabular text-[15px] font-bold">6</span>
        <span className="min-w-0 truncate text-[12px] text-muted-foreground">
          {t.home.weekStreak(6)}
        </span>
        <span className="h-6 w-px shrink-0 bg-border" />
        <Badge size="size-7">
          <Dumbbell className="size-3.5" />
        </Badge>
        <span className="tabular text-[15px] font-bold">2</span>
        <span className="min-w-0 truncate text-[12px] text-muted-foreground">
          {t.home.trainingDays(2)}
        </span>
      </Panel>
      <div className="grid grid-cols-7 gap-1 px-1">
        {dow.map((d, i) => (
          <div
            key={i}
            className={`flex flex-col items-center gap-1 rounded-xl py-1 ${i === 3 ? "bg-foreground/[0.06]" : ""}`}
          >
            <span className="text-[10px] font-bold text-muted-foreground">{d}</span>
            {marks[i] === "done" ? (
              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-3" strokeWidth={3} />
              </span>
            ) : marks[i] === "planned" ? (
              <span className="size-5 rounded-full border-2 border-primary" />
            ) : (
              <span className="flex size-5 items-center justify-center">
                <span className="size-1.5 rounded-full bg-foreground/25" />
              </span>
            )}
          </div>
        ))}
      </div>
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
    <div className="space-y-2">
      <MiniTabs labels={[t.generate.tabs.plan, t.generate.tabs.build]} active={1} />
      <div className="flex items-center gap-3">
        <div className="w-[118px] shrink-0">
          <AnatomyPreview selected={["chest", "triceps"]} labels={false} />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-[12px] font-semibold text-muted-foreground">
            {t.generate.sessionLength}
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {[30, 45, 60].map((m) => (
              <span
                key={m}
                className={`tabular flex min-h-[34px] items-center justify-center rounded-xl text-[13px] font-bold ${
                  m === 45 ? "bg-primary text-primary-foreground" : "bg-secondary"
                }`}
              >
                {m}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {["Chest", "Triceps"].map((m) => (
              <span
                key={m}
                className="rounded-full bg-primary/15 px-2.5 py-1 text-[11.5px] font-semibold"
              >
                {m}
              </span>
            ))}
          </div>
        </div>
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
  return (
    <div className="space-y-2">
      <Panel className="p-3.5">
        <p className="text-[18px] font-bold leading-tight">Barbell Bench Press</p>
        <p className="tabular text-[12px] text-muted-foreground">3 × 6–10 · 2:00</p>
        <div className="mt-2.5 space-y-1">
          {[1, 2].map((n) => (
            <div
              key={n}
              className="tabular flex items-center gap-3 rounded-xl bg-muted/60 px-3 py-1.5 text-[13.5px]"
            >
              <span className="w-4 text-center font-bold text-muted-foreground">{n}</span>
              <span className="flex-1 font-semibold">80 kg × 10</span>
              <span className="text-[12px] text-muted-foreground">@8</span>
              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-3" strokeWidth={3.5} />
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <span className="text-[12px] font-semibold text-muted-foreground">{t.session.rpe}</span>
          <div className="grid flex-1 grid-cols-5 gap-1">
            {[6, 7, 8, 9, 10].map((r) => (
              <span
                key={r}
                className={`tabular flex h-8 items-center justify-center rounded-lg text-[13px] font-bold ${
                  r === 8 ? "bg-primary text-primary-foreground" : "bg-secondary"
                }`}
              >
                {r}
              </span>
            ))}
          </div>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">{t.session.rpeTarget(7, 9)}</p>
        <div className="mt-2.5 flex min-h-[44px] items-center justify-center rounded-xl bg-primary px-2 text-[14.5px] font-bold text-primary-foreground">
          <span className="truncate">{t.session.logSetWith("80 kg", 10, 8)}</span>
        </div>
      </Panel>
      <div className="glass-strong rounded-2xl p-3">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 leading-none">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
              {t.session.restLabel}
            </p>
            <p className="tabular mt-1 text-[24px] font-bold">1:42</p>
          </div>
          <span className="rounded-full bg-secondary px-3 py-2 text-[12.5px] font-bold">+30 s</span>
          <span className="rounded-full bg-primary px-3 py-2 text-[12.5px] font-bold text-primary-foreground">
            {t.session.skipRest}
          </span>
        </div>
        <Bar pct={15} className="mt-2.5" />
        <p className="mt-2 truncate text-[12.5px]">
          <span className="font-semibold text-muted-foreground">{t.session.restNextLabel}</span>{" "}
          {t.welcome.sessionNextSet}
        </p>
      </div>
    </div>
  );
}

/** Est. 1RM over eight sessions of the example bench (Epley, rising to
 *  80 kg × 10 ≈ 107). */
const E1RM = [96, 97, 99, 99, 101, 103, 104, 107];

function ProgressMock() {
  const t = useTranslation();
  const w = 300;
  const h = 72;
  const min = 94;
  const max = 108;
  const pts = E1RM.map((v, i) => [
    8 + (i * (w - 16)) / (E1RM.length - 1),
    h - 8 - ((v - min) / (max - min)) * (h - 16),
  ]);
  const tabs = t.history.tabs;
  return (
    <div className="space-y-2">
      <MiniTabs labels={[tabs.sessions, tabs.progress, tabs.activity]} active={1} />
      <Panel className="flex items-center gap-3">
        <Badge size="size-9">
          <TrendingUp className="size-[18px]" />
        </Badge>
        <div className="min-w-0">
          <p className="tabular text-[14.5px] font-bold">
            {t.welcome.progressNextTime}: 82.5 kg × 6
          </p>
          <p className="text-[12.5px] text-muted-foreground">{t.welcome.progressWhy}</p>
        </div>
      </Panel>
      <div className="grid grid-cols-2 gap-2">
        <Panel>
          <div className="flex items-center gap-2">
            <Badge>
              <Flame className="size-4" />
            </Badge>
            <span className="tabular text-[24px] font-bold leading-none">6</span>
          </div>
          <p className="mt-1.5 text-[12.5px] font-semibold">{t.home.weekStreak(6)}</p>
          <p className="text-[11.5px] text-muted-foreground">{t.welcome.progressStreakSub}</p>
        </Panel>
        <Panel>
          <div className="flex items-center gap-2">
            <Badge>
              <Trophy className="size-4" />
            </Badge>
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
          <span className="tabular shrink-0 text-[13px] font-bold text-primary-text">
            107 kg{" "}
            <span className="text-[11px] font-medium text-muted-foreground">
              {t.welcome.progressE1rm}
            </span>
          </span>
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
    <div className="space-y-2">
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
                <span className="size-7 rounded-full border-2 border-dashed border-warning" />
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
        <div className="mt-3.5 flex items-end gap-1.5">
          {[1, 2, 3, 4, 5].map((w) => (
            <div key={w} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`w-full rounded-md ${
                  w === 5 ? "h-4 bg-primary/35" : w <= 3 ? "h-7 bg-primary" : "h-7 bg-primary/35"
                }`}
              />
              <span className="text-[10.5px] font-semibold text-muted-foreground">
                {w === 5 ? t.welcome.planDeload : `W${w}`}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3.5 flex min-h-[42px] items-center justify-center rounded-xl bg-primary text-[14px] font-bold text-primary-foreground">
          {t.generate.startDayType("Pull")}
        </div>
      </Panel>
      <Panel className="border-warning/40 p-3.5">
        <p className="text-[14px] font-bold">{t.schedule.missedTitle("Pull", wednesday)}</p>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">{t.schedule.missedDesc}</p>
        <div className="mt-2.5 flex gap-2">
          <span className="flex min-h-[36px] flex-1 items-center justify-center rounded-xl bg-primary text-[13.5px] font-bold text-primary-foreground">
            {t.schedule.doItToday}
          </span>
          <span className="flex min-h-[36px] flex-1 items-center justify-center rounded-xl bg-secondary text-[13.5px] font-semibold">
            {t.schedule.skip}
          </span>
        </div>
      </Panel>
    </div>
  );
}

function CardioMock() {
  const t = useTranslation();
  const c = t.cardio;
  const Walk = CARDIO_ICONS.walk;
  const Ride = CARDIO_ICONS.cycle;
  const Run = CARDIO_ICONS.run;
  // Monday-first: a walk on Tuesday and a ride on Thursday done, a run
  // planned for Saturday; today is Friday.
  const dow = [1, 2, 3, 4, 5, 6, 0].map((d) => t.common.dow[d]!.charAt(0).toUpperCase());
  const days: ({ Icon: typeof Walk; done: boolean } | null)[] = [
    null,
    { Icon: Walk, done: true },
    null,
    { Icon: Ride, done: true },
    null,
    { Icon: Run, done: false },
    null,
  ];
  const logged = [
    { Icon: Walk, name: c.activities.walk, min: 45, effort: c.efforts.moderate },
    { Icon: Ride, name: c.activities.cycle, min: 30, effort: c.efforts.hard },
  ];
  return (
    <div className="space-y-2">
      <Panel className="p-4">
        <p className="text-[12px] font-semibold uppercase tracking-widest text-primary-text">
          {c.thisWeek}
        </p>
        <p className="tabular mt-0.5 text-[18px] font-bold">{c.progress(105, 150)}</p>
        <Bar pct={70} className="mt-2" />
        <p className="mt-1.5 text-[11.5px] leading-snug text-muted-foreground">{c.explain}</p>
        <div className="mt-3 grid grid-cols-7">
          {days.map((d, i) => (
            <span
              key={i}
              className={`flex flex-col items-center gap-1 rounded-xl py-1 ${i === 4 ? "bg-foreground/[0.06]" : ""}`}
            >
              <span className="text-[10px] font-bold text-muted-foreground">{dow[i]}</span>
              <span className="flex size-6 items-center justify-center">
                {d?.done ? (
                  <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <d.Icon className="size-3.5" />
                  </span>
                ) : d ? (
                  <span className="flex size-6 items-center justify-center rounded-full border-2 border-primary text-primary-text">
                    <d.Icon className="size-3" />
                  </span>
                ) : (
                  <span className="size-1.5 rounded-full bg-muted-foreground/30" />
                )}
              </span>
            </span>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <span className="flex min-h-[38px] items-center justify-center rounded-xl bg-primary text-[13.5px] font-bold text-primary-foreground">
            {c.log}
          </span>
          <span className="flex min-h-[38px] items-center justify-center rounded-xl bg-secondary text-[13.5px] font-semibold">
            {c.plan}
          </span>
        </div>
      </Panel>
      <Panel className="p-0">
        {logged.map((l, i) => (
          <div
            key={l.name}
            className={`flex items-center gap-3 px-3.5 py-2 ${i > 0 ? "border-t border-border" : ""}`}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary-text">
              <l.Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">
              {c.session(l.name, l.min)}
            </span>
            <span className="text-[12px] text-muted-foreground">{l.effort}</span>
          </div>
        ))}
      </Panel>
    </div>
  );
}

// NEVO 2025/9.0 values per 100 g (codes 151, 1392, 658, 920), scaled to the
// portions shown, as the app would log them.
function FoodMock() {
  const t = useTranslation();
  const f = t.welcome.foods;
  const lunch = [
    { name: f.chicken, grams: 150, kcal: 237, p: 46, c: 0, fat: 6 },
    { name: f.rice, grams: 200, kcal: 292, p: 6, c: 64, fat: 1 },
    { name: f.broccoli, grams: 150, kcal: 41, p: 6, c: 1, fat: 0 },
  ];
  return (
    <div className="space-y-2">
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
            className={`flex items-center gap-3 px-3.5 py-2 ${i > 0 ? "border-t border-border" : ""}`}
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
      <div className="glass overflow-hidden rounded-2xl">
        <div className="card-head flex items-center gap-3 px-3.5 py-2.5">
          <Badge size="size-9">
            <Sun className="size-[18px]" />
          </Badge>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-[16px] font-bold leading-tight">
              {t.mealTypes.lunch}
              <ChevronRight className="size-4 text-muted-foreground" />
            </p>
            <p className="tabular flex items-center gap-1.5 text-[12px] text-muted-foreground">
              570 kcal · P 59
              <span className="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-2.5" strokeWidth={3.5} />
              </span>
            </p>
          </div>
          <span className="flex size-8 items-center justify-center rounded-full bg-secondary">
            <BookmarkPlus className="size-4" />
          </span>
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/25">
            <Plus className="size-4" />
          </span>
        </div>
        {lunch.map((r) => (
          <div key={r.name} className="flex items-center gap-3 border-t border-border px-3.5 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold">{r.name}</p>
              <p className="tabular mt-0.5 flex items-center gap-1.5 text-[11.5px]">
                <span className="rounded-md bg-foreground/10 px-1.5 font-semibold">
                  {r.grams} g
                </span>
                <span className="truncate text-muted-foreground">
                  {t.nutrition.entryMacros(r.p, r.c, r.fat)}
                </span>
              </p>
            </div>
            <span className="tabular text-[13px] font-semibold">{r.kcal} kcal</span>
          </div>
        ))}
      </div>
      <p className="px-1 text-[10px] leading-snug text-muted-foreground">
        {t.nutrition.nevoReference}
      </p>
    </div>
  );
}

function DrinksMock() {
  const t = useTranslation();
  const kinds = ["espresso", "filter", "milk"] as const;
  const mg = COFFEE_CAFFEINE_MG.espresso * 2 + COFFEE_CAFFEINE_MG.filter;
  return (
    <div className="space-y-2">
      <MiniTabs
        labels={[t.nutrition.tabs.food, t.nutrition.tabs.drinks, t.nutrition.tabs.weight]}
        active={1}
      />
      <div className="glass overflow-hidden rounded-2xl">
        <DrinkHead
          icon={<Droplet className="size-[18px]" />}
          label={t.nutrition.water}
          value={
            <>
              1.5L<span className="text-[13px] font-medium text-muted-foreground"> / 2.6L</span>
            </>
          }
          trailing={
            <span className="flex size-8 items-center justify-center rounded-full bg-secondary">
              <Settings2 className="size-4" />
            </span>
          }
        />
        <div className="p-3.5">
          <Bar pct={58} className="h-2" />
          <div className="mt-3 grid grid-cols-5 gap-1.5">
            {["+250ml", "+500ml", "+750ml", "+1L", "+ ml"].map((q, i) => (
              <span
                key={q}
                className={`flex h-10 items-center justify-center rounded-lg text-[12px] font-bold tracking-tight ${
                  i === 4
                    ? "border-[1.5px] border-dashed border-foreground/25 text-muted-foreground"
                    : "border-[1.5px] border-primary/60"
                }`}
              >
                {q}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="glass overflow-hidden rounded-2xl">
        <DrinkHead
          icon={<Coffee className="size-[18px]" />}
          label={t.coffee.title}
          value={t.coffee.cups(3)}
          trailing={
            <span className="tabular shrink-0 text-[12.5px] text-muted-foreground">
              {t.coffee.caffeineShort(mg, CAFFEINE_DAILY_LIMIT_MG)}
            </span>
          }
        />
        <div className="p-3.5">
          <Bar pct={(mg / CAFFEINE_DAILY_LIMIT_MG) * 100} className="h-2" />
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {kinds.map((k) => (
              <span
                key={k}
                className="flex h-12 flex-col items-center justify-center rounded-lg border-[1.5px] border-primary/60"
              >
                <span className="w-full truncate px-1 text-center text-[12px] font-bold leading-tight">
                  + {t.coffee.kinds[k]}
                </span>
                <span className="tabular text-[11px] leading-tight text-muted-foreground">
                  {COFFEE_CAFFEINE_MG[k]} mg
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
      <Panel className="flex items-center gap-2.5 py-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Beer className="size-4" />
        </span>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Wine className="size-4" />
        </span>
        <span className="min-w-0 flex-1 text-[13px] font-semibold">{t.welcome.drinksWeekend}</span>
      </Panel>
    </div>
  );
}

function LimitsMock() {
  const t = useTranslation();
  const locale = useLocale();
  const n = (v: number) => v.toLocaleString(locale);
  const macros = [
    { k: t.nutrients.protein, v: 125, g: 176 },
    { k: t.nutrients.carbs, v: 170, g: 262 },
    { k: t.nutrients.fat, v: 50, g: 67 },
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
    <div className="space-y-2">
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
