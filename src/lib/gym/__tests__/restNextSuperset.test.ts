import { describe, expect, it } from "vitest";
import { dictFor } from "../i18n";

describe("rest screen next-up line in a superset", () => {
  it("names the exercise with its set number in both languages", () => {
    for (const lang of ["en", "nl"] as const) {
      expect(dictFor(lang).session.restNextExerciseSet("Row", 2, 3)).toBe("Row, set 2 / 3");
    }
  });
});
