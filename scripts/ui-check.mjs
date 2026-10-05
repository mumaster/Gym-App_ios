#!/usr/bin/env node
/**
 * UI check (DESIGN.md §14): opens routes of the running dev server in
 * Chromium at the iPhone sizes the app is designed for, with the Dynamic
 * Island safe-area insets Chromium lacks, and reports what a person would
 * see as broken:
 *
 *   - sideways overflow: anything visible past the screen's edge (content
 *     inside a sideways-scrolling or clipping box counts only where it shows);
 *   - under the tab bar: content still behind the bar once the page is
 *     scrolled to its end (or, on a fixed screen, at all);
 *   - cut-off text: an ellipsis or line clamp that is actually cutting text
 *     (a warning; mark text that's meant to truncate with `data-cut-ok`);
 *   - page errors (a hydration mismatch is listed as a warning);
 *   - text below WCAG's contrast ratio (4.5:1, large text 3:1);
 *   - tap areas under 44 × 44 pt (mark a deliberate exception data-target-ok);
 *   - more than one solid accent control on a screen (a warning; a control
 *     that's meant to be, like a picked avatar, can carry data-solid-ok).
 *
 * Usage (with `npm run dev` running):
 *   npm run ui-check -- --routes /,/nutrition?tab=drinks --shots out/
 *
 * Options:
 *   --routes  comma-separated paths (default: every tab and sub-tab, a
 *             session's detail page, Settings, Equipment and /session)
 *   --sizes   comma-separated WxH (default: 375x812,390x844,402x874,430x932)
 *   --combos  comma-separated language/scheme (default: en/dark,nl/light)
 *   --seed    `demo` (the default: built-in realistic data, with a workout
 *             in progress on /session), `none` (a fresh install), or a JSON
 *             file with GymState fields (language, colour scheme and
 *             welcomeSeen are set by the script). Add data that exercises
 *             the screen you changed if the demo doesn't.
 *   --shots   a directory to save screenshots in (the top of each page, and
 *             its end when it scrolls)
 *   --url     the dev server (default: the first of :5199, :8080, :5173, :3000
 *             that answers)
 *   --strict  cut-off text fails the check too
 *   --verbose list every finding (otherwise the first six)
 *   --open    a control's name (its aria-label or text, from the start): tap
 *             it on each route and check the sheet it opens ("A>B" taps A,
 *             then B in the sheet A opened), scrolled to the
 *             top and to the end, instead of the page
 *   --system-font  keep Chromium's fallback font; by default Liberation Sans
 *             is used, whose widths are close to SF's (the fallback is wider
 *             and cuts text an iPhone wouldn't)
 *
 * Exits 1 when anything fails.
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(import.meta.url);

function loadPlaywright() {
  for (const id of ["playwright", "/opt/node22/lib/node_modules/playwright"]) {
    try {
      return require(id);
    } catch {
      // try the next one
    }
  }
  console.error("Playwright not found. Install it (npm i -D playwright) or set NODE_PATH.");
  process.exit(2);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) out[key] = true;
    else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const routes = String(
  args.routes ??
    "/,/generate,/generate?tab=build,/history,/history?tab=progress,/history?tab=activity,/history/w0,/exercises,/nutrition,/nutrition?tab=drinks,/nutrition?tab=weight,/settings,/equipment,/session",
)
  .split(",")
  .filter(Boolean);
const sizes = String(args.sizes ?? "375x812,390x844,402x874,430x932")
  .split(",")
  .map((s) => s.split("x").map(Number));
const combos = String(args.combos ?? "en/dark,nl/light")
  .split(",")
  .map((c) => c.split("/"));
/** `--seed demo`: a few weeks of a realistic user (a program, workouts with
 *  RPE, a day of food, water, coffee, weigh-ins, a run), dated relative to
 *  now; on /session also a workout in progress. */
