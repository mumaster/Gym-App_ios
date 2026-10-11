import { describe, expect, it } from "vitest";
import { checkSulphites } from "../allergens";

const terms = (r: ReturnType<typeof checkSulphites>) => r?.hits.map((h) => h.term) ?? [];

describe("checkSulphites", () => {
  it("returns null when there is nothing to read", () => {
    expect(checkSulphites("")).toBeNull();
    expect(checkSulphites(null)).toBeNull();
    expect(checkSulphites("   ")).toBeNull();
  });

  it.each(["E220", "E221", "E222", "E223", "E224", "E225", "E226", "E227", "E228"])(
    "finds %s",
    (code) => {
      const r = checkSulphites(`Water, sugar, preservative (${code}).`);
      expect(r?.verdict).toBe("contains");
      expect(terms(r)).toContain(code);
    },
  );

  it("reads spaced and dashed codes", () => {
    expect(terms(checkSulphites("conservering: E 223"))).toContain("E223");
    expect(terms(checkSulphites("preservative e-202, e-224"))).toEqual(["E224"]);
  });

  it("does not take E229 or E2200 for a sulphite", () => {
    expect(checkSulphites("E229, E2200, E320")?.verdict).toBe("none");
  });

  it("finds names in English and Dutch", () => {
    expect(checkSulphites("Sodium Metabisulphite")?.verdict).toBe("contains");
    expect(checkSulphites("Sulfites")?.verdict).toBe("contains");
    expect(checkSulphites("Druivensap, zwaveldioxide")?.verdict).toBe("contains");
    expect(checkSulphites("Gedroogde abrikozen, conserveermiddel: sulfiet")?.verdict).toBe(
      "contains",
    );
  });

  it("uses Open Food Facts allergen and additive tags", () => {
    expect(
      checkSulphites("Raisins", { allergens: ["en:sulphur-dioxide-and-sulphites"] })?.verdict,
    ).toBe("contains");
    const r = checkSulphites("", { additives: ["en:e220"] });
    expect(r?.verdict).toBe("contains");
    expect(terms(r)).toEqual(["E220"]);
  });

  it("calls sulphite-prone foods unclear, not safe", () => {
    for (const text of [
      "red wine",
      "Wijnazijn, olie",
      "Dried apricots, sugar",
      "Rozijnen",
      "balsamic vinegar of Modena",
    ]) {
      expect(checkSulphites(text)?.verdict).toBe("maybe");
    }
    expect(terms(checkSulphites("Dried apricots"))).toContain("dried apricot");
  });

  it("calls 'may contain' wording unclear", () => {
    const r = checkSulphites("Flour, water. May contain traces of sulphites.");
    expect(r?.verdict).toBe("maybe");
    expect(r?.hits[0]?.kind).toBe("mayContain");
    expect(checkSulphites("Meel. Kan sporen van sulfiet bevatten.")?.verdict).toBe("maybe");
    expect(checkSulphites("Flour", { traces: ["en:sulphur-dioxide-and-sulphites"] })?.verdict).toBe(
      "maybe",
    );
  });

  it("stays 'contains' when sulphites are named outside the may-contain sentence", () => {
    expect(checkSulphites("Water, E223. May contain traces of sulphites.")?.verdict).toBe(
      "contains",
    );
  });

  it("says none for a clean ingredient list", () => {
    const r = checkSulphites("Oats, water, salt, cranberry flavour");
    expect(r).toEqual({ verdict: "none", hits: [] });
  });

  it("matches whole words, so cranberry isn't beer", () => {
    expect(checkSulphites("cranberry, jamaican pepper")?.verdict).toBe("none");
  });

  it("lists one line for overlapping terms", () => {
    expect(terms(checkSulphites("sodium metabisulphite"))).toEqual(["metabisulphite"]);
    expect(terms(checkSulphites("red wine vinegar"))).toEqual(["wine vinegar"]);
  });
});

describe("sulphites on a photographed Dutch label", () => {
  const label = "Water, suiker, conserveermiddel (natriumdisulfiet [E223]), zout";
  it("flags the AH label text", () => {
    const r = checkSulphites(label);
    expect(r?.verdict).toBe("contains");
    expect(r?.hits.map((h) => h.term)).toContain("E223");
  });
  it.each([
    "conserveermiddel (natriumdisul-\nfiet)",
    "conserveermiddel (natrium disulfiet)",
    "conserveermiddel: sulfiet",
    "kaliummetabisulfiet",
    "zwaveldioxide",
    "preservative [E 220]",
    "conserveermiddel [E228]",
  ])("flags %s", (t) => {
    expect(checkSulphites(t)?.verdict).toBe("contains");
  });
});
