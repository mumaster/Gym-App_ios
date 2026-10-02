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
 *   - page errors (a hydration mismatch is listed as a warning).
 *
 * Usage (with `npm run dev` running):
 *   npm run ui-check -- --routes /,/nutrition?tab=drinks --seed seed.json --shots out/
 *
 * Options:
 *   --routes  comma-separated paths (default: the five tabs and Settings)
 *   --sizes   comma-separated WxH (default: 375x812,390x844,402x874,430x932)
 *   --combos  comma-separated language/scheme (default: en/dark,nl/light)
 *   --seed    a JSON file with GymState fields to start from (merged over a
 *             fresh state; language, colour scheme and welcomeSeen are set
 *             by the script). An empty app hides most problems, so seed data
 *             that exercises the screen you changed.
 *   --shots   a directory to save screenshots in (the top of each page, and
 *             its end when it scrolls)
 *   --url     the dev server (default: the first of :5199, :8080, :5173, :3000
 *             that answers)
 *   --strict  cut-off text fails the check too
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
const routes = String(args.routes ?? "/,/generate,/history,/exercises,/nutrition,/settings")
  .split(",")
  .filter(Boolean);
const sizes = String(args.sizes ?? "375x812,390x844,402x874,430x932")
  .split(",")
  .map((s) => s.split("x").map(Number));
const combos = String(args.combos ?? "en/dark,nl/light")
  .split(",")
  .map((c) => c.split("/"));
const seed = args.seed ? JSON.parse(readFileSync(String(args.seed), "utf8")) : {};
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
    const state = { ...seed, language: lang, colorScheme: scheme, welcomeSeen: true };
    await context.addInitScript((s) => {
      try {
        localStorage.setItem("forge.gym.state.v2", JSON.stringify(s));
      } catch {
        // storage blocked: the app falls back to a fresh state
      }
    }, state);

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
      const top = await page.evaluate(inspect, w);
      if (shots) await page.screenshot({ path: join(shots, `${name}-top.png`) });
      // Scrolled to the end, nothing may still be behind the bar.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(250);
      const end = await page.evaluate(inspect, w);
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
      if (overflow.length) problems.push(`sideways overflow: ${overflow.slice(0, 4).join("; ")}`);
      if (end.under.length)
        problems.push(`under the tab bar at the end: ${end.under.slice(0, 4).join("; ")}`);
      if (realErrors.length) problems.push(`page errors: ${realErrors.slice(0, 3).join(" | ")}`);
      if (cut.length)
        (args.strict ? problems : warnings).push(`cut-off text: ${cut.slice(0, 6).join("; ")}`);
      if (hydration.length) warnings.push(`hydration mismatch (${hydration.length})`);

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
