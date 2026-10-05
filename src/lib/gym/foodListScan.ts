import { createServerFn } from "@tanstack/react-start";
import type { FoodListResult } from "./foodList";
import type { FoodListInput } from "./foodListGemini";

/** Reads a list of foods with Gemini (foodListGemini.ts), server-side like
 *  scanNutritionLabel, so GEMINI_API_KEY never reaches the browser. */
export const readFoodList = createServerFn({ method: "POST" })
  .validator((input: FoodListInput) => input)
  .handler(async ({ data }): Promise<FoodListResult> => {
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) throw new Error("AI reading isn't set up on this deployment yet.");
    // Imported here, not at the top: the client bundle never runs this
    // handler, so the prompt and the NEVO table stay out of it.
    const [{ NEVO_FOODS }, { readFoodListWithGemini }] = await Promise.all([
      import("./nevoFoods.data"),
      import("./foodListGemini"),
    ]);
    return readFoodListWithGemini(apiKey, data, NEVO_FOODS);
  });
