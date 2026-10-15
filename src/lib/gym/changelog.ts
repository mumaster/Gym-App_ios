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
  /** One change: a plain sentence. Leave it out when `items` is used. */
  text?: Record<Language, string>;
  /** Several features in one release: one short item per feature, shown as
   *  bullets that each start with a "New" pill. */
  items?: Record<Language, string>[];
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
    items: [
      {
        en: "Add spices to your meal with the Add spices button in your food overview: pick salt, pepper and more from an A–Z list, or search them.",
        nl: "Voeg kruiden toe aan je maaltijd met de knop Kruiden toevoegen in je voedseloverzicht: kies zout, peper en meer uit een A–Z-lijst, of zoek ze.",
      },
      {
        en: "Superset: the rest screen now shows what comes next and which set it is, for example “Barbell bench press, set 2 / 3”.",
        nl: "Superset: het rustscherm laat nu zien wat er hierna komt en de hoeveelste set het is, bijvoorbeeld “Barbell bench press, set 2 / 3”.",
      },
      {
        en: "Workout: “Finish workout” now asks “Are you sure?” first.",
        nl: "Training: “Training afronden” vraagt nu eerst “Weet je het zeker?”.",
      },
    ],
  },
  {
    version: 37,
    text: {
      en: "What's new now lists several features of one update as bullets, each with a “New” tag.",
      nl: "Wat is er nieuw toont meerdere functies van één update nu als opsommingstekens, elk met een label “Nieuw”.",
    },
  },
  {
    version: 38,
    items: [
      {
        en: "Meal overview: the Add food and Share buttons are now at the top of the screen.",
        nl: "Maaltijdoverzicht: de knoppen Toevoegen en Delen staan nu bovenaan het scherm.",
      },
    ],
  },
  {
    version: 39,
    items: [
      {
        en: "See the sugars in your carbs: food, meals and your day now show “of which sugars”, filled in from barcodes and label photos.",
        nl: "Zie de suikers in je koolhydraten: voedsel, maaltijden en je dag tonen nu “waarvan suikers”, ingevuld vanuit barcodes en etiketfoto's.",
      },
      {
        en: "Set an optional sugar goal in your nutrition goals: 10% of your calories, or 5% if you want to be stricter.",
        nl: "Stel een optioneel suikerdoel in bij je voedingsdoelen: 10% van je calorieën, of 5% als je strenger wilt zijn.",
      },
      {
        en: "Your weekly overview has a Carbs card: seven day bars with your carbs, and the sugars in them in your accent colour.",
        nl: "Je weekoverzicht heeft een kaart Koolhydraten: zeven dagbalken met je koolhydraten, en de suikers daarin in je accentkleur.",
      },
      {
        en: "Eat more at the weekend with a weekend budget: turn it on in your nutrition goals and pick 5 to 20% extra from Friday evening to Sunday, your weekly average stays the same.",
        nl: "Eet meer in het weekend met een weekendbudget: zet het aan bij je voedingsdoelen en kies 5 tot 20% extra van vrijdagavond tot zondag, je weekgemiddelde blijft gelijk.",
      },
      {
        en: "Get a nudge in your notifications when the weekend runs well over its budget.",
        nl: "Krijg een seintje in je meldingen als het weekend ruim boven het budget uitkomt.",
      },
    ],
  },
  {
    version: 40,
    text: {
      en: "Unpackaged foods (fruit, vegetables, bread, dairy and more) now show their sugars too, from the Dutch food table NEVO, also for foods you logged before.",
      nl: "Onverpakt voedsel (fruit, groente, brood, zuivel en meer) toont nu ook de suikers, uit de Nederlandse voedingsmiddelentabel NEVO, ook voor voedsel dat je eerder logde.",
    },
  },
  {
    version: 41,
    items: [
      {
        en: "The daily limits screen now has two tabs: your limits, and More options (training and rest day limits, sugar goal, weekend budget).",
        nl: "Het scherm met dagelijkse limieten heeft nu twee tabs: je limieten, en Meer opties (limieten voor trainings- en rustdagen, suikerdoel, weekendbudget).",
      },
      {
        en: "Tap the small (i) on a card to read its explanation; it stays hidden otherwise.",
        nl: "Tik op het kleine (i) bij een kaart om de uitleg te lezen; anders blijft die verborgen.",
      },
    ],
  },
  {
    version: 42,
    items: [
      {
        en: "Notifications now drop down from the top of the screen, and nothing overlaps the tab bar anymore.",
        nl: "Meldingen komen nu van boven het scherm naar beneden, en niets overlapt meer met de tabbalk.",
      },
      {
        en: "Copy all foods of a meal to another meal (or another day) with the Copy to button in your food overview.",
        nl: "Kopieer alle producten van een maaltijd naar een andere maaltijd (of dag) met de knop Kopieer naar in je voedingsoverzicht.",
      },
      {
        en: "When some sugars are unknown, sugar totals now show a ~ in front (like ~20 g) instead of ≥.",
        nl: "Als sommige suikers onbekend zijn, staat er nu een ~ voor het suikertotaal (zoals ~20 g) in plaats van ≥.",
      },
    ],
  },
  {
    version: 43,
    text: {
      en: "The Today card on the Food tab is tidier: sugars, fiber and salt now sit in a second row of the same layout as protein, carbs and fat.",
      nl: "De kaart Vandaag op het Voedingstabblad is netter: suikers, vezels en zout staan nu in een tweede rij met dezelfde opmaak als eiwit, koolhydraten en vet.",
    },
  },
  {
    version: 44,
    items: [
      {
        en: "Pause your workout with the Pause button at the top of a session and pick it up again with Resume. The timer and rest countdown stop, and paused time is not counted.",
        nl: "Pauzeer je training met de knop Pauze bovenin een sessie en ga verder met Hervatten. De timer en rustteller staan stil en de pauzetijd telt niet mee.",
      },
      {
        en: "Tap + on a food in Add food and it is logged right away. The row lights up and says how many grams were added to which meal, and you can keep adding. Add to log takes you back to the list with the same highlight, and the + on a meal opens the same page with that meal already picked.",
        nl: "Tik op + bij een eten in Eten toevoegen en het wordt direct gelogd. De rij licht op en laat zien hoeveel gram aan welke maaltijd is toegevoegd, en je kunt gewoon doorgaan. Toevoegen aan logboek brengt je terug naar de lijst met dezelfde markering, en de + bij een maaltijd opent dezelfde pagina met die maaltijd al gekozen.",
      },
      {
        en: "In a meal overview, Share is now a small button next to Save as meal, and Add and Copy to are the same width.",
        nl: "In een maaltijdoverzicht is Delen nu een klein knopje naast Opslaan als maaltijd, en Toevoegen en Kopieer naar zijn even breed.",
      },
      {
        en: "On the rest screen the set count (like Set 2 / 3) now sits under Next, with a pill for every set: full accent for the sets you did, pale accent for the rest of your goal.",
        nl: "Op het rustscherm staat het setnummer (zoals Set 2 / 3) nu onder Hierna, met een streepje per set: volle accentkleur voor de sets die je deed, lichte accentkleur voor de rest van je doel.",
      },
      {
        en: "Your logged sets in a workout look cleaner: each set shows its kilos and reps in their own pill, and the Previous column is gone (last time's numbers still show under the next set).",
        nl: "Je gelogde sets in een training zien er netter uit: elke set toont kilo's en reps in een eigen pil, en de kolom Vorige is weg (de cijfers van vorige keer staan nog onder de volgende set).",
      },
      {
        en: "The glow around an exercise card when your rest ends now follows your accent colour instead of always being green.",
        nl: "De gloed rond een oefeningkaart als je rust voorbij is volgt nu je accentkleur in plaats van altijd groen te zijn.",
      },
      {
        en: "When your workout is done, the screen behind the Workout done panel is now blurred and dimmed, just like during a rest.",
        nl: "Als je training klaar is, is het scherm achter het paneel Training klaar nu wazig en gedimd, net als tijdens een rust.",
      },
      {
        en: "The message pill at the top of a workout now lines up with the exercise card behind it: same side gap, rounded corners that follow the card's curve.",
        nl: "De melding bovenaan een training sluit nu aan op de oefeningkaart erachter: dezelfde ruimte aan de zijkant en afgeronde hoeken die de bocht van de kaart volgen.",
      },
    ],
  },
  {
    version: 45,
    items: [
      {
        en: "Weekly sets are now counted per specific muscle, like Biceps, Triceps, Side Delts and Lats, instead of per group like Arms. Every set counts whole for each muscle it works, with no half sets.",
        nl: "Wekelijkse sets worden nu per specifieke spier geteld, zoals biceps, triceps, zijkant schouders en lats, in plaats van per groep zoals armen. Elke set telt heel mee voor elke spier die erin werkt, zonder halve sets.",
      },
      {
        en: "Star the specific muscles you want to grow, like only Biceps and not the whole of Arms. Tap a group name to star all its muscles. Your current stars carry over.",
        nl: "Markeer de specifieke spieren die je wilt laten groeien, bijvoorbeeld alleen biceps en niet alle armen. Tik op een groepsnaam om al haar spieren te markeren. Je huidige markeringen blijven behouden.",
      },
    ],
  },
  {
    version: 46,
    items: [
      {
        en: "Build your own workouts in the new Custom tab on Workout: add any exercise, set sets, reps and rest, pair two exercises as a superset, and save it.",
        nl: "Stel je eigen training samen in het nieuwe tabblad Zelf maken onder Training: voeg elke oefening toe, kies sets, herhalingen en rust, koppel twee oefeningen als superset en sla hem op.",
      },
      {
        en: "Every workout you build gets a score out of 100, plus how well each muscle is trained against its weekly target. Tap the (i) to see how it works.",
        nl: "Elke training die je samenstelt krijgt een score van 100, en per spier zie je hoe goed die getraind wordt tegenover je weekdoel. Tik op de (i) om te zien hoe het werkt.",
      },
      {
        en: "Put a saved workout on a day of your week plan or program with Use a saved workout when you open that day.",
        nl: "Zet een opgeslagen training op een dag van je weekschema of programma met Opgeslagen training gebruiken als je die dag opent.",
      },
      {
        en: "The old Build your own tab is now called Generator.",
        nl: "Het oude tabblad Zelf samenstellen heet nu Generator.",
      },
    ],
  },
  {
    version: 47,
    items: [
      {
        en: "A meal's overview now looks like your Today card, and sugars now sits next to carbs on both: protein, carbs and sugars on top, fat, fibre and salt below, each with its amount, goal and a bar.",
        nl: "Het overzicht van een maaltijd ziet er nu uit als je kaart Vandaag: eiwit, koolhydraten en suikers bovenaan, vet, vezels en zout eronder, elk met hoeveelheid, doel en een balk. Suikers staat nu naast koolhydraten, ook op je kaart Vandaag.",
      },
    ],
  },
  {
    version: 48,
    items: [
      {
        en: "Add salt and other spices quickly with the new Add spices button in Add food. Search or scroll the A–Z list.",
        nl: "Voeg snel zout en andere kruiden toe met de nieuwe knop Kruiden toevoegen in Voedsel toevoegen. Zoek of scrol door de A–Z-lijst.",
      },
      {
        en: "In Add food, List, Manual and Spices now sit in one compact row under Scan, and the new meal and recipe buttons are a plain +. Opening Add food from a meal's + no longer shows the Add to row.",
        nl: "In Voedsel toevoegen staan Lijst, Handmatig en Kruiden nu in één compacte rij onder Scan, en de knoppen voor een nieuwe maaltijd of nieuw recept zijn een gewone +. Open je Voedsel toevoegen via de + van een maaltijd, dan zie je de rij Toevoegen aan niet meer.",
      },
    ],
  },
  {
    version: 49,
    items: [
      {
        en: "Equipment now has a Low Cable and a High Cable option instead of one combined Low / Mid Cable. Cable crossover and the standing cable chest press now need the High Cable.",
        nl: "Bij Apparatuur kies je nu Lage kabel en Hoge kabel in plaats van één gecombineerde lage/middelste kabel. Kabel crossover en de staande kabel borstpress hebben nu de Hoge kabel nodig.",
      },
    ],
  },
  {
    version: 50,
    items: [
      {
        en: "In Custom, set how long your workout should take. The score now compares your workout with the one the app would generate for the same muscles and length, so one exercise no longer scores 100.",
        nl: "In Zelf maken kies je nu hoe lang je training moet duren. De score vergelijkt je training nu met de training die de app automatisch maakt voor dezelfde spieren en duur, dus één oefening scoort geen 100 meer.",
      },
      {
        en: "Add exercise is now the main button in Custom.",
        nl: "Oefening toevoegen is nu de hoofdknop in Zelf maken.",
      },
      {
        en: "The score in Custom shows live next to Add exercise, so you see what each change does.",
        nl: "De score in Zelf maken staat nu live naast Oefening toevoegen, zodat je ziet wat elke wijziging doet.",
      },
      {
        en: "Where the score loses points on order, reps or rest, a button under it fixes that one setting when you tap it.",
        nl: "Verliest de score punten op volgorde, herhalingen of rust, dan past een knop eronder precies die instelling aan als je erop tikt.",
      },
      {
        en: "The score counts the sets you already trained this week, so a muscle that has had enough counts less.",
        nl: "De score telt de sets die je deze week al hebt getraind, dus een spier die al genoeg heeft gehad telt minder.",
      },
    ],
  },
];

/** The texts of an entry in one language: one for a plain entry, one per
 *  feature for an entry with `items`. */
export const entryTexts = (entry: ChangelogEntry, language: Language): string[] =>
  entry.items ? entry.items.map((i) => i[language]) : entry.text ? [entry.text[language]] : [];

/** What this build is. Bump it with every deploy-worthy change, together with
 *  its entry above (the changelog test fails when the two disagree). */
export const CURRENT_VERSION = 50;

/** `5` → "0.005" (alpha: major 0, three-digit build number). */
export const formatVersion = (version: number): string => `0.${String(version).padStart(3, "0")}`;

/** Entries newer than `seen`, newest first. */
export const entriesSince = (seen: number): ChangelogEntry[] =>
  CHANGELOG.filter((e) => e.version > seen).sort((a, b) => b.version - a.version);
