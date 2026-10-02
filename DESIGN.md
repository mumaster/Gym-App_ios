# Forge design guide

How Forge looks, and how every new screen, card, sheet or button should look. Read it before UI work. Follow it for every new feature. When you decide something new about the look (a new component, a new size, an exception), write it down here in the same change, so the next feature can follow it.

The guide describes the app as it is. Where older code doesn't match it, the guide wins for new work. Move older code over when you're changing it anyway, not in a separate sweep.

The shared class strings are in `src/components/gym/ui.ts` (`button`, `badge`, `text`). Use them by name rather than retyping their utilities. The layout primitives are in `Screen.tsx` (`Screen`, `Card`, `SectionLabel`). The checklist at the end is the definition of done.

## 1. Principles

1. **It should feel like an iOS app.** Big readable numbers, rounded glass cards, bottom sheets, a floating tab bar, one-hand reach. When unsure, do what the Health, Fitness or Settings app would do.
2. **One main action per screen or sheet.** It is the only solid, full-width accent button (`button.primary`): Start workout, Add to log, Generate. Everything else is quieter.
3. **Calm by default.** Solid accent is reserved for:
   - the main action;
   - a badge that says "something is here";
   - progress (bars, rings, a done day).

   Buttons repeated in a row or grid (quick-adds) are outlined (`button.add`). A card full of solid buttons reads as noise and hides the one that matters.

