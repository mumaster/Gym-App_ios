/**
 * Visual stand-in for vibration where there is none. iOS WebKit has never
 * implemented navigator.vibrate, so haptic() does nothing on an iPhone;
 * there, the control that was just tapped plays a short press-and-ring
 * pulse instead (the `tap-confirm` animation in styles.css, applied via
 * a `data-tap-confirm` attribute).
 *
 * haptic() is called from inside click handlers and has no element of its
 * own, so a capture-phase click listener on the document remembers which
 * control the current click is on. It runs before React's own listener on
 * the root, and forgets the control once the click's dispatch is over, so
 * a haptic() that fires later (a timer, after an await) never pulses a
 * stale button.
 */

const CONTROL = "button, a, [role='button'], [role='switch'], [role='tab'], label";

let current: HTMLElement | null = null;
/** The current click landed on a HapticSwitch overlay, which already
 *  played the real tick — so switchTick() shouldn't add a second one. */
let viaSwitch = false;

if (typeof document !== "undefined") {
  document.addEventListener(
    "click",
    (e) => {
      if (!(e.target instanceof Element)) return;
      // The hidden switch switchTick() clicks isn't a real tap.
      if (e.target.closest("[data-switch-tick]")) return;
      // A tap on a HapticSwitch overlay belongs to the button it covers.
      const overlay = e.target.closest("[data-haptic-switch]");
      const target = (overlay?.parentElement ?? e.target).closest(CONTROL);
      current = target instanceof HTMLElement ? target : null;
      // A click an app-wide overlay passes on (see handOn) already ticked.
      viaSwitch = overlay !== null || handingOn;
      setTimeout(() => {
        current = null;
        viaSwitch = false;
      }, 0);
    },
    true,
  );
}

export const canVibrate = () => typeof navigator !== "undefined" && "vibrate" in navigator;

/**
 * A real haptic tick on iPhone, through a workaround rather than an API.
 * Safari 17.4+ supports `<input type="checkbox" switch>`, and on iOS 18+
 * toggling one plays the system's own switch haptic. Clicking a hidden
 * one here borrows that tick — the same trick the ios-haptics library
 * uses. Apple doesn't document it and could stop it in any release; it
 * may only fire during a tap (a timer-driven call might be silent); and it
 * is one fixed tick, so vibration patterns can't be reproduced. Since
 * iOS 26.5 WebKit treats this scripted click as untrusted and plays no
 * haptic (confirmed on the user's iOS 27 device), so it only helps on iOS
 * 18–26.4; newer iPhones get a tick only from buttons carrying a
 * HapticSwitch overlay. Where nothing is felt, the visual pulse below
 * still confirms the tap.
 */
export function switchTick() {
  if (typeof document === "undefined" || viaSwitch) return;
  try {
    const label = document.createElement("label");
    label.setAttribute("aria-hidden", "true");
    label.setAttribute("data-switch-tick", "");
    label.style.display = "none";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;
    label.appendChild(input);
    document.head.appendChild(label);
    label.click();
    label.remove();
  } catch {
    // Never let feedback break the action it confirms.
  }
}

/** Restart the pulse on the control the current click is on, if any. */
export function pulseTappedControl() {
  const el = current;
  if (!el) return;
  // A fixed ~6px squash whatever the control's size, so a big card doesn't
  // lurch while a small icon button still visibly presses in.
  const size = Math.max(el.offsetWidth, el.offsetHeight, 1);
  el.style.setProperty("--tap-scale", String(Math.min(0.985, Math.max(0.92, 1 - 6 / size))));
  // A data attribute, not a class: React rewrites `className` wholesale
  // when a button's look changes on the same tap (e.g. "Log set" after the
  // first set), which would wipe a class mid-animation.
  el.removeAttribute("data-tap-confirm");
  void el.offsetWidth; // restart the animation on a rapid second tap
  el.setAttribute("data-tap-confirm", "");
  const done = (e: AnimationEvent) => {
    // animationend bubbles, so ignore a child's own animation finishing.
    if (e.target !== el || !e.animationName.startsWith("tap-confirm")) return;
    el.removeAttribute("data-tap-confirm");
    el.removeEventListener("animationend", done);
  };
  el.addEventListener("animationend", done);
}

/**
 * A haptic on every button in the app, not just the ones carrying a
 * `<HapticSwitch />`.
 *
 * - **iPhone** (no vibration API): the same invisible switch overlay
 *   HapticSwitch renders is added to every control from the outside — a
 *   MutationObserver keeps each `button`, link and `role=button/tab/switch`
 *   supplied with one as React renders them. Only a real finger on the
 *   switch's label ticks (iOS 26.5+), so the overlay has to be inside the
 *   control. Controls that already have one are left alone.
 * - **Vibration-capable devices** (Android): a short buzz on any control
 *   tap that didn't already call haptic() during that click.
 *
 * Skipped, so the overlay never changes what a tap does:
 * - form submit buttons (the label's activation would replace the submit);
 * - controls nested in another control or inside a `<label>`;
 * - `data-no-haptic` subtrees;
 * - a static control with absolutely positioned descendants — the overlay
 *   needs the control to be `relative`, and making it relative would move
 *   those descendants.
 *
 * Disabled controls hide the overlay in styles.css, so a tap that does
 * nothing doesn't tick.
 *
 * **Order matters.** Unlike HapticSwitch, which React renders and keeps,
 * this overlay is foreign to React: if the tap reached the control first,
 * React would re-render before the switch toggles — replacing a button's
 * text ("Edit" → "Done") or unmounting it wipes the overlay, and a detached
 * switch never toggles (measured: no `change`). A router link would also
 * cancel the click, and with it the switch. So the tap stops at the label,
 * the switch toggles (the tick), and only then — from the switch's
 * `change` event, still inside the same tap, so share sheets and file
 * pickers keep their user activation — is the control clicked (`handOn`).
 * React's capture-phase handlers see the tap twice (the original and the
 * handed-on click); bubble handlers see it once.
 */
