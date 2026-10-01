/**
 * Measures exercise popularity for src/lib/gym/exercisePopularity.ts (see
 * that file for the method and its limits). Steps, all from this folder:
 *
 *   1. python3 deltabolic_channel.py              → deltabolic.json, then
 *      turn it into db-titles.json ([title, views] pairs) — used only to
 *      report DeltaBolic coverage ("db:" below) and find missing exercises.
 *   2. List every exercise name (and each alias in aliases.json) in
 *      queries.json, then: python3 youtube_search.py queries.json yt-all.json
 *   3. npx tsx score.ts <folder with yt-all.json and db-titles.json>
 *      → prints the ranking and rewrites the app's table.
 *
 * YouTube's page format changes now and then; the scrapers read its public
 * search and channel pages (no API key of ours), so expect to adjust them.
 */
import { EXERCISES } from "../../src/lib/gym/data";
import fs from "node:fs";
const D = process.argv[2] ?? ".";
const yt: Record<string, { title: string; views: number }[]> = JSON.parse(
  fs.readFileSync(`${D}/yt-all.json`, "utf8"),
);
const dbTitles: [string, number][] = JSON.parse(fs.readFileSync(`${D}/db-titles.json`, "utf8"));
export const norm = (s: string) =>
  " " +
  s
    .toLowerCase()
    .replace(/push[\s-]?ups?/g, "pushup")
    .replace(/pull[\s-]?ups?/g, "pullup")
    .replace(/chin[\s-]?ups?/g, "chinup")
    .replace(/\brdls?\b|\brdl's\b/g, "romanian deadlift")
    .replace(/\bdbs?\b/g, "dumbbell")
    .replace(/\bkbs?\b/g, "kettlebell")
    .replace(/\bohp\b/g, "overhead press")
    .replace(/flyes?|flies/g, "fly")
    .replace(/triceps?/g, "tricep")
    .replace(/biceps?/g, "bicep")
    .replace(/raises/g, "raise")
    .replace(/rows\b/g, "row")
    .replace(/curls\b/g, "curl")
    .replace(/squats\b/g, "squat")
    .replace(/lunges\b/g, "lunge")
    .replace(/presses\b/g, "press")
    .replace(/extensions\b/g, "extension")
    .replace(/thrusts\b/g, "thrust")
    .replace(/deadlifts\b/g, "deadlift")
    .replace(/crunches\b/g, "crunch")
    .replace(/dips\b/g, "dip")
    .replace(/shrugs\b/g, "shrug")
    .replace(/pulldowns?|pull[\s-]downs?/g, "pulldown")
    .replace(/pushdowns?|push[\s-]downs?/g, "pushdown")
    .replace(/face[\s-]?pulls?/g, "facepull")
    .replace(/skull[\s-]?crushers?/g, "skullcrusher")
    .replace(/dumbbells/g, "dumbbell")
    .replace(/kettlebells/g, "kettlebell")
    .replace(/cables/g, "cable")
    .replace(/bands?\b|banded/g, "band")
    .replace(/machines/g, "machine")
    .replace(/planks/g, "plank")
    .replace(/bridges/g, "bridge")
    .replace(/hamstrings?/g, "hamstring")
    .replace(/glutes?/g, "glute")
    .replace(/step[\s-]?ups?/g, "stepup")
    .replace(/sit[\s-]?ups?/g, "situp")
    .replace(/v[\s-]ups?/g, "vup")
    .replace(/walk[\s-]?outs?/g, "walkout")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ") +
  " ";
const OPTIONAL = new Set([
  "barbell",
  "bodyweight",
  "standing",
  "seated",
  "half",
  "kneeling",
  "to",
  "the",
  "with",
  "on",
  "of",
  "and",
  "a",
  "straight",
  "s",
  "45",
  "°",
]);
export function coreWords(name: string) {
  // "Single-leg"/"one-arm" describe how, not what: optional. A bare "leg"
  // (leg press, leg curl) is part of the name.
  const n = norm(name).replace(/ (single|one) (leg|arm) /g, " ");
  return n
    .trim()
    .split(" ")
    .filter((w) => w && !OPTIONAL.has(w));
}
const has = (t: string, w: string) => t.includes(" " + w + " ") || t.includes(" " + w);
export function score(name: string) {
  const words = coreWords(name);
  const r = (yt[name] ?? []).slice(0, 20).filter((x) => words.every((w) => has(norm(x.title), w)));
  return { words, views: r.reduce((s, x) => s + x.views, 0), n: r.length };
}
export function deltabolic(name: string) {
  const words = coreWords(name);
  const hits = dbTitles.filter(([t]) => words.every((w) => has(norm(t), w)));
  return { n: hits.length, views: hits.reduce((s, [, v]) => s + v, 0) };
}
const aliases: Record<string, string> = JSON.parse(
  fs.readFileSync(new URL("./aliases.json", import.meta.url), "utf8"),
);
const best = (id: string, name: string) => {
  const a = score(name),
    alias = aliases[id];
  const b = alias ? score(alias) : null;
  const pick = b && b.views > a.views ? { ...b, via: alias } : { ...a, via: name };
  const da = deltabolic(name),
    dbb = alias ? deltabolic(alias) : { n: 0, views: 0 };
  return { ...pick, db: da.n >= dbb.n ? da : dbb };
};
const rows = EXERCISES.map((e) => ({ id: e.id, name: e.name, ...best(e.id, e.name) }));
rows.sort((a, b) => b.views - a.views);
for (const r of rows)
  console.log(
    `${(r.views / 1e6).toFixed(2).padStart(7)}M ${String(r.n).padStart(2)} db:${String(r.db.n).padStart(2)}  ${r.id.padEnd(38)} via ${r.via}`,
  );
// Write the measured numbers into the app's table.
const file = new URL("../../src/lib/gym/exercisePopularity.ts", import.meta.url);
const src = fs.readFileSync(file, "utf8");
const body = rows
  .map((r) => `  ${JSON.stringify(r.id)}: ${Math.round(r.views / 1e4) / 100},`)
  .join("\n");
fs.writeFileSync(
  file,
  src.replace(
    /(export const EXERCISE_POPULARITY: Record<string, number> = \{\n)[\s\S]*?(\n\};)/,
    `$1${body}$2`,
  ),
);
console.log(`wrote ${rows.length} exercises; run prettier on src/lib/gym/exercisePopularity.ts`);
