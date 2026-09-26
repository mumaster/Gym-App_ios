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
      viaSwitch = overlay !== null;
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
