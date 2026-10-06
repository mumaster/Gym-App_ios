import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Dumbbell,
  Heart,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  ShieldOff,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "../components/gym/BottomSheet";
import { ExerciseDetailSheet } from "../components/gym/ExerciseDetailSheet";
import { ListCard } from "../components/gym/ListCard";
import { Screen } from "../components/gym/Screen";
import { SegmentedTabs } from "../components/gym/SegmentedTabs";
import {
  EQUIPMENT,
  MUSCLES,
  TARGET_MUSCLES,
  TARGET_MUSCLE_GROUP,
  targetsForGroup,
} from "../lib/gym/data";
import {
  csvToExercises,
  deleteExercise,
  exercisesToCsv,
  saveExercise,
  saveExercises,
  SEED_EXERCISES,
  slugifyId,
  useExerciseCatalog,
} from "../lib/gym/catalog";
import { popularityOf } from "../lib/gym/exercisePopularity";
import { useTranslation } from "../lib/gym/i18n";
import { haptic, useGym } from "../lib/gym/store";
import { useTapFocus } from "../lib/gym/tapFocus";
import type {
  EquipmentId,
  Exercise,
  MovementPattern,
  Muscle,
  TargetMuscle,
} from "../lib/gym/types";
import { badge, chip, text } from "../components/gym/ui";

/** localStorage key for the muscle groups left open on Exercises. */
const OPEN_GROUPS_KEY = "forge.exercises.open.v1";

const PATTERNS: MovementPattern[] = ["push", "pull", "hinge", "squat", "carry", "core"];

const emptyExercise = (): Exercise => ({
  id: "",
  name: "",
  primary_muscle: "Chest",
  secondary_muscles: [],
  muscle_targets: [],
  equipment_required: [],
  movement_pattern: "push",
  compound: false,
  instructions: "",
  cues: [],
});

/** Exercises' sub-tabs, like History's and Nutrition's: the whole
 *  library, what your equipment profile allows, and your loved ones (they
 *  were two toggle buttons above the list). */
const EXERCISE_TABS = ["all", "gym", "loved"] as const;
type ExerciseTab = (typeof EXERCISE_TABS)[number];

export const Route = createFileRoute("/exercises")({
  validateSearch: (search: Record<string, unknown>): { tab?: ExerciseTab } =>
    EXERCISE_TABS.includes(search["tab"] as ExerciseTab) && search["tab"] !== "all"
      ? { tab: search["tab"] as ExerciseTab }
      : {},
  head: () => ({
    meta: [
      { title: "Exercise Library — Forge" },
      {
        name: "description",
        content:
          "Editable database of gym exercises with primary and secondary muscles, equipment, movement patterns, instructions and coaching cues.",
      },
      { property: "og:title", content: "Exercise Library — Forge" },
      {
        property: "og:description",
        content: "Browse, edit and import your own exercise database with CSV support.",
      },
    ],
  }),
  component: ExercisesScreen,
});