function demoState() {
  const day = 86400000;
  const now = Date.now();
  const iso = (t) => new Date(t).toISOString();
  const set = (id, kg, reps, t, rpe) => ({
    exercise_id: id,
    set_number: 1,
    set_type: "working",
    weight: kg,
    reps,
    rpe,
    completed_at: iso(t),
  });
  const plan = [
    {
      exercise_id: "bb-bench",
      target_sets: 3,
      warmup_sets: 1,
      target_reps: "6-10",
      rest_seconds: 120,
    },
    {
      exercise_id: "bb-row",
      target_sets: 3,
      warmup_sets: 0,
      target_reps: "8-12",
      rest_seconds: 120,
    },
  ];
  const workouts = Array.from({ length: 8 }, (_, i) => {
    const t = now - (i * 2.5 + 0.5) * day;
    return {
      id: "w" + i,
      date: iso(t),
      finished_at: iso(t + 3600000),
      duration_minutes: 60,
      target_muscles: ["Chest", "Back"],
      unit: "kg",
      finished: true,
      session_rpe: 7,
      plan,
      completed_sets: [
        set("bb-bench", 70 + (i === 0 ? 5 : -i), 8, t, 8),
        set("bb-bench", 70, 8, t, 8),
        set("bb-row", 60, 10, t, 7),
      ],
    };
  });
  const build = { type: "build", intensity: 1, volume: 1 };
  const monday = new Date(now);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const per = (calories, protein, carbs, fat) => ({
    calories,
    protein,
    carbs,
    fat,
    fiber: 2,
    salt: 0.3,
  });
  const today = iso(now);
  return {
    workouts,
    program: {
      id: "p1",
      name: "Upper / Lower",
      templateId: "upper_lower",
      weeks: [build, build, build, build, { type: "deload", intensity: 0.9, volume: 0.5 }],
      currentWeek: 0,
      schedule: [
        { dow: 1, dayId: "upper" },
        { dow: 2, dayId: "lower" },
        { dow: 4, dayId: "upper" },
        { dow: 5, dayId: "lower" },
      ],
      cyclePosition: 2,
      anchor: iso(monday.getTime()).slice(0, 10),
    },
    nutritionGoals: { calories: 2600, protein: 180, carbs: 300, fat: 80, fiber: 35, salt: 5 },
    waterGoalMl: 2600,
    waterEntries: [
      { id: "x", ml: 500, logged_at: today },
      { id: "y", ml: 250, logged_at: today },
    ],
    coffeeEntries: [{ id: "c1", kind: "espresso", logged_at: today }],
    foodEntries: [
      {
        id: "f1",
        name: "Banaan",
        grams: 120,
        meal: "breakfast",
        logged_at: today,
        per100: per(92, 1.2, 20, 0.3),
      },
      {
        id: "f2",
        name: "Kwark",
        grams: 250,
        meal: "breakfast",
        logged_at: today,
        per100: per(60, 10, 4, 0.2),
      },
      {
        id: "f3",
        name: "Kipfilet bereid",
        grams: 150,
        meal: "lunch",
        logged_at: today,
        per100: per(160, 30, 0, 4),
      },
      {
        id: "f4",
        name: "Rijst witte gekookt",
        grams: 200,
        meal: "lunch",
        logged_at: today,
        per100: per(130, 2.5, 28, 0.3),
      },
    ],
    weightLog: [0, 3, 6, 9, 12, 15].map((d, i) => ({
      id: "wl" + i,
      date: iso(now - d * day).slice(0, 10),
      kg: 97 - i * 0.3,
    })),
    nutritionProfile: {
      sex: "male",
      age: 31,
      heightCm: 185,
      weightKg: 97,
      activity: "lowActive",
      goal: "lose",
      pace: "moderate",
      sessionsPerWeek: 4,
    },
    cardioSessions: [
      {
        id: "cs1",
        date: iso(now - 2 * day),
        activity: "run",
        effort: "moderate",
        manual: true,
        watch: { durationMin: 30, distanceKm: 5 },
      },
    ],
    activeWorkoutForSession: {
      id: "aw",
      date: iso(now - 10 * 60000),
      duration_minutes: 45,
      target_muscles: ["Chest"],
      unit: "kg",
      finished: false,
      plan,
      completed_sets: [set("bb-bench", 70, 8, now - 5 * 60000, 8)],
    },
  };
}
const seedArg = String(args.seed ?? "demo");
const seed =
  seedArg === "demo"
    ? demoState()
    : seedArg === "none"
      ? {}
      : JSON.parse(readFileSync(seedArg, "utf8"));
