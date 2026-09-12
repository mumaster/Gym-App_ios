/**
 * Best-effort parser for nutrition-label OCR text. Labels vary wildly in
 * layout (EU "per 100g" tables, US "Nutrition Facts" panels, kJ vs kcal,
 * comma vs period decimals), so this is deliberately a heuristic, not a
 * guarantee — callers must show the result in an editable form rather than
 * trusting it outright.
 */
export interface ParsedNutrition {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

function firstNumber(text: string): number | null {
  const m = text.match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  return Number(m[1]!.replace(",", "."));
}

/**
 * Finds the first line containing one of `keywords` (checked in priority
 * order) that doesn't also contain an `exclude` term — e.g. skip "of which
 * saturates" when looking for total fat — and pulls the first number out of
 * whatever follows the keyword on that line.
 */
function findValue(lines: string[], keywords: string[], exclude: string[] = []): number | null {
  for (const kw of keywords) {
    const line = lines.find((l) => l.includes(kw) && !exclude.some((ex) => l.includes(ex)));
    if (line) {
      const afterKeyword = line.slice(line.indexOf(kw) + kw.length);
      const n = firstNumber(afterKeyword) ?? firstNumber(line);
      if (n !== null) return n;
    }
  }
  return null;
}

export function parseNutritionText(rawText: string): ParsedNutrition {
  const lines = rawText
    .split("\n")
    .map((l) => l.toLowerCase().trim())
    .filter(Boolean);

  const calories =
    findValue(lines, ["kcal"], ["kj"]) ?? findValue(lines, ["calories", "energie", "energy"]);
  const protein = findValue(lines, ["protein", "eiwit", "protéines"]);
  const carbs = findValue(
    lines,
    ["total carbohydrate", "carbohydrate", "koolhydraten", "glucides", "carbs"],
    ["of which", "sugars", "waarvan", "suikers"],
  );
  const fat = findValue(
    lines,
    ["total fat", "fat", "vet", "lipides"],
    ["saturated", "saturates", "of which", "waarvan", "verzadigd", "trans"],
  );

  return { calories, protein, carbs, fat };
}
