/**
 * Every published source behind a fixed number in the app, in one list. The
 * screens themselves stay free of citations (they read as clutter when every
 * card carried one), so this list — shown on Settings → Sources — is where a
 * user can check what a number is based on. The same sources are cited in
 * full in the comment next to each constant. Add an entry here whenever a
 * new sourced number is added; its "used for" line lives in i18n.ts's
 * `sources.uses`, keyed by the same id.
 */
export type SourceGroup = "training" | "tracking" | "nutrition";

export interface SourceEntry {
  id: SourceId;
  group: SourceGroup;
  /** Citations as published, so not translated. */
  refs: string[];
}

export type SourceId =
  | "rest"
  | "progression"
  | "repRanges"
  | "rpe"
  | "warmup"
  | "volume"
  | "deload"
  | "sessionRpe"
  | "loadSpike"
  | "e1rm"
  | "streak"
  | "weightTrend"
  | "bmr"
  | "activity"
  | "sessionEnergy"
  | "cut"
  | "bulk"
  | "protein"
  | "fat"
  | "fiberSalt"
  | "calorieFloor"
  | "restDayCarbs"
  | "proteinPerMeal";

export const SOURCES: SourceEntry[] = [
  {
    id: "rest",
    group: "training",
    refs: [
      "ACSM position stand: Progression models in resistance training (Ratamess et al., 2009)",
      "ACSM resistance training position stand update (2026)",
      "Schoenfeld et al., J Strength Cond Res 2016",
    ],
  },
  {
    id: "progression",
    group: "training",
    refs: ["ACSM progression position stand (2009)", "NSCA “2-for-2 rule”"],
  },
  {
    id: "repRanges",
    group: "training",
    refs: ["Schoenfeld et al., repetition continuum review (2021)"],
  },
  {
    id: "rpe",
    group: "training",
    refs: [
      "Helms et al., Front Physiol 2018",
      "Zourdos et al., RIR-based RPE scale (2016)",
      "Refalo et al. 2023; Robinson et al. 2024",
    ],
  },
  {
    id: "warmup",
    group: "training",
    refs: ["Ribeiro et al., Percept Mot Skills 2014", "Ribeiro et al., J Hum Kinet 2020"],
  },
  {
    id: "volume",
    group: "training",
    refs: [
      "Pelland et al., dose-response meta-regression (2024)",
      "Schoenfeld, Ogborn & Krieger, J Sports Sci 2017",
      "Baz-Valle et al. 2022",
    ],
  },
  {
    id: "deload",
    group: "training",
    refs: [
      "Bell et al., Sports Med Open 2023 (Delphi consensus) and 2024 (survey)",
      "Bell et al., Strength Cond J 2025",
    ],
  },
  {
    id: "sessionRpe",
    group: "tracking",
    refs: ["Foster et al. 2001", "Day et al. 2004"],
  },
  {
    id: "loadSpike",
    group: "tracking",
    refs: ["Gabbett, Br J Sports Med 2016", "Impellizzeri et al. 2020"],
  },
  { id: "e1rm", group: "tracking", refs: ["Epley 1985"] },
  {
    id: "streak",
    group: "tracking",
    refs: ["WHO guidelines on physical activity (Bull et al., Br J Sports Med 2020)"],
  },
  {
    id: "weightTrend",
    group: "tracking",
    refs: ["Body-mass variability study (PMC10653631)", "Hall, Int J Obes 2008"],
  },
  { id: "bmr", group: "nutrition", refs: ["Mifflin-St Jeor equation (1990)"] },
  {
    id: "activity",
    group: "nutrition",
    refs: ["FAO/WHO/UNU Human energy requirements (2004)"],
  },
  {
    id: "sessionEnergy",
    group: "nutrition",
    refs: ["2024 Adult Compendium of Physical Activities (Herrmann et al.)"],
  },
  {
    id: "cut",
    group: "nutrition",
    refs: ["Helms, Aragon & Fitschen, J Int Soc Sports Nutr 2014"],
  },
  { id: "bulk", group: "nutrition", refs: ["Iraki, Fitschen, Espinar & Helms, 2019"] },
  {
    id: "protein",
    group: "nutrition",
    refs: ["Morton et al., Br J Sports Med 2018", "ISSN position stand (Jäger et al., 2017)"],
  },
  {
    id: "fat",
    group: "nutrition",
    refs: ["Institute of Medicine (20–35% of energy)", "Helms et al. 2014; Iraki et al. 2019"],
  },
  {
    id: "fiberSalt",
    group: "nutrition",
    refs: ["US Dietary Guidelines (fiber)", "WHO sodium guideline (salt)"],
  },
  {
    id: "proteinPerMeal",
    group: "nutrition",
    refs: ["Schoenfeld & Aragon, J Int Soc Sports Nutr 2018"],
  },
  { id: "calorieFloor", group: "nutrition", refs: ["AHA/ACC/TOS obesity guideline (2013)"] },
  {
    id: "restDayCarbs",
    group: "nutrition",
    refs: [
      "ACSM / Academy of Nutrition and Dietetics / Dietitians of Canada (Thomas et al., 2016)",
      "Burke et al., J Sports Sci 2011",
    ],
  },
];
