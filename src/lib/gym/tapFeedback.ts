/**
 * Visual stand-in for vibration where there is none. iOS WebKit has never
 * implemented navigator.vibrate, so haptic() does nothing on an iPhone;
 * there, the control that was just tapped plays a short press-and-ring
 * pulse instead (the `tap-confirm` animation in styles.css).
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

if (typeof document !== "undefined") {
  document.addEventListener(
    "click",
    (e) => {
      // The hidden switch switchTick() clicks isn't a real tap.
      if (e.target instanceof Element && e.target.closest("[data-switch-tick]")) return;
      const target = e.target instanceof Element ? e.target.closest(CONTROL) : null;
      current = target instanceof HTMLElement ? target : null;
      setTimeout(() => (current = null), 0);
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
 * is one fixed tick, so vibration patterns can't be reproduced. Where it
 * does nothing, the visual pulse below still confirms the tap.
 */
export function switchTick() {
  if (typeof document === "undefined") return;
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
  el.classList.remove("tap-confirm");
  void el.offsetWidth; // restart the animation on a rapid second tap
  el.classList.add("tap-confirm");
  el.addEventListener("animationend", () => el.classList.remove("tap-confirm"), { once: true });
}
