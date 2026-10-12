import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildRow,
  configureAnalytics,
  flushEvents,
  queuedEventCount,
  resetAnalyticsForTests,
  sanitizeProps,
  track,
} from "../analytics";
import { screenOf } from "../../../components/gym/AnalyticsTracker";

afterEach(() => {
  resetAnalyticsForTests();
  vi.unstubAllGlobals();
});

describe("sanitizeProps", () => {
  it("drops keys that look like health or personal data", () => {
    const out = sanitizeProps({
      weight_kg: 80,
      reps: 10,
      food_name: "apple",
      email: "a@b.c",
      user_id: "x",
      kcal: 200,
      note: "hi",
      screen: "home",
      step: 3,
      message: "boom",
      age: 31,
    });
    expect(out).toEqual({ screen: "home", step: 3, message: "boom" });
  });

  it("keeps only plain values, trims long strings and caps the key count", () => {
    const out = sanitizeProps({
      a: "x".repeat(500),
      nested: { x: 1 },
      list: [1],
      nan: Number.NaN,
      ok: true,
    });
    expect((out["a"] as string).length).toBe(120);
    expect(Object.keys(out).sort()).toEqual(["a", "ok"]);
    const many = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, i]));
    expect(Object.keys(sanitizeProps(many)).length).toBe(12);
  });
});

describe("levels", () => {
  it("sends nothing when off", () => {
    configureAnalytics({ level: "off", lang: "en" });
    expect(buildRow("screen.viewed", { screen: "home" })).toBeNull();
    track("screen.viewed", { screen: "home" });
    expect(queuedEventCount()).toBe(0);
  });

  it("basic has no install id and ignores detail props", () => {
    configureAnalytics({ level: "basic", lang: "nl" });
    const row = buildRow("workout.finished", { sets_logged: 4 }, { exercise_ids: "a,b" });
    expect(row?.install_id).toBeNull();
    expect(row?.props).toEqual({ sets_logged: 4 });
    expect(row?.lang).toBe("nl");
  });

  it("detailed adds an install id and the detail props", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    configureAnalytics({ level: "detailed", lang: "en" });
    const row = buildRow("workout.finished", { sets_logged: 4 }, { exercise_ids: "a,b" });
    expect(row?.install_id).toBeTruthy();
    expect(row?.props).toEqual({ sets_logged: 4, exercise_ids: "a,b" });
    // The same id next time, and gone again once the person steps back to basic.
    expect(buildRow("x")?.install_id).toBe(row?.install_id);
    configureAnalytics({ level: "basic", lang: "en" });
    expect(store.size).toBe(0);
  });

  it("uses one session id per launch", () => {
    configureAnalytics({ level: "basic", lang: "en" });
    expect(buildRow("a")?.session_id).toBe(buildRow("b")?.session_id);
  });
});

describe("sending", () => {
  it("posts queued events in one batch", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_x");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    configureAnalytics({ level: "basic", lang: "en" });
    track("a");
    track("b");
    flushEvents();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://example.supabase.co/rest/v1/app_events");
    expect(JSON.parse(init.body as string)).toHaveLength(2);
    expect(queuedEventCount()).toBe(0);
    vi.unstubAllEnvs();
  });

  it("never throws, even when fetch does", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "k");
    vi.stubGlobal("fetch", () => {
      throw new Error("offline");
    });
    configureAnalytics({ level: "basic", lang: "en" });
    track("a");
    expect(() => flushEvents()).not.toThrow();
    vi.unstubAllEnvs();
  });
});

describe("screenOf", () => {
  it("drops ids from paths", () => {
    expect(screenOf("/")).toBe("home");
    expect(screenOf("/nutrition")).toBe("nutrition");
    expect(screenOf("/history/3f2a9c1e-1111-4222-8333-444455556666")).toBe("history/:id");
    expect(screenOf("/history/week/2026-10-05")).toBe("history/week/:id");
  });
});