function ExercisesScreen() {
  const t = useTranslation();
  const {
    profiles,
    activeProfileId,
    lovedExerciseIds,
    toggleLovedExercise,
    avoidedExerciseIds,
    update,
  } = useGym();
  const [moreOpen, setMoreOpen] = useState(false);
  const exercises = useExerciseCatalog();
  const profile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0]!;
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<Muscle | "All">("All");
  const [target, setTarget] = useState<TargetMuscle | "All">("All");
  const { tab = "all" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const setTab = (next: ExerciseTab) => {
    void navigate({ search: next === "all" ? {} : { tab: next }, replace: true });
    window.scrollTo({ top: 0 });
  };
  const onlyAvailable = tab === "gym";
  const onlyLoved = tab === "loved";
  const [detail, setDetail] = useState<Exercise | null>(null);
  const [draft, setDraft] = useState<{ value: Exercise; isNew: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchTap = useTapFocus();
  const searching = searchFocused || query.length > 0;

  // While searching, the list starts right under the pinned search field,
  // so results sit above the keyboard; the filters stay a scroll up. The
  // list's min-height (below) keeps that position reachable however few
  // results there are, so typing never makes the page jump.
  const scrollListUnderSearch = (smooth = false) => {
    const list = listRef.current;
    const header = document.querySelector("header");
    if (!list || !header) return;
    const top = list.getBoundingClientRect().top + window.scrollY - header.offsetHeight - 12;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({
      top: Math.max(0, top),
      behavior: smooth && !reduceMotion ? "smooth" : "instant",
    });
  };
  useLayoutEffect(() => {
    if (query) scrollListUnderSearch();
  }, [query]);

  const results = useMemo(
    () =>
      exercises
        .filter((e) => {
          if (muscle !== "All" && e.primary_muscle !== muscle) return false;
          if (target !== "All" && !e.muscle_targets.includes(target)) return false;
          if (query && !e.name.toLowerCase().includes(query.toLowerCase())) return false;
          if (onlyLoved && !lovedExerciseIds.includes(e.id)) return false;
          if (
            onlyAvailable &&
            !e.equipment_required.every((r) => profile.active_equipment_ids.includes(r))
          )
            return false;
          return true;
        })
        // Most popular first (exercisePopularity.ts); your own after.
        .sort((a, b) => popularityOf(b.id) - popularityOf(a.id)),
    [exercises, query, muscle, target, onlyAvailable, onlyLoved, lovedExerciseIds, profile],
  );

  /** The results by primary muscle group, in the muscle chips' order. */
  const groups = useMemo(
    () =>
      [
        ...MUSCLES.map((group): { group: string; list: Exercise[] } => ({
          group,
          list: results.filter((e) => e.primary_muscle === group),
        })),
        // Your own exercises come from the database or a CSV, so one with an
        // unexpected muscle still shows rather than dropping out.
        {
          group: t.exercises.otherGroup,
          list: results.filter((e) => !MUSCLES.includes(e.primary_muscle)),
        },
      ].filter((g) => g.list.length > 0),
    [results, t],
  );

  /** The muscle groups folded open, remembered on this device (a per-viewer
   *  convenience, so localStorage rather than GymState). Folded by default:
   *  the full list of 256 was too much (asked for). While searching, with a
   *  muscle chip picked or on Loved, every group shows open and there's no
   *  folding, so results are never hidden behind a closed group. */
  // Read after mount, not in the initializer: the server renders folded,
  // and a different first render here would be a hydration mismatch.
  const [openGroups, setOpenGroupsState] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(OPEN_GROUPS_KEY) ?? "[]") as unknown;
      if (Array.isArray(raw)) {
        setOpenGroupsState(raw.filter((g): g is string => typeof g === "string"));
      }
    } catch {
      // Unreadable or blocked storage: start folded.
    }
  }, []);
  const setOpenGroups = (next: string[] | ((cur: string[]) => string[])) =>
    setOpenGroupsState((cur) => {
      const value = typeof next === "function" ? next(cur) : next;
      try {
        localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(value));
      } catch {
        // Private mode or blocked storage: it just isn't remembered.
      }
      return value;
    });
  const foldable = !query && muscle === "All" && !onlyLoved;
  const allOpen = groups.every((g) => openGroups.includes(g.group));

  // specific-muscle chips: narrowed to the picked group, else the full list
  const targetChoices = muscle === "All" ? TARGET_MUSCLES : targetsForGroup(muscle);

  const exportCsv = () => {
    const blob = new Blob([exercisesToCsv(exercises)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `forge-exercises-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t.exercises.exportedCount(exercises.length));
  };

  const importCsv = async (file: File) => {
    const { list, errors } = csvToExercises(await file.text());
    if (!list.length) {
      toast.error(errors[0] ?? t.exercises.nothingToImport);
      return;
    }
    const { error } = await saveExercises(list);
    if (error) toast.error(error);
    else toast.success(t.exercises.importedCount(list.length, errors.length));
  };

  return (
    <Screen
      title={t.exercises.title}
      action={
        <button
          onClick={() => setMoreOpen(true)}
          aria-label={t.exercises.more}
          className="glass tap-target flex size-10 items-center justify-center rounded-full"
        >
          <MoreHorizontal className="size-5" />
        </button>
      }
      toolbar={
        <div className="space-y-2">
          <SegmentedTabs
            tabs={EXERCISE_TABS}
            value={tab}
            onChange={setTab}
            labels={t.exercises.tabs}
          />
          <div className="glass flex h-12 items-center gap-2 rounded-2xl px-3">
            <Search className="size-5 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              {...searchTap}
              onFocus={() => {
                setSearchFocused(true);
                scrollListUnderSearch(true);
              }}
              onBlur={() => setSearchFocused(false)}
              placeholder={t.exercises.search}
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="h-full w-full bg-transparent text-[17px] outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={t.addFood.clearSearch}
                className="tap-target flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground active:scale-90"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        </div>
      }
    >
      <div className="no-scrollbar -my-1 flex gap-2 overflow-x-auto py-1">
        {(["All", ...MUSCLES] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMuscle(m);
              setTarget((t) =>
                t === "All" || (m !== "All" && TARGET_MUSCLE_GROUP[t] !== m) ? "All" : t,
              );
            }}
            className={`tap-target min-h-[40px] shrink-0 rounded-full px-4 text-[14px] font-semibold ${
              muscle === m ? chip.on : "glass text-secondary-foreground"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* The specific muscles only once a group is picked: two rows of
          chips over the list read as clutter next to the other tabs. */}
      {muscle !== "All" ? (
        <div className="no-scrollbar mt-1 flex gap-2 overflow-x-auto py-1">
          {(["All", ...targetChoices] as const).map((choice) => (
            <button
              key={choice}
              onClick={() => setTarget(choice)}
              className={`tap-target min-h-[36px] shrink-0 rounded-full px-3 text-[13px] font-semibold ${
                target === choice ? chip.on : "glass text-secondary-foreground"
              }`}
            >
              {choice === "All" ? t.exercises.anyMuscle : choice}
            </button>
          ))}
        </div>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void importCsv(f);
        }}
      />

      <div ref={listRef} className={`mt-4 space-y-4 ${searching ? "min-h-[100dvh]" : ""}`}>
        {/* My gym's own equipment, changeable right here (asked for: it was
            only reachable through Settings): switch profile with the chips,
            or open its gear with Edit, whose back button returns here. */}
        {onlyAvailable ? (
          <section className="glass overflow-hidden rounded-2xl">
            <div className="flex items-center gap-3 py-2.5 pl-4 pr-3">
              <span aria-hidden className={`${badge.tonal} size-9`}>
                <Dumbbell className="size-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                {/* With several gyms the chips below name the picked one, so
                    the title doesn't repeat it (cut off: "Full Commer…"). */}
                <span className="block truncate text-[15px] font-semibold">
                  {profiles.length > 1 ? t.equipment.title : profile.name}
                </span>
                <span className="block truncate text-[12.5px] text-muted-foreground">
                  {t.generate.equipmentSummary(profile.active_equipment_ids.length)}
                </span>
              </span>
              <Link
                to="/equipment"
                search={{ from: "exercises" }}
                aria-label={t.exercises.editGym(profile.name)}
                className="tap-target flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full bg-secondary px-3.5 text-[13.5px] font-semibold text-secondary-foreground active:scale-95"
              >
                <Settings2 className="size-4" />
                {t.generate.editEquipment}
              </Link>
            </div>
            {profiles.length > 1 ? (
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-t border-border px-4 py-2.5">
                {profiles.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      haptic(12);
                      update({ activeProfileId: p.id });
                    }}
                    aria-pressed={p.id === profile.id}
                    className={`tap-target min-h-[36px] shrink-0 rounded-full px-3.5 text-[13.5px] font-semibold ${
                      p.id === profile.id ? chip.on : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
        <div className="flex items-center justify-between gap-2 px-1">
          <p className={text.meta}>{t.exercises.count(results.length, exercises.length)}</p>
          {foldable && groups.length > 1 ? (
            <button
              onClick={() => setOpenGroups(allOpen ? [] : groups.map((g) => g.group))}
              className="tap-target shrink-0 rounded-full px-2 py-1 text-[13px] font-semibold text-primary-text"
            >
              {allOpen ? t.exercises.foldAll : t.exercises.unfoldAll}
            </button>
          ) : null}
        </div>
        {onlyLoved && !lovedExerciseIds.length ? (
          <p className={`px-1 ${text.note}`}>{t.exercises.lovedEmpty}</p>
        ) : null}
        {/* One card per muscle group, like a meal's card on the Food tab:
            the list used to be a separate card per exercise. Most popular
            first within each group (exercisePopularity.ts). */}
        {groups.map(({ group, list }) => (
          <ListCard
            key={group}
            icon={Dumbbell}
            title={group}
            subtitle={t.exercises.inGroup(list.length)}
            filled
            fold={
              foldable
                ? {
                    open: openGroups.includes(group),
                    onToggle: () =>
                      setOpenGroups((cur) =>
                        cur.includes(group) ? cur.filter((g) => g !== group) : [...cur, group],
                      ),
                  }
                : undefined
            }
          >
            {list.map((e) => {
              const loved = lovedExerciseIds.includes(e.id);
              const avoided = avoidedExerciseIds.includes(e.id);
              return (
                // Only the heart stays on the row: with avoid and edit next
                // to it too, names were cut off ("Barbell Bench Pr…"). Both
                // live in the detail sheet the row opens.
                <div
                  key={e.id}
                  className="flex items-center gap-2 border-t border-border py-1 pl-4 pr-2"
                >
                  <button
                    className="min-w-0 flex-1 py-2 text-left active:opacity-70"
                    onClick={() => setDetail(e)}
                    aria-label={t.exercises.open(e.name)}
                  >
                    <p className="text-[15px] font-semibold leading-snug">
                      {e.name}
                      {avoided ? (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 align-middle text-[11px] font-semibold text-destructive-text">
                          <ShieldOff className="size-3" />
                          {t.exercises.avoided}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
                      {(e.muscle_targets.length ? e.muscle_targets : [e.primary_muscle]).join(
                        " · ",
                      )}
                    </p>
                    <p data-cut-ok className="mt-0.5 truncate text-[12px] text-muted-foreground">
                      {e.movement_pattern} ·{" "}
                      {e.equipment_required
                        .map((id) => EQUIPMENT.find((q) => q.id === id)?.label ?? id)
                        .join(", ") || t.exercises.noEquipment}
                    </p>
                  </button>
                  <button
                    aria-label={loved ? t.exercises.unlove(e.name) : t.exercises.love(e.name)}
                    aria-pressed={loved}
                    onClick={() => {
                      haptic(12);
                      toggleLovedExercise(e.id);
                    }}
                    className={`tap-target flex size-10 shrink-0 items-center justify-center rounded-full ${
                      loved ? "bg-primary/10 text-primary-text" : "text-secondary-foreground"
                    }`}
                  >
                    <Heart className={`size-4 ${loved ? "fill-current" : ""}`} />
                  </button>
                </div>
              );
            })}
          </ListCard>
        ))}
      </div>

      <ExerciseDetailSheet
        exercise={detail}
        onClose={() => setDetail(null)}
        onEdit={(e) => {
          // One sheet at a time: close the details, open the editor.
          setDetail(null);
          setDraft({ value: { ...e }, isNew: false });
        }}
      />

      <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)} title={t.exercises.moreTitle}>
        <div className="space-y-2">
          {[
            {
              icon: Plus,
              label: t.exercises.newExercise,
              run: () => setDraft({ value: emptyExercise(), isNew: true }),
            },
            { icon: Upload, label: t.exercises.importCsv, run: () => fileRef.current?.click() },
            { icon: Download, label: t.exercises.exportCsv, run: exportCsv },
          ].map(({ icon: Icon, label, run }) => (
            <button
              key={label}
              onClick={() => {
                setMoreOpen(false);
                run();
              }}
              className="glass flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-4 text-left text-[15px] font-semibold active:scale-[0.985]"
            >
              <Icon className="size-5 text-primary-text" />
              {label}
            </button>
          ))}
        </div>
      </BottomSheet>

      <ExerciseEditor
        draft={draft}
        onClose={() => setDraft(null)}
        onChange={(value) => setDraft((d) => (d ? { ...d, value } : d))}
      />
    </Screen>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tap-target min-h-[36px] rounded-full px-3 text-[13px] font-semibold ${
        active ? chip.on : "glass text-secondary-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function ExerciseEditor({
  draft,
  onClose,
  onChange,
}: {
  draft: { value: Exercise; isNew: boolean } | null;
  onClose: () => void;
  onChange: (value: Exercise) => void;
}) {
  const t = useTranslation();
  const [busy, setBusy] = useState(false);
  const value = draft?.value;

  const toggle = <T,>(list: T[], item: T) =>
    list.includes(item) ? list.filter((i) => i !== item) : [...list, item];

  const save = async () => {
    if (!value) return;
    if (!value.name.trim()) {
      toast.error(t.exercises.giveExerciseName);
      return;
    }
    setBusy(true);
    const { error } = await saveExercise({
      ...value,
      name: value.name.trim(),
      id: value.id || slugifyId(value.name),
    });
    setBusy(false);
    if (error) toast.error(error);
    else {
      toast.success(t.exercises.saved);
      onClose();
    }
  };

  const remove = async () => {
    if (!value) return;
    setBusy(true);
    const { error } = await deleteExercise(value.id);
    setBusy(false);
    if (error) toast.error(error);
    else {
      toast.success(t.exercises.deleted);
      onClose();
    }
  };

  return (
    <BottomSheet
      open={!!draft}
      onClose={onClose}
      title={draft?.isNew ? t.exercises.newExercise : t.exercises.editExercise}
    >
      {value ? (
        <div className="space-y-4 pb-2">
          <Field label={t.exercises.nameField}>
            <input
              value={value.name}
              onChange={(e) => onChange({ ...value, name: e.target.value })}
              placeholder={t.exercises.namePlaceholder}
              className="glass h-12 w-full rounded-2xl px-3 text-[17px] outline-none"
            />
          </Field>

          <Field label={t.exercises.primaryMuscle}>
            <div className="flex flex-wrap gap-2">
              {MUSCLES.map((m) => (
                <Chip
                  key={m}
                  label={m}
                  active={value.primary_muscle === m}
                  onClick={() => onChange({ ...value, primary_muscle: m })}
                />
              ))}
            </div>
          </Field>

          <Field label={t.exercises.secondaryMuscles}>
            <div className="flex flex-wrap gap-2">
              {MUSCLES.map((m) => (
                <Chip
                  key={m}
                  label={m}
                  active={value.secondary_muscles.includes(m)}
                  onClick={() =>
                    onChange({ ...value, secondary_muscles: toggle(value.secondary_muscles, m) })
                  }
                />
              ))}
            </div>
          </Field>

          <Field label={t.exercises.specificTargets}>
            <div className="flex flex-wrap gap-2">
              {TARGET_MUSCLES.map((tm) => {
                const pos = value.muscle_targets.indexOf(tm);
                return (
                  <Chip
                    key={tm}
                    label={pos === 0 ? `★ ${tm}` : tm}
                    active={pos !== -1}
                    onClick={() =>
                      onChange({ ...value, muscle_targets: toggle(value.muscle_targets, tm) })
                    }
                  />
                );
              })}
            </div>
          </Field>

          <Field label={t.exercises.equipmentRequired}>
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT.map((eq) => (
                <Chip
                  key={eq.id}
                  label={eq.label}
                  active={value.equipment_required.includes(eq.id)}
                  onClick={() =>
                    onChange({
                      ...value,
                      equipment_required: toggle<EquipmentId>(value.equipment_required, eq.id),
                    })
                  }
                />
              ))}
            </div>
          </Field>

          <Field label={t.exercises.movementPattern}>
            <div className="flex flex-wrap gap-2">
              {PATTERNS.map((p) => (
                <Chip
                  key={p}
                  label={p}
                  active={value.movement_pattern === p}
                  onClick={() => onChange({ ...value, movement_pattern: p })}
                />
              ))}
            </div>
          </Field>

          <button
            type="button"
            onClick={() => onChange({ ...value, compound: !value.compound })}
            className="glass flex min-h-[48px] w-full items-center justify-between rounded-2xl px-4"
          >
            <span className="text-[15px] font-semibold">{t.exercises.compoundMovement}</span>
            <span
              className={`rounded-full px-3 py-1 text-[13px] font-semibold ${
                value.compound ? chip.on : "bg-secondary text-secondary-foreground"
              }`}
            >
              {value.compound ? t.exercises.yes : t.exercises.no}
            </span>
          </button>

          <Field label={t.exercises.instructions}>
            <textarea
              value={value.instructions}
              onChange={(e) => onChange({ ...value, instructions: e.target.value })}
              rows={3}
              className="glass w-full rounded-2xl p-3 text-[17px] outline-none"
            />
          </Field>

          <Field label={t.exercises.formCues}>
            <textarea
              value={value.cues.join("\n")}
              onChange={(e) =>
                onChange({ ...value, cues: e.target.value.split("\n").filter((c) => c.trim()) })
              }
              rows={3}
              className="glass w-full rounded-2xl p-3 text-[17px] outline-none"
            />
          </Field>

          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={() => void save()}
              className="min-h-[50px] flex-1 rounded-2xl bg-primary text-[17px] font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? t.exercises.savingExercise : t.exercises.saveExercise}
            </button>
            {/* Built-in exercises come back from the app's own list, so
                only your own can be deleted; "Avoid" hides a built-in one. */}
            {!draft?.isNew && !SEED_EXERCISES.some((e) => e.id === draft?.value.id) ? (
              <button
                disabled={busy}
                aria-label={t.exercises.deleteExercise}
                onClick={() => void remove()}
                className="glass flex size-[50px] shrink-0 items-center justify-center rounded-2xl text-destructive-text disabled:opacity-50"
              >
                <Trash2 className="size-5" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </BottomSheet>
  );
}
