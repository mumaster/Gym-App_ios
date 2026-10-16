import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NutrientCell } from "../../../components/gym/NutrientCell";
import { NutrientPanel } from "../../../components/gym/NutrientPanel";
import { GymProvider } from "../store";

const render = (props: Parameters<typeof NutrientCell>[0]) =>
  renderToString(createElement(NutrientCell, props));

describe("NutrientCell with an 'of which' part", () => {
  it("draws the part as an accent pill inside the total's bar", () => {
    const html = render({
      label: "Carbs",
      value: "150",
      amount: 150,
      goal: 300,
      part: { label: "Sugars", value: "~30", amount: 30, goal: 65 },
    });
    expect(html).toContain('data-bar="total"');
    expect(html).toContain('data-bar="part"');
    expect(html).toContain("intake-fill");
    expect(html).toMatch(/--bar:\s*50%/);
    expect(html).toMatch(/--bar:\s*10%/);
    expect(html).toContain("Sugars");
    expect(html).toContain("~30");
    expect(html).toContain(" / 65");
  });

  it("keeps the part's share of the total when over the goal", () => {
    const html = render({
      label: "Fat",
      value: "100",
      amount: 100,
      goal: 80,
      part: { label: "Saturated", value: "40", amount: 40, goal: 29 },
    });
    expect(html).toContain("bg-destructive");
    expect(html).toMatch(/--bar:\s*100%/);
    expect(html).toMatch(/--bar:\s*40%/);
  });

  it("draws no part pill when the part is unknown", () => {
    const html = render({
      label: "Fat",
      value: "20",
      amount: 20,
      goal: 80,
      part: { label: "Saturated", value: "–", amount: 0, goal: 29 },
    });
    expect(html).not.toContain('data-bar="part"');
    expect(html).toContain("–");
  });
});

describe("NutrientPanel", () => {
  const item = (label: string, amount: number, goal: number) => ({
    label,
    value: String(amount),
    amount,
    goal,
  });
  const panel = (protein: number) =>
    renderToString(
      createElement(
        GymProvider,
        null,
        createElement(NutrientPanel, {
          protein: item("Protein", protein, 180),
          carbs: {
            ...item("Carbs", 90, 300),
            part: { label: "Sugars", value: "29", amount: 29, goal: 65 },
          },
          fat: {
            ...item("Fat", 48, 80),
            part: { label: "Saturated", value: "24", amount: 24, goal: 29 },
          },
          fiber: item("Fiber", 15, 35),
          salt: item("Salt", 2, 5),
        }),
      ),
    );

  it("pairs carbs and fat, each with its part, above protein, fiber and salt", () => {
    const html = panel(74);
    expect(html.indexOf("Carbs")).toBeLessThan(html.indexOf("Protein"));
    expect(html.indexOf("Fat")).toBeLessThan(html.indexOf("Protein"));
    expect(html.match(/data-bar="part"/g)).toHaveLength(2);
    expect(html).toContain("Salt");
  });
});
