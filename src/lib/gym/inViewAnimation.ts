/**
 * Bars, columns and graph lines grow in when they are first SEEN, not when
 * they mount: a card below the fold (History → a week) used to play its
 * animation off screen. One shared IntersectionObserver covers every element
 * that carries one of the grow-in utilities (styles.css).
 *
 * How: a MutationObserver tags each such element `data-iv="0"` the moment it
 * is added (a microtask, before paint), which pauses its CSS animation; the
 * IntersectionObserver flips it to `"1"` when it scrolls into view and the
 * animation plays, once. It works for tabs and subtabs because those mount
 * their content when opened (a tab that mounts hidden is waited for too:
 * nothing intersects until it is shown). Elements are never re-tagged, and a
 * remounted screen is new elements, so it plays once per open screen.
 *
 * Without IntersectionObserver or under Reduce Motion nothing is tagged, so
 * the CSS behaves as before.
 */
export const IN_VIEW_SELECTOR = ".bar-grow, .bar-in-x, .bar-in-y, .chart-draw, .chart-dot";

/** Starts the observers; returns a cleanup. Safe to call on the server. */
export function installInViewAnimations(): () => void {
  if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return () => {};
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.setAttribute("data-iv", "1");
        io.unobserve(e.target);
      }
    },
    // Count a bar as seen a little inside the bottom edge, not the instant its
    // first pixel appears under the tab bar.
    { rootMargin: "0px 0px -6% 0px" },
  );

  const watch = (el: Element) => {
    if (el.hasAttribute("data-iv")) return;
    el.setAttribute("data-iv", "0");
    io.observe(el);
  };
  const scan = (root: ParentNode) => {
    if (root instanceof Element && root.matches(IN_VIEW_SELECTOR)) watch(root);
    root.querySelectorAll(IN_VIEW_SELECTOR).forEach(watch);
  };

  const mo = new MutationObserver((records) => {
    for (const r of records) r.addedNodes.forEach((n) => n instanceof Element && scan(n));
  });
  scan(document.body);
  mo.observe(document.body, { childList: true, subtree: true });
  return () => {
    mo.disconnect();
    io.disconnect();
  };
}