const LIST = args.verbose ? Infinity : 6;
const sheet = args.open ? String(args.open) : null;
const shots = args.shots ? String(args.shots) : null;
if (shots) mkdirSync(shots, { recursive: true });

async function findServer() {
  if (args.url) return String(args.url).replace(/\/$/, "");
  for (const port of [5199, 8080, 5173, 3000]) {
    const base = `http://127.0.0.1:${port}`;
    try {
      const res = await fetch(base, { signal: AbortSignal.timeout(1500) });
      if (res.ok) return base;
    } catch {
      // not this one
    }
  }
  console.error("No dev server found. Start one with `npm run dev`, or pass --url.");
  process.exit(2);
}

/** Matches CLAUDE.md's safe-area override: a 59 px status bar and a 34 px
 *  home indicator. */
const SAFE_AREA_CSS = `.safe-top{padding-top:59px!important}:root{--tab-bar-clearance:34px}`;
const FONT_CSS = `html,body,button,input,textarea,select{font-family:"Liberation Sans",Arial,sans-serif!important}`;

/** Runs in the page: everything the check reports. `vw` is the screen's
 *  width as set, not `innerWidth`: like Safari, mobile Chromium zooms out to
 *  fit content that's too wide, which makes `innerWidth` grow with it. */
function inspect(vw) {
  const vh = window.innerHeight;
  const describe = (el) => {
    const text = (el.innerText || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ");
    const tag = el.tagName.toLowerCase();
    return text ? `${tag} "${text.slice(0, 40)}"` : `${tag}.${String(el.className).split(" ")[0]}`;
  };
  const isHidden = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0)
        return true;
      if (n.hasAttribute("data-haptic-switch") || n.getAttribute("aria-hidden") === "true")
        return true;
    }
    return false;
  };
  /** The part of an element that can actually be seen: its box cut by every
   *  ancestor that clips or scrolls. */
  const visibleRect = (el) => {
    const r = el.getBoundingClientRect();
    let { left, right, top, bottom } = r;
    for (
      let n = el.parentElement;
      n && n !== document.body && n !== document.documentElement;
      n = n.parentElement
    ) {
      const cs = getComputedStyle(n);
      const p = n.getBoundingClientRect();
      if (cs.overflowX !== "visible") {
        left = Math.max(left, p.left);
        right = Math.min(right, p.right);
      }
      if (cs.overflowY !== "visible") {
        top = Math.max(top, p.top);
        bottom = Math.min(bottom, p.bottom);
      }
      if (cs.position === "fixed") break;
    }
    return { left, right, top, bottom, width: right - left, height: bottom - top };
  };

  const all = [...document.querySelectorAll("body *")].filter(
    (el) => !el.closest("#forge-boot") && !(el instanceof SVGElement && el.ownerSVGElement),
  );

  const overflow = [];
  if (document.documentElement.scrollWidth > vw + 0.5)
    overflow.push(`page is ${document.documentElement.scrollWidth}px wide`);
  for (const el of all) {
    const r = visibleRect(el);
    if (r.width <= 0.5 || r.height <= 0.5) continue;
    if (r.right > vw + 0.5 || r.left < -0.5) {
      if (isHidden(el)) continue;
      overflow.push(`${describe(el)} ${Math.round(r.left)}–${Math.round(r.right)}`);
    }
  }

  const cut = [];
  for (const el of all) {
    const cs = getComputedStyle(el);
    const ellipsis = cs.textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth + 1;
    const clamped =
      cs.webkitLineClamp !== "none" &&
      cs.webkitLineClamp !== "" &&
      el.scrollHeight > el.clientHeight + 1;
    // `data-cut-ok` marks text that's meant to truncate (a long, secondary
    // list of equipment); DESIGN.md §12.
    if (
      (ellipsis || clamped) &&
      !el.closest("[data-cut-ok]") &&
      !isHidden(el) &&
      visibleRect(el).width > 0
    )
      cut.push(describe(el));
  }

  // Content behind the tab bar's pill, as seen right now.
  const under = [];
  const pill = document.querySelector("nav .glass-bar");
  if (pill) {
    const barTop = pill.getBoundingClientRect().top;
    const main = document.querySelector("main");
    const leaves = main
      ? [...main.querySelectorAll("*")].filter(
          (el) =>
            !el.closest("nav") &&
            (el.matches("button,a,input,textarea,select,img,svg,canvas,[role=button]") ||
              [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())),
        )
      : [];
    for (const el of leaves) {
      const r = visibleRect(el);
      if (r.width <= 0.5 || r.height <= 0.5) continue;
      if (r.bottom > barTop + 1 && r.top < vh && !isHidden(el)) under.push(describe(el));
    }
  }
  return { overflow: [...new Set(overflow)], cut: [...new Set(cut)], under: [...new Set(under)] };
}