4. **Evidence, with few citations on screen.** A sourced number gets a short plain-language explanation ("A week counts with 2+ training days"), never a study name. Sources live on Settings → Sources (see CLAUDE.md). The one exception is NEVO's reference line, which RIVM's conditions require.
5. **Thumb first.** Things you tap often sit low (the docked rest panel, pinned Start, the quick-adds). Things you read sit high. Nothing you need is hidden behind the tab bar once you've scrolled to the end.
6. **No dead scrolling.** A screen that fits stays still (Home always; Workout's My plan via `fitWhenShort`). A screen that doesn't fit scrolls cleanly and ends clear of the tab bar.
7. **Both themes, both languages and every accent are first-class.** Every change is looked at in dark and light, in English and Dutch, and never assumes green. Dutch strings run about 30% longer.
8. **Never a hardcoded colour,** except the content-intrinsic ones in §2.

## 2. Colour

All colours are tokens in `src/styles.css` (oklch). Dark is `:root` and light is `.light`. The accent comes from `.accent-*` classes, or from inline variables for a custom colour.

| Role                       | Use                                                       | Notes                                                                                                                                                  |
| -------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Page                       | `bg-background`, `text-foreground`                        | Pure black in dark mode, `#f2f2f7`-like off-white in light.                                                                                            |
| Card                       | `glass` (via `Card`)                                      | A translucent surface with a hairline border.                                                                                                          |
| Card header band           | `card-head`                                               | The accent mixed in at 11%. Used for a meal's header and a drink card's header. Put it at `-mx-4 -mt-4 px-4 py-3` inside a `p-4 overflow-hidden` card. |
| Secondary fill             | `bg-secondary text-secondary-foreground`                  | For quiet buttons and icon buttons.                                                                                                                    |
| Empty / inactive           | `bg-muted text-muted-foreground`                          | For an empty badge, a chip, a disabled-looking tile.                                                                                                   |
| Secondary text             | `text-muted-foreground`                                   | Captions, meta lines, notes.                                                                                                                           |
| Accent fill                | `bg-primary text-primary-foreground`                      | For the main action, a badge with content, progress. `text-primary-foreground` is dark on bright accents, so never hardcode white on accent.           |
| Accent text                | `text-primary-text`                                       | **Never `text-primary` for text.** `--primary-text` is contrast-adjusted for custom accents.                                                           |
| Tonal accent               | `bg-primary/15` (`/25` on a `card-head` band)             | For a soft, secondary accent surface: a selected chip, a small "+".                                                                                    |
| Hairlines                  | `border-border`, `bg-foreground/10`                       | Bar tracks are `bg-foreground/10`, which works on both themes.                                                                                         |
| Near a limit               | `bg-amber-500` / `text-amber-600 dark:text-amber-400`     | For nutrients and caffeine. Not for calories, where landing near the limit is the goal.                                                                |
| Over a limit / destructive | `bg-destructive`, `text-destructive`, `bg-destructive/10` |                                                                                                                                                        |

**Content-intrinsic exceptions** (fixed on purpose, documented where they're set):

- the splash's sparks;
- confetti;
- Home's water badge (`sky-400`);
- the camera's always-dark chrome;
- the white switch knob;
- the per-avatar `bg`/`ink`;
- the recap image (always dark).

Add new ones only with a reason, here and in a comment.

**Fixed-identity surfaces.** `bg-foreground`/`text-background` flip with the theme. Use them only on surfaces meant to follow the page. On something with its own colour (an accent swatch, an avatar, a knob), use that thing's paired ink.

**Never colour alone.** Every state that colour shows also has a shape, an icon or text. Done is a check. Missed is a dashed ring plus words. Over is "120 over".

## 3. Typography

The system font (SF on iOS). Sizes are pixel values on purpose, because iOS's own scale isn't Tailwind's. Use these roles; `text.*` in `ui.ts` names the common ones.

| px      | Weight                                 | Role                                                                                                              |
| ------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 30      | bold                                   | A hero number (Home's hero, the summary's big stat).                                                              |
| 26      | bold, `leading-tight tracking-tight`   | A screen title (`Screen` draws it), or a card's headline total (`text.total`, with `tabular`).                    |
| 20      | bold                                   | A sheet title (`BottomSheet` draws it).                                                                           |
| 17      | bold                                   | A card's or meal's own name (`text.cardTitle`).                                                                   |
| 16      | bold                                   | A primary button. **Every text input is 16 px**, or iOS zooms in on focus.                                        |
| 15      | semibold                               | A list row's main line (`text.rowTitle`).                                                                         |
| 14      | bold or semibold                       | Secondary buttons, values in rows.                                                                                |
| 13–13.5 | semibold                               | Chips, secondary lines, the labels on two-line buttons.                                                           |
| 12.5    | regular                                | Meta lines and notes (`text.meta`, `text.note`).                                                                  |
| 12      | semibold, uppercase, `tracking-widest` | An eyebrow or section label (`text.eyebrow`, `SectionLabel`).                                                     |
| 11 / 10 | semibold                               | Captions under a value; tab-bar labels (10). Use these sparingly, and never for anything you have to read to act. |

Numbers that change or line up use `tabular`. Weights use `formatLoad` ("80 kg", "BW +10 kg"). Dates use `useLocale()`. Thousands use the locale's separator (`toLocaleString(locale)`).

## 4. Spacing and layout

- **A 4 px grid.** Use Tailwind's steps. Use half steps (`py-2.5`, `gap-1.5`) only inside dense components.
- **Page:**
  - `Screen` gives `max-w-xl` and a `px-4` gutter, plus the sticky header and the tab-bar clearance;
  - put `space-y-4` between cards;
  - a `SectionLabel` sits above a group of cards.
- **Cards:**
  - padding is `p-4`;
  - rows inside a list card are `px-4 py-3` with dividers;
  - a card's header row has a badge (`size-10`), the label and the value, then the content below it with `mt-3`.
- **Sheets:** `px-5` content. The title and Done come from `BottomSheet`.
- **Touch targets** are at least 44 px tall: buttons, rows, chips you tap. Quick-adds are 48 (`h-12`) or 56 (`h-14`, two lines). Icon buttons are `size-9`, with the row giving them 44 px of hit area.
- **Fixed screens** (Home) split their height with `minmax(min-content, N fr)` rows. Their spacing scales with `100dvh` (see CLAUDE.md, "Equal spacing").

## 5. Shape

The radius tokens are rounder than stock Tailwind: `rounded-lg` is 16 px, `xl` 22, `2xl` 28, `3xl` 36.

| Thing                                                                | Radius         |
| -------------------------------------------------------------------- | -------------- |
| Card, primary/secondary button, input group                          | `rounded-2xl`  |
| Home tiles, the hero, sheets (top corners)                           | `rounded-3xl`  |
| Outlined keys in a grid (`button.add`/`more`), small tiles and cells | `rounded-lg`   |
| Inline notes, info boxes inside a card                               | `rounded-xl`   |
| Chips, pills, badges, icon buttons, the tab bar                      | `rounded-full` |

A tall pill reads as a blob. Anything taller than about 40 px that isn't a circle uses a rect radius (`rounded-lg`/`2xl`), not `rounded-full`.

## 6. Surfaces and layers

- `glass`: cards.
- `glass-strong`: sheets and floating pills (UpdateBanner).
- `glass-header`: Screen's header without a toolbar. With a toolbar it is solid `bg-background`.
- `glass-bar`: only the tab bar.
- `dock-backdrop`: the band behind a control pinned above the tab bar.
- `glow`: the accent shadow, for the one thing that should glow (Home's circle on `/`, the hero's CTA). Don't add more.

z-order:

| z   | Layer                                 |
| --- | ------------------------------------- |
| 30  | header                                |
| 35  | the rest blur                         |
| 40  | tab bar, session dock, pinned pop-ups |
| 50  | sheets                                |
| 60  | camera                                |
| 80  | welcome tour                          |
| 100 | splash                                |

**Only one sheet at a time.** Close the first before opening the second.

## 7. Components

Reuse these before building anything new. A new pattern that will appear twice goes into `ui.ts` or `components/gym/` and into this list.

- **Buttons** (`button.*` in `ui.ts`):
  - `primary` is the one main action, 52 px. In a tight sheet it may drop to 48.
  - `secondary` is a quieter action, 44 px.
  - `add` is an outlined one-tap key. It is repeated, so it is never solid.
  - `more` is a dashed key that opens more choices next to `add` keys.
  - `destructive` is a tinted red action. Deleting something big takes two taps (the button turns into "Tap again to delete").
  - `icon` is a round icon-only button. It always has an `aria-label`.
- **Badges** (`badge.on`/`off`): the round icon at the start of a card or row. Solid once there is content (a meal with food, a drink logged today), muted while empty.
- **Chips:**
  - a filter or choice chip is `rounded-full h-8–9 px-3 text-[13px]`, with `bg-primary/15 text-primary-text` (or solid) when selected and `bg-muted` otherwise;
  - an entry chip with ✕ removes that entry;
  - chip rows that can overflow scroll sideways (`no-scrollbar -mx-4 px-4 overflow-x-auto`) rather than wrap into a wall.
- **Sub-tabs:** `SegmentedTabs`, in `Screen`'s `toolbar`, with the tab in the URL (`validateSearch`, `?tab=`, `replace`, scrolled to the top on switch). Use 2–3 tabs. The first is the default and has no query.
- **Switches:** `SwitchRow` (white knob, label and one-line description). Settings apply straight away, with no save button.
- **Bottom sheets:** `BottomSheet`.
  - Done, the backdrop and a pull down all close it, and **a filled-in form is saved on close**. Multi-step setup wizards are the exception.
  - Use `tall` for a form that should fit without scrolling, `fullHeight` + `toolbar` for search, and `scrollKey` to reset the scroll.
- **Week strips:** Monday first, a weekday initial from `t.common.dow`, and today highlighted with `bg-foreground/[0.06]`. A day's marks:
  - done: a solid accent circle with a check;
  - planned: an accent ring;
  - missed: a dashed amber ring;
  - nothing: a faint dot.

  Each cell has an `aria-label` that says it in words.

- **Progress bars:** `h-2` on a card, `h-1.5` compact, `rounded-full`, with a `bg-foreground/10` track. The fill is `bg-primary`, or amber/destructive by status.
- **Empty states:** one muted line saying what goes here ("Nothing yet"), plus the action that fills it if there is one. No illustrations, no exclamation marks.
- **Loading:** `DumbbellLoader` (never a spinner of your own). A wait under about 300 ms gets no loader.
- **Lists of things you delete:** `SwipeToDelete`, plus a delete button in the item's own editor for keyboard and screen-reader users.
- **Info:** a small ⓘ button opens the longer explanation. Keep the card itself to one line of explanation at most.

## 8. Icons

Use lucide-react, at 16–20 px in rows and badges and 22–24 px in the tab bar, with a stroke width of 2 (2.2–2.5 on a small solid badge). Each concept has one icon; reuse it everywhere that concept appears:

| Concept       | Icon                                |
| ------------- | ----------------------------------- |
| Water         | `Droplet`                           |
| Coffee        | `Coffee`                            |
| Alcohol       | `Beer` / `Wine`                     |
| Strength      | `Dumbbell`                          |
| Cardio        | `CARDIO_ICONS` (per activity)       |
| Streak        | `Flame`                             |
| Records       | `Trophy`                            |
| Meals         | `Sunrise`, `Sun`, `Moon`, `Cookie`  |
| Exercises tab | `BookOpen` (not a magnifying glass) |

A decorative icon gets `aria-hidden`.

## 9. Motion

- **Press:** `active:scale-95` on small keys and `active:scale-[0.985]` on big buttons and cards. `active:scale-90` on icon buttons.
- **Curves:**
  - most things use iOS's sheet curve `cubic-bezier(0.32,0.72,0,1)`;
  - something that lands (the tab lozenge) uses a slight overshoot.
- **Durations:**
  - 140–220 ms for page transitions and small changes;
  - 320 ms for sheet glides;
  - 380 ms for the tab lozenge.

  Nothing in the UI should take longer than about 400 ms.

- **Reduce Motion** is always respected: no slides or scale, a fade at most. Check `prefers-reduced-motion` for every new animation.
- Don't animate on first paint from SSR without `fill-mode-both` (see CLAUDE.md, Splash screen).

## 10. Haptics

`haptic(ms)` on every tap that changes data. On iPhone, `installAppWideHaptics` puts the switch tick on every button automatically. Use `<HapticSwitch />` on a button tapped many times in a row (a stepper, a quick-add, Log set), and `data-no-haptic` to opt out. Never inside a form's submit button.

## 11. Accessibility

- **Text contrast:** 4.5:1 for text, 3:1 for the graphics you need (WCAG 2.x). Accent text uses `text-primary-text`.
- **Labels:**
  - an icon-only button has an `aria-label`;
  - a toggle has `aria-pressed` or `role="switch"`;
  - a tile with a hidden heading has `aria-label`.
- **Inputs:**
  - 16 px;
  - `type="text"` with `inputMode="decimal"`/`numeric` and `DECIMAL_INPUT_RE` for numbers (a comma or a point);
  - `selectOnFocus` on a prefilled value.
- **Valid HTML:** no interactive element inside a `<button>` or a `<label>`. Use a `<div>` with sibling buttons.
- **Gestures:** everything a gesture does (swipe to delete, pull to close) also has a button.

## 12. Copy and languages

- **Every visible string lives in `lib/gym/i18n.ts`,** in both `en` and `nl` (the type enforces it). Exercise names, muscles and split names stay English (see CLAUDE.md).
- **Tone:**
  - sentence case;
  - short;
  - talk to the user ("your", "je");
  - a friendly verb on buttons ("Log set", "Use these limits");
  - no exclamation marks except a finished workout and the end of a rest.
- **Numbers:** in the user's locale (Dutch decimal comma), and units in lower case with a space ("80 kg", "250 ml", "1,650 kcal"). Water uses `formatWaterAmount`/`formatLiters`.
- **Don't trust English to fit.** Check the Dutch string at 375 wide. Prefer a shorter word over a smaller font. Let names and row subtitles `line-clamp-2` rather than truncate when they can run long. Text that may truncate by design (a secondary list, like an exercise's equipment) carries `data-cut-ok`, so the UI check doesn't report it.
- **Don't repeat what the screen already says.** The Drinks cards dropped "· Today" because the week strip shows the day.

## 13. Sizes and safe areas

- **Target screens:** iPhone 375×812, 390×844, 402×874 and 430×932 points. 375×667 (SE) may scroll but must not break.
- **Safe areas:** use `safe-top`, `safe-bottom` and `--tab-bar-clearance`; never a fixed status-bar height.
- **Chromium has no inset**, so checks override it (59 px top, 34 px bottom; the ui-check script does this).
- **Scrolling content** reserves `--tab-bar-content-clearance` (Screen does). Pinned controls sit at `bottom-[calc(var(--tab-bar-clearance)+…)]` on a `dock-backdrop`.

## 14. Checklist (definition of done for UI work)

1. **Used** the components and `ui.ts` styles above. A new pattern used twice is added to `ui.ts` and to §7.
2. **Only tokens.**
   - Accent text uses `text-primary-text`.
   - There's only one solid primary action on the screen.
   - Repeated actions are outlined.
3. **Every string** is in `en` and `nl`.
   - No citations on screen.
   - New sourced numbers are listed on Settings → Sources.
4. **Touch targets** are 44 px or more.
   - Inputs are 16 px.
   - Icon buttons are labelled.
   - The HTML is valid, with no nested controls.
   - Reduce Motion is handled.
5. **Run `npm run ui-check`** (with `npm run dev` running) on the routes you changed. It reports sideways overflow, cut-off text, content left under the tab bar and page errors, at the four sizes in en/dark and nl/light. Fix every finding. A truncation that's intended gets `data-cut-ok` rather than being ignored. Pass `--seed` with data that exercises the new UI; an empty app hides most problems.
6. **Look at the screenshots** (`--shots`) in both themes. The script checks layout, not taste.
7. **Updated this guide** if you decided something new, and CLAUDE.md's feature section as usual.
