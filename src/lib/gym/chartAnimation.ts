/** Recharts' own grow-in, shared so every chart draws the same way. Off under Reduce Motion. */
export const CHART_ANIMATION = {
  isAnimationActive:
    typeof window === "undefined" || !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  animationDuration: 1000,
  animationEasing: "ease-out",
} as const;
