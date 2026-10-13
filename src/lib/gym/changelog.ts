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
];

/** What this build is. Bump it with every deploy-worthy change, together with
 *  its entry above (the changelog test fails when the two disagree). */
export const CURRENT_VERSION = 16;

/** `5` → "0.005" (alpha: major 0, three-digit build number). */
export const formatVersion = (version: number): string => `0.${String(version).padStart(3, "0")}`;

/** Entries newer than `seen`, newest first. */
export const entriesSince = (seen: number): ChangelogEntry[] =>
  CHANGELOG.filter((e) => e.version > seen).sort((a, b) => b.version - a.version);
