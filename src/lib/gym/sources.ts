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
  | "rirWeeks"
  | "recovery"
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
  | "recomp"
  | "protein"
  | "fat"
  | "fiberSalt"
  | "calorieFloor"
  | "restDayCarbs"
  | "sugars"
  | "satFat"
  | "weekend"
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
      "280 training programs (153 from Boostcamp, 127 from Jefit), read 16 October 2026: how many of them contain each exercise; YouTube views only break ties",
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
    id: "rirWeeks",
    group: "training",
    refs: [
      "Helms, Cronin, Storey & Zourdos, Strength Cond J 2016",
      "Refalo et al. 2023; Robinson et al. 2024",
    ],
  },
  {
    id: "recovery",
    group: "training",
    refs: [
      "ACSM progression position stand (2009)",
      "Morán-Navarro et al., Eur J Appl Physiol 2017",
    ],
  },
  {
    id: "concurrent",
    group: "training",
    refs: [
      "Held et al., umbrella review of concurrent training, Sports Med 2026",
      "Schumann et al., Sports Med 2022",
      "Robineau et al., J Strength Cond Res 2016",
      "Eddens et al., Sports Med 2018",
      "Wilson et al., J Strength Cond Res 2012",
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
    id: "recomp",
    group: "nutrition",
    refs: [
      "Barakat, Pearson, Escalante, Campbell & De Souza, Strength Cond J 2020",
      "Murphy & Koehler, Scand J Med Sci Sports 2022",
    ],
  },
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
  {
    id: "sugars",
    group: "nutrition",
    refs: [
      "WHO, Guideline: sugars intake for adults and children (2015): free sugars below 10% of total energy (strong recommendation), below 5% for added benefit (conditional) (https://who.int/news/item/04-03-2015-who-calls-on-countries-to-reduce-sugars-intake-among-adults-and-children)",
      "US Dietary Guidelines for Americans 2025-2030 (added sugars below 10% of calories)",
      "EFSA Scientific Opinion on the Tolerable Upper Intake Level for dietary sugars (2022): intake of added and free sugars should be as low as possible",
    ],
  },
  {
    id: "satFat",
    group: "nutrition",
    refs: [
      "WHO, Saturated fatty acid and trans-fatty acid intake for adults and children: guideline (2023): saturated fat below 10% of total energy (https://www.who.int/news/item/17-07-2023-who-updates-guidelines-on-fats-and-carbohydrates)",
      "EFSA Panel on Dietetic Products, Nutrition and Allergies, Scientific Opinion on Dietary Reference Values for fats (2010): saturated fat as low as possible within a nutritionally adequate diet",
      "Gezondheidsraad, Richtlijnen goede voeding 2015, and Voedingscentrum: saturated fat below 10% of energy (https://www.voedingscentrum.nl/encyclopedie/verzadigd-vet.aspx)",
      "Hooper et al., Reduction in saturated fat intake for cardiovascular disease, Cochrane Database Syst Rev 2020 (https://doi.org/10.1002/14651858.CD011737.pub3)",
      "Sacks et al., Dietary Fats and Cardiovascular Disease: A Presidential Advisory from the American Heart Association, Circulation 2017 (https://doi.org/10.1161/CIR.0000000000000510)",
    ],
  },
  {
    id: "weekend",
    group: "nutrition",
    refs: [
      "Reynolds et al., Relationship between weekly patterns of caloric intake and reported weight loss outcomes, JMIR mHealth uHealth 2018 (7,007 Lose It! users): weight loss was as good or better with a small, planned weekend excess than with a large one (https://mhealth.jmir.org/2018/4/e83)",
      "Racette et al., Influence of weekend lifestyle patterns on body weight, Obesity 2008: unplanned weekend eating cancelled part of the weekday deficit",
      "Campbell et al., Intermittent energy restriction attenuates the loss of fat-free mass in resistance trained individuals, J Funct Morphol Kinesiol 2020: same weekly deficit, continuous or with 2 days at maintenance, similar body composition",
    ],
  },
];
