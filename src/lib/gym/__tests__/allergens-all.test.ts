import { describe, expect, it } from "vitest";
import { ALLERGIES, checkAllergen, type AllergyId } from "../allergens";

const verdict = (id: AllergyId, text: string) => checkAllergen(id, text)?.verdict;

describe("every allergen", () => {
  it("offers the 14 EU allergens, once each", () => {
    expect(new Set(ALLERGIES).size).toBe(14);
  });

  it("returns null without text or tags, and none for a clean list", () => {
    for (const id of ALLERGIES) {
      expect(checkAllergen(id, "")).toBeNull();
      expect(verdict(id, "Water, sugar, salt, citric acid")).toBe("none");
    }
  });

  it("uses Open Food Facts allergen tags", () => {
    const tags: Record<AllergyId, string> = {
      peanuts: "en:peanuts",
      treeNuts: "en:nuts",
      milk: "en:milk",
      eggs: "en:eggs",
      gluten: "en:gluten",
      soy: "en:soybeans",
      fish: "en:fish",
      crustaceans: "en:crustaceans",
      sesame: "en:sesame-seeds",
      celery: "en:celery",
      mustard: "en:mustard",
      sulphites: "en:sulphur-dioxide-and-sulphites",
      lupin: "en:lupin",
      molluscs: "en:molluscs",
    };
    for (const id of ALLERGIES) {
      expect(checkAllergen(id, "Water", { allergens: [tags[id]] })?.verdict).toBe("contains");
      expect(checkAllergen(id, "Water", { traces: [tags[id]] })?.verdict).toBe("maybe");
    }
    expect(checkAllergen("milk", "Water", { allergens: ["en:eggs"] })?.verdict).toBe("none");
  });
});

describe("named forms, English and Dutch", () => {
  it.each([
    ["peanuts", "Sugar, roasted peanuts"],
    ["peanuts", "Pindakaas, zout"],
    ["treeNuts", "Chocolate, hazelnuts, almond paste"],
    ["treeNuts", "Suiker, amandelen"],
    ["milk", "Skimmed milk powder, whey"],
    ["milk", "Water, kaas, karnemelk"],
    ["milk", "Sodium caseinate"],
    ["eggs", "Flour, eggs, sugar"],
    ["eggs", "Bloem, eieren, eigeel"],
    ["gluten", "Wheat flour, malt extract"],
    ["gluten", "Tarwemeel, gerstemout"],
    ["soy", "Soya beans, soy sauce"],
    ["soy", "Water, sojaolie, tofu"],
    ["fish", "Anchovies, olive oil"],
    ["fish", "Kabeljauw, zalm"],
    ["crustaceans", "Shrimp, rice"],
    ["crustaceans", "Garnalen en krab"],
    ["sesame", "Tahini, chickpeas"],
    ["sesame", "Sesamzaad"],
    ["celery", "Celery salt"],
    ["celery", "Knolselderij, water"],
    ["mustard", "Mustard seed, vinegar"],
    ["mustard", "Mosterd"],
    ["lupin", "Lupin flour"],
    ["molluscs", "Mussels, squid"],
    ["molluscs", "Oesters en inktvis"],
  ] as const)("%s in %s", (id, text) => {
    expect(verdict(id, text)).toBe("contains");
  });
});

describe("what isn't the allergen", () => {
  it("plant milks, cocoa butter and shea butter aren't dairy", () => {
    expect(verdict("milk", "Water, almonds, oat milk, coconut milk, cocoa butter")).toBe("none");
    expect(verdict("milk", "Kokosmelk, sheaboter, cacaoboter")).toBe("none");
    expect(verdict("milk", "Peanut butter")).toBe("none");
  });

  it("gluten free and rice flour aren't gluten", () => {
    expect(verdict("gluten", "Gluten free, rice flour")).toBe("none");
    expect(verdict("gluten", "Glutenvrij, maismeel")).toBe("none");
  });

  it("coconut, nutmeg and pine nuts aren't tree nuts", () => {
    expect(verdict("treeNuts", "Coconut, nutmeg, pine nuts")).toBe("none");
    expect(verdict("treeNuts", "Kokosnoot, muskaatnoot")).toBe("none");
  });

  it("eggplant isn't egg, and eigen isn't ei", () => {
    expect(verdict("eggs", "Eggplant, tomato, onion")).toBe("none");
    expect(verdict("eggs", "Eigen recept, eivrij")).toBe("none");
  });

  it("a plant protein isn't milk or egg", () => {
    expect(verdict("milk", "Soja-eiwit, erwteneiwit")).toBe("none");
  });

  it("peanut doesn't make a tree nut", () => {
    expect(verdict("treeNuts", "Peanuts, salt")).toBe("none");
    expect(verdict("peanuts", "Almonds, salt")).toBe("none");
  });
});

describe("unclear cases", () => {
  it("food that often holds it is 'maybe'", () => {
    expect(verdict("eggs", "Oil, vinegar, mayonnaise")).toBe("maybe");
    expect(verdict("milk", "Sugar, chocolate")).toBe("maybe");
    expect(verdict("soy", "Cocoa, soy lecithin")).toBe("contains");
    expect(verdict("soy", "Cocoa, lecithin")).toBe("maybe");
    expect(verdict("sesame", "Chickpea hummus")).toBe("maybe");
    expect(verdict("celery", "Chicken soup")).toBe("maybe");
    expect(verdict("gluten", "Sugar, beer")).toBe("maybe");
    expect(verdict("peanuts", "Mixed nuts")).toBe("maybe");
  });

  it("'may contain' wording is 'maybe', and a named ingredient elsewhere wins", () => {
    expect(verdict("milk", "Cocoa. May contain traces of milk.")).toBe("maybe");
    expect(verdict("treeNuts", "Oats. Kan sporen van noten bevatten.")).toBe("maybe");
    expect(verdict("milk", "Whey, sugar. May contain traces of milk.")).toBe("contains");
  });

  it("lists one line for overlapping terms", () => {
    const r = checkAllergen("milk", "milk powder");
    expect(r?.hits.map((h) => h.term)).toEqual(["milk powder"]);
  });
});
