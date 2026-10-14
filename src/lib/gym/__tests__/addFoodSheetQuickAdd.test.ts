import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AddFoodSheet } from "../../../components/gym/AddFoodSheet";
import { GymProvider } from "../store";
import { dictFor } from "../i18n";

const en = dictFor("en");
const nl = dictFor("nl");

const render = (props: Partial<Parameters<typeof AddFoodSheet>[0]>) =>
  renderToString(
    createElement(
      GymProvider,
      null,
      createElement(AddFoodSheet, {
        open: true,
        onClose: () => {},
        day: "2026-10-14",
        onCreateMeal: () => {},
        onCreateRecipe: () => {},
        ...props,
      }),
    ),
  );

describe("Add food quick add", () => {
  it("renders opened from a meal, with the 'Add to' row still shown", () => {
    expect(render({ initialMeal: "lunch" })).toContain(en.addFood.addingTo);
    expect(() => render({ initialMeal: "dinner" })).not.toThrow();
  });
  it("words the added message in English and Dutch", () => {
    expect(en.addFood.addedTo(150, "Lunch")).toBe("Added 150 g to Lunch");
    expect(nl.addFood.addedTo(150, "Lunch")).toBe("150 g toegevoegd aan Lunch");
  });
});