const HOSTS = "button, a[href], [role='button'], [role='tab'], [role='switch']";

/** How long the buzz is on devices that vibrate — a light tap, shorter than
 *  haptic()'s own 30 ms default so ordinary buttons stay subtle. A UI
 *  choice, not a measured value. */
const TAP_VIBRATION_MS = 10;

let hapticThisClick = false;
/** A handed-on click is being dispatched. */
let handingOn = false;
/** haptic() already buzzed for the current click. */
export function markHaptic() {
  hapticThisClick = true;
}

function handOn(label: HTMLLabelElement) {
  const host = label.parentElement;
  if (!(host instanceof HTMLElement)) return;
  handingOn = true;
  try {
    host.click();
  } finally {
    handingOn = false;
  }
}

function makeOverlay(): HTMLLabelElement {
  const label = document.createElement("label");
  label.setAttribute("aria-hidden", "true");
  label.setAttribute("data-haptic-switch", "");
  label.setAttribute("data-auto-haptic", "");
  // inset comes from styles.css ([data-auto-haptic]), so a tap-target can
  // grow it to 44 pt.
  label.style.cssText =
    "position:absolute;z-index:10;border-radius:inherit;cursor:pointer;" +
    "-webkit-tap-highlight-color:transparent;touch-action:manipulation";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  input.tabIndex = -1;
  input.style.cssText = "visibility:hidden;position:absolute;width:1px;height:1px";
  // The switch's own activation click mustn't reach the control's handler
  // a second time.
  input.addEventListener("click", (e) => e.stopPropagation());
  input.addEventListener("change", () => handOn(label));
  label.appendChild(input);
  label.addEventListener("click", (e) => e.stopPropagation());
  return label;
}

/** Controls already found unsuitable, so each mutation's rescan skips the
 *  descendant walk for them. */
const rejected = new WeakSet<HTMLElement>();

function canHost(el: HTMLElement): boolean {
  if (rejected.has(el)) return false;
  for (const child of el.children) if (child.hasAttribute("data-haptic-switch")) return false;
  if (!suitable(el)) {
    rejected.add(el);
    return false;
  }
  return true;
}

function suitable(el: HTMLElement): boolean {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return false;
  if (el.closest("[data-no-haptic], label, [data-haptic-switch]")) return false;
  if (el.parentElement?.closest(HOSTS)) return false;
  if (el instanceof HTMLButtonElement && el.form && el.type === "submit") return false;
  if (getComputedStyle(el).position === "static") {
    for (const d of el.querySelectorAll("*")) {
      if (getComputedStyle(d).position === "absolute") return false;
    }
    el.style.position = "relative";
  }
  return true;
}

/** React has claimed this node (hydrated or rendered it). Adding a child
 *  to server-rendered markup React hasn't hydrated yet — a route chunk
 *  still loading — makes hydration fail, so those wait for a later scan. */
const reactOwned = (el: Element) => Object.keys(el).some((k) => k.startsWith("__reactFiber$"));

function supplyOverlays() {
  for (const el of document.querySelectorAll<HTMLElement>(HOSTS)) {
    if (!reactOwned(el)) continue;
    if (canHost(el)) el.appendChild(makeOverlay());
  }
}

let installed = false;
/** Call once on the client after hydration (RootComponent's mount effect). */
export function installAppWideHaptics() {
  if (installed || typeof document === "undefined") return;
  installed = true;

  if (canVibrate()) {
    // A HapticSwitch's own switch clicks itself when its label is tapped;
    // that second click isn't a new tap.
    const switchClick = (e: Event) =>
      e.target instanceof HTMLInputElement && e.target.closest("[data-haptic-switch]") !== null;
    document.addEventListener(
      "click",
      (e) => {
        if (!switchClick(e)) hapticThisClick = false;
      },
      true,
    );
    document.addEventListener("click", (e) => {
      if (hapticThisClick || switchClick(e) || !(e.target instanceof Element)) return;
      const host = e.target.closest(HOSTS);
      if (!host || host.matches(":disabled, [aria-disabled='true']")) return;
      if (host.closest("[data-no-haptic]")) return;
      navigator.vibrate(TAP_VIBRATION_MS);
    });
    return;
  }

  supplyOverlays();
  // Hydration claims server-rendered nodes without changing the DOM, so no
  // mutation announces it: rescan a few times while route chunks load.
  for (const ms of [500, 1500, 3000, 6000]) setTimeout(supplyOverlays, ms);
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      supplyOverlays();
    });
  }).observe(document.body, { childList: true, subtree: true });
}
