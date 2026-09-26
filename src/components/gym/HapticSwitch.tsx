/**
 * A real haptic tick on iPhone for the button it sits in.
 *
 * iOS has no vibration API for the web, but toggling a native
 * `<input type="checkbox" switch>` plays the system switch haptic (iOS 18+).
 * Since iOS 26.5 WebKit only does that for a trusted click — a script
 * calling `label.click()` (tapFeedback.ts's switchTick) stays silent — so
 * the finger has to land on the switch's label itself. This lays an
 * invisible label over the whole button: the tap lands on it, toggles the
 * hidden switch (tick), and bubbles on to the button so its onClick runs as
 * normal. The switch's own activation click is stopped from bubbling, so
 * the button's handler still runs once. Same approach as the ios-haptics
 * and tappt libraries.
 *
 * The button must be `relative`. Render nothing for a disabled button, so
 * a tap that does nothing doesn't tick either. Elsewhere (Android, desktop)
 * the overlay just toggles a hidden checkbox nobody reads.
 */
export function HapticSwitch({ disabled = false }: { disabled?: boolean }) {
  if (disabled) return null;
  return (
    <label
      aria-hidden="true"
      data-haptic-switch=""
      className="absolute inset-0 z-10 cursor-pointer rounded-[inherit] [-webkit-tap-highlight-color:transparent] [touch-action:manipulation]"
    >
      <input
        ref={(el) => el?.setAttribute("switch", "")}
        type="checkbox"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="invisible absolute size-px"
      />
    </label>
  );
}
