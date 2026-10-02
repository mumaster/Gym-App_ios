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
  | "exerciseSelection"
  | "exercisePopularity"
  | "startWeights"
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
  | "energy"
  | "foodComposition"
  | "sessionEnergy"
  | "cut"
  | "bulk"
  | "protein"
  | "fat"
  | "fiberSalt"
  | "calorieFloor"
  | "restDayCarbs"
  | "proteinPerMeal"
  | "watchCalories"
  | "caffeine"
  | "energySplit"
  | "concurrent"
  | "cardioMinutes"
  | "cardioMets"
  | "water"
  | "alcoholGlass"
  | "alcoholAdvice"
  | "wineMeasures"
  | "bottleSize";

export const SOURCES: SourceEntry[] = [
  {
    id: "startWeights",
    group: "training",
    refs: [
      "Zourdos et al., J Strength Cond Res 2016; Helms et al., Strength Cond J 2016 (RPE as reps in reserve)",
      "Saeterbakken et al., J Strength Cond Res 2011 (barbell vs dumbbell bench press 1RM)",
      "Korean J Appl Biomech 2006 (flat vs incline bench press 1RM regression)",
      "Cotterman et al., J Strength Cond Res 2005 (Smith machine vs free-weight bench press 1RM)",
      "Saeterbakken & Fimland, J Strength Cond Res 2013 (barbell vs dumbbell, seated vs standing shoulder press 1RM)",
      "Rough estimates between other exercises have no published source and are marked as rough in the app",
    ],
  },
  {
    id: "exercisePopularity",
    group: "training",
    refs: [
      "YouTube search results per exercise: views of the top 20 results naming it, measured 1 October 2026 (no published ranking of exercise popularity exists)",
      "DeltaBolic (Andrew Kwong) YouTube channel: 981 videos and Shorts, used to find popular exercises the list lacked",
    ],
  },
  {
    id: "exerciseSelection",
    group: "training",
    refs: [
      "Maeo et al., Med Sci Sports Exerc 2021 (seated vs prone leg curl)",
      "Maeo et al., Eur J Sport Sci 2023 (overhead vs neutral triceps extension)",
      "Kinoshita et al., Front Physiol 2023 (standing vs seated calf raise)",
      "Kikuchi & Nakazato, 2017; Calatayud et al., J Strength Cond Res 2015 (push-up vs bench press)",
      "Neto et al., J Sports Sci Med 2020 (gluteus maximus activation, systematic review)",
      "Boren et al., 2011; Distefano et al., J Orthop Sports Phys Ther 2009 (gluteus medius)",
      "Ebben, 2009; McAllister et al., J Strength Cond Res 2014 (hamstring exercises)",
      "Zabaleta-Korta et al., 2021 (leg extension vs squat, regional quadriceps growth)",
      "ACE-sponsored EMG studies: biceps, triceps, chest, shoulders (2012–2014), abdominals (2001)",
    ],
  },
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
    id: "concurrent",
    group: "training",
    refs: [
      "Held et al., umbrella review of concurrent training, Sports Med 2026",
      "Schumann et al., Sports Med 2022",
      "Robineau et al., J Strength Cond Res 2016",
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
    id: "cardioMinutes",
    group: "tracking",
    refs: ["WHO guidelines on physical activity (Bull et al., Br J Sports Med 2020)"],
  },
  {
    id: "cardioMets",
    group: "tracking",
    refs: ["2024 Adult Compendium of Physical Activities (Herrmann et al.), cardio entries"],
  },
  {
    id: "streak",
    group: "tracking",
    refs: ["WHO guidelines on physical activity (Bull et al., Br J Sports Med 2020)"],
  },
  {
    id: "watchCalories",
    group: "tracking",
    refs: ["Shcherbina et al., J Pers Med 2017 (seven wrist devices vs. indirect calorimetry)"],
  },
  {
    id: "weightTrend",
    group: "tracking",
    refs: ["Body-mass variability study (PMC10653631)", "Hall, Int J Obes 2008"],
  },
  {
    id: "energy",
    group: "nutrition",
    refs: ["National Academies, Dietary Reference Intakes for Energy (2023)"],
  },
  {
    id: "foodComposition",
    group: "nutrition",
    refs: [
      "NEVO online version 2025/9.0, RIVM, Bilthoven",
      "EU Regulation 1169/2011, Annex I (salt = sodium × 2.5)",
    ],
  },
  {
    id: "energySplit",
    group: "nutrition",
    refs: ["EU Regulation 1169/2011, Annex XIV (protein 4, carbohydrate 4, fat 9 kcal/g)"],
  },
  {
    id: "water",
    group: "nutrition",
    refs: [
      "EFSA NDA Panel, Scientific opinion on dietary reference values for water, EFSA Journal 2010",
      "ACSM position stand on exercise and fluid replacement (Sawka et al., 2007)",
    ],
  },
  {
    id: "alcoholGlass",
    group: "nutrition",
    refs: ["Trimbos-instituut, standard glass of alcohol (about 10 g of pure alcohol)"],
  },
  {
    id: "alcoholAdvice",
    group: "nutrition",
    refs: ["Gezondheidsraad (Dutch Health Council), advice on alcohol, June 2026"],
  },
  {
    id: "wineMeasures",
    group: "nutrition",
    refs: [
      "The Weights and Measures (Specified Quantities) (Unwrapped Bread and Intoxicating Liquor) Order 2011 (UK; wine by the glass in 125 ml and 175 ml)",
    ],
  },
  {
    id: "bottleSize",
    group: "nutrition",
    refs: ["Directive 2007/45/EC (EU nominal bottle sizes; still wine in 750 ml)"],
  },
  {
    id: "caffeine",
    group: "nutrition",
    refs: ["EFSA NDA Panel, Scientific opinion on the safety of caffeine, EFSA Journal 2015"],
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
