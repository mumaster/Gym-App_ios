import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { presetIconHref } from "../accentIcon";

describe("presetIconHref", () => {
  it.each(["green", "blue", "orange", "purple", "pink", "yellow"] as const)(
    "%s icon file exists",
    (id) => {
      expect(existsSync(`public${presetIconHref(id)}`)).toBe(true);
    },
  );
});