/** Runs in the page: the design checks (DESIGN.md §2, §4, §1). Text contrast
 *  is WCAG 2.x's ratio between a text's colour and the colours under it
 *  (each ancestor's background composited over the page; images, gradients
 *  and backdrop blur are ignored), 4.5:1, or 3:1 for large text. A tap
 *  target passes when a point 22 pt from its centre in each short direction
 *  still lands on it (tap-target's extra area counts), checked for controls
 *  fully on screen between the header and the tab bar. Solid accent counts
 *  the controls painted in the accent. */
function designChecks(rootSelector) {
  const root = (rootSelector && document.querySelector(rootSelector)) || document.body;
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  const rgba = (c) => {
    cx.clearRect(0, 0, 1, 1);
    cx.fillStyle = "#000";
    cx.fillStyle = c;
    cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const over = (top, under) => {
    const a = top[3];
    return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a)).concat(1);
  };
  const lum = (c) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const ratio = (a, b) => {
    const x = lum(a);
    const y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  const pageBg = rgba(getComputedStyle(document.body).backgroundColor);
  const primary = rgba(getComputedStyle(document.documentElement).getPropertyValue("--primary"));
  const hidden = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) return true;
      if (n.getAttribute("aria-hidden") === "true" || n.hasAttribute("inert")) return true;
    }
    return false;
  };
  const under = (el) => {
    const layers = [];
    let opacity = 1;
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      opacity *= +cs.opacity;
      const c = rgba(cs.backgroundColor);
      if (c[3] > 0) layers.push(c);
      if (c[3] >= 0.999) break;
    }
    let bg = pageBg;
    for (const l of layers.reverse()) bg = over(l, bg);
    return { bg, opacity };
  };
  const label = (el) =>
    (el.getAttribute("aria-label") || el.innerText || el.getAttribute("title") || el.tagName)
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 36);

  const contrast = [];
  const seen = new Set();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const el = node.parentElement;
    if (!node.textContent.trim() || !el || seen.has(el)) continue;
    seen.add(el);
    if (el.closest("#forge-boot, svg, script, style, [data-haptic-switch], [data-contrast-ok]"))
      continue;
    // Disabled controls are exempt (WCAG 2.x SC 1.4.3).
    if (el.closest(":disabled, [aria-disabled=true]")) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || hidden(el)) continue;
    const cs = getComputedStyle(el);
    const px = parseFloat(cs.fontSize);
    const { bg, opacity } = under(el);
    const fg = rgba(cs.color);
    fg[3] *= opacity;
    const large = px >= 24 || (px >= 18.66 && +cs.fontWeight >= 700);
    const value = ratio(over(fg, bg), bg);
    if (value < (large ? 3 : 4.5))
      contrast.push(
        `"${el.innerText.trim().replace(/\s+/g, " ").slice(0, 28)}" ${value.toFixed(2)}`,
      );
  }

  const controls = [
    ...root.querySelectorAll(
      "button, a[href], [role=button], [role=tab], [role=switch], input:not([type=hidden]), select, textarea",
    ),
  ].filter(
    (el) =>
      !el.closest("nav, [data-haptic-switch], [data-target-ok], svg") &&
      !el.matches(":disabled, [aria-disabled=true]") &&
      !(el.matches("input") && el.closest("[data-haptic-switch]")) &&
      !hidden(el),
  );
  const headerBottom = Math.max(
    0,
    ...[...document.querySelectorAll("header, [data-session-header]")].map(
      (h) => h.getBoundingClientRect().bottom,
    ),
  );
  const navTop = document.querySelector("nav")?.getBoundingClientRect().top ?? innerHeight;
  const dockTop =
    document.querySelector("[data-session-dock]")?.getBoundingClientRect().top ?? innerHeight;
  const bottom = Math.min(navTop, dockTop);
  const small = [];
  for (const el of controls) {
    const r = el.getBoundingClientRect();
    if (r.width >= 43.5 && r.height >= 43.5) continue;
    const cxp = r.left + r.width / 2;
    const cyp = r.top + r.height / 2;
    if (cyp - 22 < headerBottom || cyp + 22 > bottom || cxp - 22 < 0 || cxp + 22 > innerWidth)
      continue;
    // Skip a control partly scrolled out of view: it can't be tapped there.
    let clipped = false;
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
      const p = n.getBoundingClientRect();
      if (r.left < p.left - 0.5 || r.right > p.right + 0.5) clipped = true;
      if (r.top < p.top - 0.5 || r.bottom > p.bottom + 0.5) clipped = true;
    }
    if (clipped) continue;
    const probes = [];
    if (r.height < 43.5) probes.push([cxp, cyp - 21], [cxp, cyp + 21]);
    if (r.width < 43.5) probes.push([cxp - 21, cyp], [cxp + 21, cyp]);
    const ok = probes.every(([x, y]) => {
      const hit = document.elementFromPoint(x, y);
      if (!hit) return false;
      if (hit === el || el.contains(hit)) return true;
      const lab = hit.closest("label");
      return !!lab && lab.contains(el);
    });
    if (!ok) small.push(`${label(el)} ${Math.round(r.width)}×${Math.round(r.height)}`);
  }

  const solid = [];
  for (const el of controls) {
    if (el.matches("[role=switch], [data-solid-ok]")) continue;
    const r = el.getBoundingClientRect();
    if (r.width * r.height < 2500) continue;
    const c = rgba(getComputedStyle(el).backgroundColor);
    const d =
      Math.abs(c[0] - primary[0]) + Math.abs(c[1] - primary[1]) + Math.abs(c[2] - primary[2]);
    if (c[3] > 0.95 && d < 8) solid.push(label(el));
  }
  return { contrast, small, solid };
}

