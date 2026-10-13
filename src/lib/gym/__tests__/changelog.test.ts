import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => () => {},
  useRouterState: () => "/",
  Link: ({ children }: { children?: unknown }) => children,
}));

import { WhatsNewSheet } from "../../../components/gym/WhatsNew";
import { CHANGELOG, CURRENT_VERSION, entriesSince, formatVersion } from "../changelog";
import { EXERCISE_ANIMATIONS } from "../exerciseAnimations";
import { GymProvider } from "../store";

describe("changelog", () => {
  it("has an English and Dutch text for the current version, as the newest entry", () => {
    const entry = CHANGELOG.find((e) => e.version === CURRENT_VERSION);
    expect(entry, `CHANGELOG needs an entry for version ${CURRENT_VERSION}`).toBeDefined();
    expect(CHANGELOG[CHANGELOG.length - 1]!.version).toBe(CURRENT_VERSION);
  });

  it("numbers entries 1, 2, 3 … with both texts filled in", () => {
    CHANGELOG.forEach((e, i) => {
      expect(e.version).toBe(i + 1);
      expect(e.text.en.trim().length).toBeGreaterThan(0);
      expect(e.text.nl.trim().length).toBeGreaterThan(0);
    });
  });

  it("formats alpha versions", () => {
    expect(formatVersion(5)).toBe("0.005");
    expect(formatVersion(120)).toBe("0.120");
  });

  it("lists everything newer than the seen version, newest first", () => {
    expect(entriesSince(CURRENT_VERSION)).toEqual([]);
    expect(entriesSince(CURRENT_VERSION - 2).map((e) => e.version)).toEqual([
      CURRENT_VERSION,
      CURRENT_VERSION - 1,
    ]);
  });

  it("renders the sheet with all missed texts", () => {
    const html = renderToString(
      createElement(
        GymProvider,
        null,
        createElement(WhatsNewSheet, { open: true, onClose: () => {}, since: 0 }),
      ),
    );
    expect(html).toContain("What&#x27;s new");
    expect(html).toContain("0.001");
    expect(html).toContain(formatVersion(CURRENT_VERSION));
    // An entry's animation preview renders as a drawing.
    expect(html).toContain('viewBox="0 0 320 206"');
  });

  it("only previews exercises that have a figure animation", () => {
    for (const e of CHANGELOG) {
      if (e.animation) expect(EXERCISE_ANIMATIONS[e.animation]?.figure, e.animation).toBeDefined();
    }
  });
});
