/**
 * The house styles from DESIGN.md as named class strings, so a new screen
 * gets the app's buttons, badges and text styles by name instead of copying
 * a long run of utilities (and drifting a pixel at a time). Each string holds
 * only the look: position, width and margins stay at the call site
 * (`${button.primary} mt-4 w-full`). Older screens predate this file; move
 * them over when you touch them.
 *
 * Tailwind scans this file, so every class here is generated.
 */

export const button = {
  /** The one main action of a screen or sheet: Add to log, Start workout.
   *  52 pt (DESIGN.md §7 has the two exceptions). */
  primary:
    "flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-[16px] font-bold text-primary-foreground active:scale-[0.985] disabled:opacity-40",
  /** A second, quieter action next to or under a primary one. */
  secondary:
    "flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl bg-secondary px-4 text-[14px] font-bold text-secondary-foreground active:scale-[0.985] disabled:opacity-40",
  /** `secondary` in the accent: a light accent wash with accent text, for
   *  a second action that should read as the accent without competing with
   *  the solid main one above it (Weight's Import from scale). */
  tonal:
    "flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl bg-primary/15 px-4 text-[14px] font-bold text-primary-text active:scale-[0.985] disabled:opacity-40",
  /** Logs something in one tap, repeated in a row or grid (the drink
   *  quick-adds). Outlined so a card full of them stays calm. Give it a
   *  height (h-12, h-14) at the call site. */
  add: "relative flex items-center justify-center rounded-lg border-[1.5px] border-primary/60 text-foreground active:scale-95 active:bg-primary/10 disabled:opacity-40",
  /** Opens more choices next to `add` buttons ("+ ml", "+ Drink"). */
  more: "flex items-center justify-center gap-0.5 rounded-lg border-[1.5px] border-dashed border-foreground/25 text-muted-foreground active:scale-95 active:bg-foreground/5",
  /** Removes or cancels something for good. */
  destructive:
    "flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-destructive/10 px-4 text-[14px] font-semibold text-destructive-text active:scale-[0.985]",
  /** A round, icon-only button (settings, info, close). Always pass an
   *  aria-label. Drawn at 36 pt, tapped at 44 (tap-target). */
  icon: "tap-target flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground active:scale-90",
  /** The pencil that edits a card: `icon` sized and shaped, but in the same
   *  light accent wash as the card's own `badge.tonal` icon. */
  edit: "tap-target flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary-text active:scale-90",
} as const;

/** A choice chip: a time, a profile, a filter, a muscle. The picked one is
 *  tonal (a light accent wash, accent text and a thin accent ring), never
 *  solid: solid accent is for the screen's one main action. An unpicked one
 *  is glass (`glass-chip`: the card surface with a hairline ring; asked for,
 *  it was the look the user liked out of nine). Both draw their edge as an
 *  inset ring, so picking a chip doesn't change its size. 36 pt tall,
 *  tapped at 44 (tap-target). Width and padding at the call site when the
 *  chips share a row equally. */
export const chip = {
  base: "tap-target flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold active:scale-95",
  on: "bg-primary/10 text-primary-text ring-1 ring-inset ring-primary/50",
  off: "glass-chip text-secondary-foreground",
} as const;

/** The round icon badge in front of a card or row: solid accent once there's
 *  something to show, muted while empty. Size it at the call site
 *  (size-9 / size-10). */
export const badge = {
  on: "flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground",
  off: "flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground",
  /** A light accent wash with an accent icon: for a badge that sits under a
   *  screen's main solid action and shouldn't compete with it (Add food's
   *  list cards, under Scan). */
  tonal: "flex shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary-text",
} as const;

/** The type scale's named roles (DESIGN.md, Typography). */
export const text = {
  /** A screen's title (Screen draws it). */
  screenTitle: "text-[26px] font-bold leading-tight tracking-tight",
  /** A card's headline total ("2.58L", "1,650 / 2,400 kcal"). */
  total: "tabular text-[26px] font-bold leading-none",
  /** A card's or meal's own name. */
  cardTitle: "text-[17px] font-bold leading-tight",
  /** The small uppercase label over a value or section. */
  eyebrow: "text-[12px] font-semibold uppercase tracking-widest text-muted-foreground",
  /** A list row's main line. */
  rowTitle: "text-[15px] font-semibold",
  /** A list row's or card's secondary line. */
  meta: "text-[12.5px] text-muted-foreground",
  /** A note or explanation under a card's content. */
  note: "text-[12.5px] leading-snug text-muted-foreground",
} as const;
