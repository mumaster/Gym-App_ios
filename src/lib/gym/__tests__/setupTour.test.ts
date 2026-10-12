import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The flow needs a router only inside tap handlers; stub it for rendering.
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => () => {},
  useRouterState: () => "/",
  Link: ({ children }: { children?: unknown }) => children,
}));

import { SETUP_STEP_COUNT, SetupFlow } from "../../../components/gym/SetupTour";
import { GymProvider } from "../store";

const render = (step: number) =>
  renderToString(
    createElement(
      GymProvider,
      null,
      createElement(SetupFlow, { step, onStep: () => {}, onClose: () => {} }),
    ),
  );

describe("SetupFlow render", () => {
  it("renders every step without throwing", () => {
    expect(SETUP_STEP_COUNT).toBe(15);
    for (let i = 0; i < SETUP_STEP_COUNT; i++) expect(() => render(i)).not.toThrow();
  });

  it("opens on the About you step, inside a labelled dialog", () => {
    const html = render(0);
    expect(html).toContain("About you");
    expect(html).toContain('role="dialog"');
    expect(html).toContain("Set up Forge");
  });

  it("ends on the done step with its own actions and no Skip", () => {
    const html = render(SETUP_STEP_COUNT - 1);
    expect(html).toContain("You&#x27;re all set");
    expect(html).toContain("Build my first workout");
    expect(html).not.toContain(">Skip<");
  });
});