const { chromium } = loadPlaywright();
const base = await findServer();
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
});
let failed = 0;
let warned = 0;

for (const [lang, scheme] of combos) {
  for (const [w, h] of sizes) {
    const context = await browser.newContext({
      viewport: { width: w, height: h },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    // The server reads the colour scheme from this cookie; without it a
    // light-mode first visit renders dark first and React reports a mismatch.
    await context.addCookies([{ name: "forge-color-scheme", value: scheme, url: base }]);
    // Supabase (catalog, sync, push) answers with nothing, so the check
    // doesn't depend on the network and logs no fetch errors.
    await context.route(/supabase\.co/, (r) =>
      r.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
    );
    const { activeWorkoutForSession, ...seedState } = seed;
    const state = { ...seedState, language: lang, colorScheme: scheme, welcomeSeen: true };
    await context.addInitScript(
      (s) => {
        try {
          const { state: base, session } = s;
          const onSession = location.pathname === "/session" && session;
          const value = onSession ? { ...base, activeWorkout: session } : base;
          localStorage.setItem("forge.gym.state.v2", JSON.stringify(value));
        } catch {
          // storage blocked: the app falls back to a fresh state
        }
      },
      { state, session: activeWorkoutForSession ?? null },
    );

    for (const route of routes) {
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      await page.goto(base + route, { waitUntil: "load" });
      await page
        .waitForFunction(() => !document.getElementById("forge-boot"), null, { timeout: 15000 })
        .catch(() => {});
      await page.addStyleTag({ content: SAFE_AREA_CSS + (args["system-font"] ? "" : FONT_CSS) });
      await page.waitForTimeout(400);

      const name = `${route.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}-${lang}-${scheme}-${w}x${h}`;
      // --open: tap the control with that name (aria-label or text, from the
      // start, any case) and check the sheet it opens instead of the page.
      let openFailed = false;
      // "Add food>Type or speak" taps each in turn, for a sheet opened from
      // another sheet.
      for (const label of sheet ? sheet.split(">").map((l) => l.trim()) : []) {
        openFailed = !(await page.evaluate((label) => {
          const want = label.toLowerCase();
          const hit = [...document.querySelectorAll("button, a[href], [role=button]")].find((el) =>
            (el.getAttribute("aria-label") || el.innerText || "")
              .trim()
              .toLowerCase()
              .startsWith(want),
          );
          hit?.click();
          return !!hit;
        }, label));
        await page.waitForTimeout(700);
        if (openFailed) break;
      }
      const scope = sheet ? "[role=dialog]" : undefined;
      const top = await page.evaluate(inspect, w);
      const designTop = await page.evaluate(designChecks, scope);
      if (shots) await page.screenshot({ path: join(shots, `${name}-top.png`) });
      // Scrolled to the end, nothing may still be behind the bar.
      await page.evaluate((inSheet) => {
        if (!inSheet) return window.scrollTo(0, document.documentElement.scrollHeight);
        for (const n of document.querySelectorAll("[role=dialog] *")) {
          const cs = getComputedStyle(n);
          if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight)
            n.scrollTop = n.scrollHeight;
        }
      }, !!sheet);
      await page.waitForTimeout(250);
      const end = await page.evaluate(inspect, w);
      const designEnd = await page.evaluate(designChecks, scope);
      // Screen-sized shots rather than one full-page shot, which draws the
      // fixed tab bar halfway down the page.
      if (shots && (await page.evaluate(() => window.scrollY > 0)))
        await page.screenshot({ path: join(shots, `${name}-end.png`) });

      const hydration = errors.filter((e) => /hydrat/i.test(e));
      const realErrors = errors.filter(
        (e) => !/hydrat/i.test(e) && !/Failed to load resource/i.test(e),
      );
      const overflow = [...new Set([...top.overflow, ...end.overflow])];
      const cut = [...new Set([...top.cut, ...end.cut])];
      const problems = [];
      const warnings = [];
      if (overflow.length)
        problems.push(`sideways overflow: ${overflow.slice(0, LIST).join("; ")}`);
      if (openFailed) problems.push(`nothing named "${sheet}" to open`);
      if (!sheet && end.under.length)
        problems.push(`under the tab bar at the end: ${end.under.slice(0, LIST).join("; ")}`);
      if (realErrors.length) problems.push(`page errors: ${realErrors.slice(0, 3).join(" | ")}`);
      if (cut.length)
        (args.strict ? problems : warnings).push(`cut-off text: ${cut.slice(0, LIST).join("; ")}`);
      if (hydration.length) warnings.push(`hydration mismatch (${hydration.length})`);
      const lowContrast = [...new Set([...designTop.contrast, ...designEnd.contrast])];
      const small = [...new Set([...designTop.small, ...designEnd.small])];
      if (lowContrast.length)
        problems.push(`low contrast: ${lowContrast.slice(0, LIST).join("; ")}`);
      if (small.length) problems.push(`tap area under 44 pt: ${small.slice(0, LIST).join("; ")}`);
      if (designTop.solid.length > 1)
        warnings.push(
          `${designTop.solid.length} solid accent controls: ${designTop.solid.join("; ")}`,
        );

      const label = `${route} ${lang}/${scheme} ${w}x${h}`;
      if (problems.length) {
        failed++;
        console.log(`✗ ${label}\n    ${[...problems, ...warnings].join("\n    ")}`);
      } else if (warnings.length) {
        warned++;
        console.log(`! ${label}\n    ${warnings.join("\n    ")}`);
      } else console.log(`✓ ${label}`);
      await page.close();
    }
    await context.close();
  }
}

await browser.close();
const total = routes.length * sizes.length * combos.length;
console.log(`\n${total - failed} of ${total} passed${warned ? `, ${warned} with warnings` : ""}.`);
process.exit(failed ? 1 : 0);
