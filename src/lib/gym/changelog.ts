import type { Language } from "./types";

/**
 * What's new, one entry per deploy-worthy change. The version is the entry's
 * number: alpha style `0.001`, `0.002`, … (see formatVersion), so the next
 * change adds the next number at the END of this list. The app shows
 * everything newer than the last version a person has seen (WhatsNew.tsx), so
 * write each text for them: short, plain language, English and Dutch.
 * __tests__/changelog.test.ts fails when the list has gaps or a missing text.
 */
export interface ChangelogEntry {
  version: number;
  text: Record<Language, string>;
  /** An exercise id whose animation plays under the text, as a small preview. */
  animation?: string;
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: 1,
    text: {
      en: "Weekly program: plan a training week, tap a day to see or generate its workout, and switch day types.",
      nl: "Weekprogramma: plan een trainingsweek, tik op een dag om de training te zien of te maken en wissel van dagtype.",
    },
  },
  {
    version: 2,
    text: {
      en: "Set up Forge: a short guided setup for your profile, equipment and goals, which you can replay from Settings.",
      nl: "Forge instellen: een korte rondleiding voor je profiel, uitrusting en doelen, die je opnieuw kunt starten via Instellingen.",
    },
  },
  {
    version: 3,
    text: {
      en: "Exercise animations: see how an exercise is done from the front and the side, with the button next to the video button.",
      nl: "Oefeningen in beeld: bekijk hoe een oefening gaat van voren en van opzij, met de knop naast de videoknop.",
    },
  },
  {
    version: 4,
    text: {
      en: "After a workout you can still add an exercise or a cardio session to it.",
      nl: "Na een training kun je er nog een oefening of cardiosessie aan toevoegen.",
    },
  },
  {
    version: 5,
    text: {
      en: "What's new: the app now tells you what changed after an update, and shows its version number in Settings.",
      nl: "Wat is er nieuw: de app laat na een update zien wat er veranderd is en toont het versienummer in Instellingen.",
    },
  },
  {
    version: 6,
    text: {
      en: "Usage statistics: the app now shares anonymous info about which features get used, to help improve it. You can turn it off, or opt in to more detail, in Settings.",
      nl: "Gebruiksstatistieken: de app deelt nu anoniem welke functies gebruikt worden, om hem te verbeteren. In Instellingen zet je dit uit, of kies je voor meer detail.",
    },
  },
  {
    version: 7,
    text: {
      en: "Faster barcode scanner: the camera starts sooner, codes are read several times faster, and a product you scanned before loads instantly.",
      nl: "Snellere barcodescanner: de camera start sneller, codes worden vele malen sneller gelezen en een eerder gescand product laadt direct.",
    },
  },
  {
    version: 8,
    text: {
      en: "Barcode scanner reads codes at any angle: sideways, tilted or upside down, not just held perfectly straight.",
      nl: "De barcodescanner leest codes onder elke hoek: zijwaarts, scheef of ondersteboven, niet alleen perfect recht.",
    },
  },
  {
    version: 9,
    text: {
      en: "Spices and salt: search for salt, pepper, paprika, cinnamon, oregano and about 25 more common European spices and herbs when you add food.",
      nl: "Kruiden en zout: zoek bij het toevoegen van eten naar zout, peper, paprika, kaneel, oregano en zo'n 25 andere veelgebruikte Europese kruiden.",
    },
  },
  {
    version: 10,
    text: {
      en: "Plan food ahead: pick a day in the future on the Nutrition week bar and add food or saved meals to it, handy for meal prep.",
      nl: "Eten vooruit plannen: kies op de weekbalk bij Voeding een dag in de toekomst en voeg eten of opgeslagen maaltijden toe, handig voor meal prep.",
    },
  },
  {
    version: 11,
    text: {
      en: "New exercise animations: barbell curl, hammer curl, dumbbell RDL, skullcrusher, overhead triceps extension and dips. The dumbbell in a hammer curl now turns with your hand.",
      nl: "Nieuwe oefeninganimaties: barbell curl, hammer curl, dumbbell RDL, skullcrusher, triceps-extensie boven het hoofd en dips. De dumbbell bij een hammer curl draait nu mee met je hand.",
    },
  },
  {
    version: 12,
    text: {
      en: "Search products by name: when you add food, packaged products from Open Food Facts (the scanner's database) now show up in the results, so you can log them without scanning the barcode.",
      nl: "Producten zoeken op naam: bij het toevoegen van eten zie je nu ook verpakte producten uit Open Food Facts (de database van de scanner), zodat je ze kunt loggen zonder de barcode te scannen.",
    },
  },
  {
    version: 13,
    text: {
      en: "Food search results now show a small tag with where each one comes from: My foods, NEVO or Open Food Facts.",
      nl: "Zoekresultaten bij eten tonen nu een klein label waar ze vandaan komen: Mijn eten, NEVO of Open Food Facts.",
    },
  },
  {
    version: 14,
    text: {
      en: "A product you saved with your own values no longer shows up a second time under Products in the food search.",
      nl: "Een product dat je met je eigen waarden hebt opgeslagen, staat in de zoekresultaten niet meer dubbel onder Producten.",
    },
  },
  {
    version: 15,
    text: {
      en: "Product search now shows product names in your app language (Dutch or English) when Open Food Facts has them, instead of often French.",
      nl: "Producten zoeken toont productnamen nu in de taal van je app (Nederlands of Engels) als Open Food Facts die heeft, in plaats van vaak Frans.",
    },
  },
  {
    version: 16,
    text: {
      en: "Updating the app no longer shows an error screen: if the old version is still open after an update, it now loads the new one cleanly.",
      nl: "Een update van de app geeft geen foutscherm meer: staat de oude versie na een update nog open, dan laadt de nieuwe versie nu netjes.",
    },
  },
  {
    version: 17,
    text: {
      en: "Scanner: switch between the back cameras of your phone (for example ultra wide) with the new button at the top.",
      nl: "Scanner: wissel tussen de achtercamera's van je telefoon (bijvoorbeeld ultragroothoek) met de nieuwe knop bovenin.",
    },
  },
  {
    version: 18,
    text: {
      en: "Scanner: the camera button now opens a list of your phone's back cameras, and remembers the one you pick for next time.",
      nl: "Scanner: de camera-knop opent nu een lijst met de achtercamera's van je telefoon en onthoudt je keuze voor de volgende keer.",
    },
  },
  {
    version: 19,
    text: {
      en: "Scanner: the title and the camera button no longer overlap at the top of the camera screen.",
      nl: "Scanner: de titel en de camera-knop overlappen niet meer bovenin het camerascherm.",
    },
  },
  {
    version: 20,
    text: {
      en: "Scanner: starts on the ultra wide camera when your phone has one, until you pick another camera.",
      nl: "Scanner: start op de ultragroothoekcamera als je telefoon die heeft, totdat je een andere camera kiest.",
    },
  },
  {
    version: 21,
    text: {
      en: "Progress bars for water, calories, coffee and nutrients now glide smoothly to the new value when you add or remove something.",
      nl: "Voortgangsbalken voor water, calorieën, koffie en voedingsstoffen schuiven nu vloeiend naar de nieuwe waarde als je iets toevoegt of verwijdert.",
    },
  },
  {
    version: 22,
    text: {
      en: "The water and coffee bars on Home now glide to the new value too.",
      nl: "De water- en koffiebalken op Home schuiven nu ook vloeiend naar de nieuwe waarde.",
    },
  },
  {
    version: 23,
    animation: "chinup",
    text: {
      en: "35 more exercise animations, including push-ups, crunches, the dumbbell bench press, the overhead press, cable rows, face pulls, chin-ups and the pec deck.",
      nl: "35 nieuwe oefeninganimaties, waaronder push-ups, crunches, dumbbell bench press, overhead press, kabelroeien, face pulls, chin-ups en de pec deck.",
    },
  },
  {
    version: 24,
    animation: "db-kickback",
    text: {
      en: "35 more exercise animations, including the hack squat, Smith machine squat and press, Arnold press, dumbbell pullover, incline curl, sumo deadlift, good morning, dragon flag and cable kickback.",
      nl: "35 nieuwe oefeninganimaties, waaronder de hack squat, squat en press in de Smith machine, Arnold press, dumbbell pullover, incline curl, sumo deadlift, good morning, dragon flag en cable kickback.",
    },
  },
  {
    version: 25,
    animation: "single-arm-lat-pulldown",
    text: {
      en: "4 more exercise animations for home gym workouts: the single-arm cable rear delt fly, Smith machine shoulder press, half-kneeling single-arm lat pulldown and Smith machine Romanian deadlift.",
      nl: "4 nieuwe oefeninganimaties voor thuisgymtrainingen: de reverse fly met één arm aan de kabel, schouderpress en Roemeense deadlift in de Smith machine, en de lat pulldown met één arm op één knie.",
    },
  },
  {
    version: 26,
    text: {
      en: "Records in History: your best estimated 1-rep max, heaviest set and record history per exercise, plus a strength score. The muscle map now tints muscles that are still recovering (also under History → Activity), and program weeks set how many reps to leave in reserve, shown while you lift.",
      nl: "Records in Geschiedenis: je beste geschatte 1RM, zwaarste set en recordgeschiedenis per oefening, plus een krachtscore. De spierkaart kleurt spieren die nog herstellen (ook onder Geschiedenis → Activiteit), en programmaweken bepalen hoeveel reps je overhoudt, zichtbaar tijdens het trainen.",
    },
  },
  {
    version: 27,
    text: {
      en: 'The list of recovering muscles on the muscle map is now always fully shown, instead of collapsing behind "+N more".',
      nl: 'De lijst met herstellende spieren op de spierkaart toont nu altijd alles, in plaats van in te klappen achter "+N meer".',
    },
  },
  {
    version: 28,
    text: {
      en: "Every bar, column and chart now grows in when it appears, with the same motion as the volume chart in History: progress and goal bars, the weekly recap, records, training load and the weight and exercise graphs. Nothing moves if Reduce Motion is on.",
      nl: "Elke balk, kolom en grafiek groeit nu in zodra hij verschijnt, met dezelfde beweging als de volumegrafiek in Geschiedenis: voortgangs- en doelbalken, het weekoverzicht, records, trainingsbelasting en de gewichts- en oefeninggrafieken. Er beweegt niets als Beweging verminderen aanstaat.",
    },
  },
  {
    version: 29,
    text: {
      en: "Tap a bar to see its figures: the days in a weekly recap, the strength score months and the training load now show the day or month and its value above the chart. Bars and graphs also wait to grow in until you scroll them into view, so the animation no longer plays off screen (History → a week, for example).",
      nl: "Tik op een balk voor de cijfers: de dagen in een weekoverzicht, de maanden van de krachtscore en de trainingsbelasting tonen nu de dag of maand met de waarde boven de grafiek. Balken en grafieken groeien ook pas in als je ze in beeld scrolt, zodat de animatie niet meer buiten beeld afspeelt (bijvoorbeeld Geschiedenis → een week).",
    },
  },
  {
    version: 30,
    text: {
      en: "Food tab: “Can I eat it?” and “Import meal” now sit as two buttons right under Add food.",
      nl: "Voedsel-tab: “Kan ik het?” en “Importeren” staan nu als twee knoppen direct onder Voedsel toevoegen.",
    },
  },
  {
    version: 31,
    text: {
      en: "Dutch wording: the Food tab button now reads “Mag ik het?” instead of “Kan ik het?”.",
      nl: "Betere zin: de knop in de Voedsel-tab heet nu “Mag ik het?” in plaats van “Kan ik het?”.",
    },
  },
  {
    version: 32,
    text: {
      en: "The exercise animation no longer makes the page jump: the note under the animation (Lower, Press, ...) now keeps the same height on every step, so scrolling stays smooth.",
      nl: "De oefeninganimatie laat de pagina niet meer verspringen: de tekst onder de animatie (Zakken, Duwen, ...) houdt nu bij elke stap dezelfde hoogte, zodat scrollen rustig blijft.",
    },
  },
  {
    version: 33,
    text: {
      en: "Workout tab: when a day already has a saved or pre-generated workout, the main button now says “Start planned workout” and starts it right away instead of building a new one.",
      nl: "Training-tab: als een dag al een opgeslagen of vooraf gemaakte training heeft, staat er op de hoofdknop nu “Start geplande training” en start die meteen, in plaats van een nieuwe te maken.",
    },
  },
  {
    version: 34,
    text: {
      en: "Save a finished workout: open it in History and tap “Save this workout” to keep it as a workout or as a template for a kind of day (Upper Body, Lower Body...). Find it under Saved templates on the Workout tab.",
      nl: "Een afgeronde training opslaan: open hem in Geschiedenis en tik op “Deze training opslaan” om hem te bewaren als training of als sjabloon voor een soort dag (Bovenlichaam, Onderlichaam...). Je vindt hem onder Opgeslagen sjablonen in de Training-tab.",
    },
  },
  {
    version: 35,
    text: {
      en: "Adding food to a meal (lunch, dinner, snack) now brings you back to that meal instead of the day overview, so you can keep adding.",
      nl: "Als je eten aan een maaltijd toevoegt (lunch, diner, snack), kom je nu terug bij die maaltijd in plaats van bij het dagoverzicht, zodat je door kunt gaan met toevoegen.",
    },
  },
  {
    version: 36,
    text: {
      en: "During a superset, the rest screen now shows what comes next and which set it is, for example “Barbell bench press, set 2 / 3”.",
      nl: "Tijdens een superset laat het rustscherm nu zien wat er hierna komt en de hoeveelste set het is, bijvoorbeeld “Barbell bench press, set 2 / 3”.",
    },
  },
];

/** What this build is. Bump it with every deploy-worthy change, together with
 *  its entry above (the changelog test fails when the two disagree). */
export const CURRENT_VERSION = 36;

/** `5` → "0.005" (alpha: major 0, three-digit build number). */
export const formatVersion = (version: number): string => `0.${String(version).padStart(3, "0")}`;

/** Entries newer than `seen`, newest first. */
export const entriesSince = (seen: number): ChangelogEntry[] =>
  CHANGELOG.filter((e) => e.version > seen).sort((a, b) => b.version - a.version);
