# Forge design guide

How Forge looks, and how every new screen, card, sheet or button should look. Read it before UI work. Follow it for every new feature. When you decide something new about the look (a new component, a new size, an exception), write it down here in the same change, so the next feature can follow it.

The guide describes the app as it is. Where older code doesn't match it, the guide wins for new work. Move older code over when you're changing it anyway, not in a separate sweep.

The shared class strings are in `src/components/gym/ui.ts` (`button`, `chip`, `badge`, `text`). Use them by name rather than retyping their utilities. The layout primitives are in `Screen.tsx` (`Screen`, `Card`, `SectionLabel`). The checklist at the end is the definition of done.

## 1. Principles

1. **It should feel like an iOS app.** Big readable numbers, rounded glass cards, bottom sheets, a floating tab bar, one-hand reach. When unsure, do what the Health, Fitness or Settings app would do.
2. **One main action per screen or sheet.** It is the only solid, full-width accent button (`button.primary`): Start workout, Add to log, Generate. Everything else is quieter.
3. **Calm by default.** Solid accent is reserved for:
   - the main action;
   - a badge that says "something is here";
   - progress (bars, rings, a done day).

   Buttons repeated in a row or grid (quick-adds, the "+" on every food row) are outlined (`button.add`). A picked chip is tonal (`chip.on`), not solid. A card full of solid buttons reads as noise and hides the one that matters.

4. **Evidence, with few citations on screen.** A sourced number gets a short plain-language explanation ("A week counts with 2+ training days"), never a study name. Sources live on Settings → Sources (see CLAUDE.md). The one exception is NEVO's reference line, which RIVM's conditions require.
5. **Thumb first.** Things you tap often sit low (the docked rest panel, pinned Start, the quick-adds). Things you read sit high. Nothing you need is hidden behind the tab bar once you've scrolled to the end.
6. **No dead scrolling.** A screen that fits stays still (`Screen`'s `fitWhenShort`: Home, Workout's My plan). A screen that doesn't fit scrolls cleanly and ends clear of the tab bar.
7. **Both themes, both languages and every accent are first-class.** Every change is looked at in dark and light, in English and Dutch, and never assumes green. Dutch strings run about 30% longer.
8. **Never a hardcoded colour,** except the content-intrinsic ones in §2.

## 2. Colour

All colours are tokens in `src/styles.css` (oklch). Dark is `:root` and light is `.light`. The accent comes from `.accent-*` classes, or from inline variables for a custom colour.

| Role                       | Use                                                                             | Notes                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Page                       | `bg-background`, `text-foreground`                                              | Pure black in dark mode, `#f2f2f7`-like off-white in light.                                                                                                                                                                                                                                                                                                                                |
| Card                       | `glass` (via `Card`)                                                            | A translucent surface with a hairline border.                                                                                                                                                                                                                                                                                                                                              |
| Card header band           | `card-head`                                                                     | The accent mixed in at 11%. Used for a meal's header, a drink card's header, the Food tab's day summary ("Today · Training day"), the Weight tab's card ("Today · 96.4 kg"), a superset in a generated plan ("Superset · 3 rounds · 120s rest per round", with the arrows that move the pair) and every `ListCard`. Put it at `-mx-4 -mt-4 px-4 py-3` inside a `p-4 overflow-hidden` card. |
| Secondary fill             | `bg-secondary text-secondary-foreground`                                        | For quiet buttons and icon buttons.                                                                                                                                                                                                                                                                                                                                                        |
| Empty / inactive           | `bg-muted text-muted-foreground`                                                | For an empty badge, a chip, a disabled-looking tile.                                                                                                                                                                                                                                                                                                                                       |
| Secondary text             | `text-muted-foreground`                                                         | Captions, meta lines, notes.                                                                                                                                                                                                                                                                                                                                                               |
| Accent fill                | `bg-primary text-primary-foreground`                                            | For the main action, a badge with content, progress. `text-primary-foreground` is near-black on every preset in the dark theme and white in the light one, so never hardcode white on accent.                                                                                                                                                                                              |
| Accent text                | `text-primary-text`                                                             | **Never `text-primary` for text.** `--primary-text` reaches 4.5:1 in both themes (see "Accents in the light theme" below).                                                                                                                                                                                                                                                                 |
| Tonal accent               | `bg-primary/10` + `text-primary-text` (`chip.on` adds a `ring-primary/50` ring) | A picked chip, a quiet accent action ("Do it today", "Apply to my limits"). Behind an icon only, `/15`–`/25` is fine; with text, stay at `/10` or the text drops under 4.5:1 in light mode.                                                                                                                                                                                                |
| Hairlines                  | `border-border`, `bg-foreground/10`                                             | Bar tracks are `bg-foreground/10`, which works on both themes.                                                                                                                                                                                                                                                                                                                             |
| Near a limit, warnings     | `bg-warning`, `text-warning-text`, `bg-warning/10 border-warning/50`            | Amber, per theme. Bars for nutrients and caffeine near their limit (not calories, where landing near the limit is the goal), and warning notes. Never `amber-*` utilities.                                                                                                                                                                                                                 |
| Over a limit / destructive | `bg-destructive`, `text-destructive-text`, `bg-destructive/10`                  | Red text always uses `text-destructive-text`, which reads at 4.5:1 on a card and on a red tint.                                                                                                                                                                                                                                                                                            |

**Content-intrinsic exceptions** (fixed on purpose, documented where they're set):

- the splash's sparks;
- confetti;
- the camera's always-dark chrome;
- the white switch knob;
- the per-avatar `bg`/`ink`;
- the recap image (always dark);
- the muscle-pairing pop-up's yellow (`SUGGESTED_COLOR`, matching the hatch on the map).

Add new ones only with a reason, here and in a comment.

**Accents in the light theme.** The six presets are bright colours made to glow on black; on the off-white page they all fail as text (green 1.2:1). In the light theme each preset is one colour (`.light.accent-*` in `styles.css`): the preset blended towards black until it reaches 4.5:1 against `#e6e7ea`, used for text, fills, bars and rings alike, with white on top (5.3–5.8:1). A custom colour follows the same rule (`readableAccentText`), and its dark-theme fill gets 3:1 (`visibleAccentFill`). In the dark theme every preset carries near-black ink, since white on the blue, purple and pink fills was only 2.3–2.9:1. `accentInk.test.ts` pins the values.

**Fixed-identity surfaces.** `bg-foreground`/`text-background` flip with the theme. Use them only on surfaces meant to follow the page. On something with its own colour (an accent swatch, an avatar, a knob), use that thing's paired ink.

**Never colour alone.** Every state that colour shows also has a shape, an icon or text. Done is a check. A missed session is said in words ("Missed Monday"). Over is "120 over".

## 3. Typography

The system font (SF on iOS). Sizes are pixel values on purpose, because iOS's own scale isn't Tailwind's. Use these roles; `text.*` in `ui.ts` names the common ones.

| px      | Weight                                 | Role                                                                                                                                                                  |
| ------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 30      | bold                                   | A hero number (the summary's big stat, a meal's calories).                                                                                                            |
| 26      | bold, `leading-tight tracking-tight`   | A screen title (`Screen` draws it), a session's exercise name, or a card's headline total (`text.total`, with `tabular`).                                             |
| 20      | bold                                   | A sheet title (`BottomSheet` draws it), a tile's total.                                                                                                               |
| 17      | bold                                   | A card's or meal's own name (`text.cardTitle`).                                                                                                                       |
| 16      | bold                                   | A primary button. **Every text input is 16 px**, or iOS zooms in on focus.                                                                                            |
| 15      | semibold                               | A list row's main line (`text.rowTitle`).                                                                                                                             |
| 14      | bold or semibold                       | Secondary buttons, values in rows.                                                                                                                                    |
| 13–13.5 | semibold                               | Chips, secondary lines, the labels on two-line buttons.                                                                                                               |
| 12.5    | regular                                | Meta lines and notes (`text.meta`, `text.note`).                                                                                                                      |
| 12      | semibold, uppercase, `tracking-widest` | An eyebrow or section label (`text.eyebrow`, `SectionLabel`).                                                                                                         |
| 11 / 10 | semibold                               | Captions under a value; tab-bar labels and week-strip initials (10). Use these sparingly, and never for anything you have to read to act. Nothing is smaller than 10. |

No other sizes: no `text-sm`/`text-lg` and no in-between pixel values (11.5, 14.5, 18…).

Numbers that change or line up use `tabular`. Weights use `formatLoad` ("80 kg", "BW +10 kg"). Dates use `useLocale()`. Thousands use the locale's separator (`toLocaleString(locale)`).

## 4. Spacing and layout

- **A 4 px grid.** Use Tailwind's steps. Use half steps (`py-2.5`, `gap-1.5`) only inside dense components.
- **Page:**
  - `Screen` gives `max-w-xl` and a `px-4` gutter, plus the sticky header and the tab-bar clearance;
  - content starts 20 pt under the header's last row (the title, or the sub-tabs and search field): the header's `pb-2` plus `main`'s `pt-3`. The first card on a screen or sub-tab has no top margin of its own. History's first cards had `mt-1` or `mt-4` and Nutrition's week strip `mt-1`, so the gap under the sub-tabs was 20, 24 or 36 pt depending on the tab (reported);
  - put `space-y-4` between cards;
  - a `SectionLabel` sits above a group of cards.
- **Cards:**
  - padding is `p-4`;
  - rows inside a list card are `px-4 py-3` with dividers;
  - a card's header row has a badge (`size-10`), the label and the value, then the content below it with `mt-3`.
- **Sheets:** `px-5` content. The title and Done come from `BottomSheet`.
- **Touch targets** take taps from at least 44 × 44 pt (Apple's Human Interface Guidelines). A control can be drawn smaller (a 36 pt chip, a 32 pt icon button) when it carries `tap-target`, which centres a 44 × 44 pt hit area on it and grows the haptic overlay with it. Then:
  - keep 44 pt between neighbours' centres (36 pt chips in wrapping rows: `gap-y-2`), or their areas overlap;
  - give a sideways-scrolling row vertical room (`-my-1 py-1` for 36 pt chips), since it clips what sticks out;
  - put it on a static or relative control (it sets `position: relative`), and not on one with `overflow-hidden` or `truncate` (put `truncate` on an inner span).

  Quick-adds are 48 (`h-12`) or 56 (`h-14`, two lines) and need nothing extra. Where 44 can't fit, the control carries `data-target-ok` and a comment saying why: the 11-point session-effort scale (44 tall, as wide as the row allows).

- **Screens that should fit** (Home, Workout's My plan) are ordinary `Screen`s with `fitWhenShort`: pinned while the content ends above the tab bar, scrolling when it doesn't. Make room by combining or cutting, never by shrinking cards' padding or type below the house sizes. Spare height on a taller phone goes to content, not space: Home adds extras in a fixed order, each at a fixed height, only while they fit (CLAUDE.md, "Home dashboard"). Home's own fixed grid with height-scaled spacing is gone; it fits from 390×844 up with the check-in open (CLAUDE.md, "Home dashboard").

## 5. Shape

The radius tokens are rounder than stock Tailwind: `rounded-lg` is 16 px, `xl` 22, `2xl` 28, `3xl` 36.

| Thing                                                                | Radius         |
| -------------------------------------------------------------------- | -------------- |
| Card, primary/secondary button, input group                          | `rounded-2xl`  |
| Sheets (top corners)                                                 | `rounded-3xl`  |
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
- `glow`: the accent shadow, for the one thing that should glow (Home's circle on `/`). Don't add more.

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
  - `primary` is the one main action, 52 pt, 16 px bold. Every main action uses it, never a hand-built copy (about 35 had drifted to 48, 52 and 56 pt with 15–17 px text). Width, margins and `flex-1` go at the call site; it has no glow (the glow is Home's circle and the hero's button). Two exceptions: the session's Log set is 56, the button pressed dozens of times a workout with tired hands; Add food's review form uses 48 so it fits without scrolling. Compact actions beside an input (water's Add, bodyweight's Log) and inside the rest panel stay smaller.
  - `secondary` is a quieter action, 44 px.
  - `add` is an outlined one-tap key. It is repeated, so it is never solid.
  - `more` is a dashed key that opens more choices next to `add` keys.
  - `destructive` is a tinted red action. Deleting something big takes two taps (the button turns into "Tap again to delete").
  - `icon` is a round icon-only button. It always has an `aria-label`.
  - **Edit is always the same control** (asked for: Exercises had a pill with "Edit" next to an icon, Add food a small round pencil, Workout and Food a sliders icon, in sizes from 32 to 40 pt). It's `button.icon` (36 pt, a 44 pt tap area, `bg-secondary`) with lucide's `Pencil` at 16 px, and no visible text: the `aria-label` says what it edits ("Edit Push / Pull / Legs", "Set daily limits"). It turns into a `Check` while an edit mode it switched on is active (Add food's lists). The same pencil for every kind of change — a list, a plan, the gear of a gym, the day's limits, water settings — so it reads as one control; `Settings2` (sliders) isn't used for it any more. Sit it at the right end of the header or band of the thing it changes.
- **Badges** (`badge.on`/`off`): the round icon at the start of a card or row. Solid once there is content (a meal with food, a drink logged today), muted while empty. `badge.tonal` is for a badge that sits under a screen's main solid action and shouldn't compete with it (Add food's list cards). A Settings row's icon is always solid, like iOS Settings.
- **Chips** (`chip.*` in `ui.ts`):
  - a filter or choice chip is 32–40 pt tall with `tap-target`; the picked one is `chip.on` (tonal: a light accent wash, accent text, a thin accent ring), every other one `chip.off`: glass (`glass-chip`, the card surface with a hairline drawn as an inset ring, so a chip keeps its size when picked; no backdrop blur, since a screen can hold dozens). Asked for: unpicked chips had nine looks (`bg-muted`, `bg-secondary`, `glass`…), and glass was the one liked. Never solid: solid accent is for the main action. A segmented control's unpicked segments (a track with plain text) aren't chips and stay plain;
  - an entry chip with ✕ removes that entry;
  - chip rows that can overflow scroll sideways (`no-scrollbar -mx-4 px-4 overflow-x-auto`, plus vertical room for the tap areas) rather than wrap into a wall.
- **Screen headers:** a tab's header is its title alone (plus its sub-tabs or search in the `toolbar`). No subtitle, and never a count or stat: a number belongs in the content it describes (Exercises' "253 of 256 exercises" sits at the top of its list). A subtitle is only for pages you drill into (a session's date), setup pages that say what they're for (Settings, Equipment), and Home, whose greeting title takes today's date under it.
- **Tab bar:** five cells in a glass capsule. Four tabs show an icon over a 10 px label: accent when selected (with the glass lozenge behind it), `text-muted-foreground` otherwise. Home is the circle in the middle and has exactly two looks:
  - on `/`: a solid accent circle with its glow, the bar's one solid accent;
  - anywhere else: an empty circle with a hairline ring (`ring-foreground/15`) and a muted icon, the same grey as the other inactive tabs.

  The accent means "you are here", so it never appears on the circle off Home: not dimmed, not mixed into the background, not as a tinted fill (both were tried and read as half-active). The inactive circle has no fill either, since a grey fill looks like the selection lozenge.

- **Sub-tabs:** `SegmentedTabs`, in `Screen`'s `toolbar`, with the tab in the URL (`validateSearch`, `?tab=`, `replace`, scrolled to the top on switch). Use 2–3 tabs. The first is the default and has no query.
- **Switches:** `SwitchRow` (white knob, label and optional one-line description; `className` replaces its padding inside a padded card). Every on/off setting uses it, never an "On/Off" pill. Settings apply straight away, with no save button.
- **Bottom sheets:** `BottomSheet`.
  - Done, the backdrop and a pull down all close it, and **a filled-in form is saved on close**. Multi-step setup wizards are the exception.
  - Use `tall` for a form that should fit without scrolling, `fullHeight` + `toolbar` for search, and `scrollKey` to reset the scroll.
- **Week strips:** Monday first, a weekday initial from `t.common.dow`, and today highlighted with `bg-foreground/[0.06]`. A day's marks:
  - done: a solid accent circle with a check;
  - planned: an accent ring;
  - nothing: a faint dot.

  A plan's own strip (`RotationWeekStrip`) marks the next session with a tonal cell, a done one with an outline and a check, and a skipped one struck through; done cells aren't faded (that dropped them under 4.5:1).

  Each cell has an `aria-label` that says it in words.

- **Progress bars:** `h-2` on a card, `h-1.5` compact, `rounded-full`, with a `bg-foreground/10` track. The fill is `bg-primary`, or `bg-warning`/`bg-destructive` by status.
- **Empty states:** one muted line saying what goes here ("Nothing yet"), plus the action that fills it if there is one. No illustrations, no exclamation marks.
- **Loading:** `DumbbellLoader` (never a spinner of your own). A wait under about 300 ms gets no loader.
- **Lists of things you delete:** `SwipeToDelete`, plus a delete button in the item's own editor for keyboard and screen-reader users.
- **Swapping a food, keeping its grams:** a food on a list (the list reader's check screen, a recipe's ingredients) is a row-wide button with `ArrowLeftRight` in the accent after its name; the grams sit in their own field beside it. Swapping opens Add food in swap mode, with the search filled in and the grams carried over (still editable), so a wrong match never loses a weighed amount. A line that still needs a food reads "Pick a food" in `text-warning-text`.
- **Profile avatar:** a tint of the accent (`bg-primary/15`, `ring-primary/35`, accent icon), never solid and never plain grey: it follows the picked colour without competing with the screen's main action.
- **List cards** (Exercises' muscle groups and Add food's Favourites, Recent, Meals, Recipes, and the search's Your foods and Foods; `components/gym/ListCard.tsx`): built like a meal's card on the Food tab. A `card-head` band with a 36 pt badge (`badge.tonal`, a light accent wash with an accent icon, once the list has something, muted while empty: not solid like a meal's badge, because Scan above is the screen's one solid accent and four solid circles under it competed with it), a 17 px bold title and a 12.5 px count ("3 foods", "Nothing yet"), and the rows under it divided by hairlines (`border-t border-border`), not separate glass pills. A food row is its name over `PortionLine` with the calories first ("31 g · 137 kcal · P 3 · C 19 · F 5"), then the star and the outlined "+". The Favourites card has no star column (every row would show a filled star); its pencil turns each "+" into a star-off button instead. Header actions are the Edit button (see Buttons) and a tonal "+ New" pill: "New" is spelled out because a bare "+" in a band means "add to the log". A long list of cards can fold (`fold`): the whole band is the button, with a chevron pointing right when closed and down when open, folded by default, remembered per device, and never folded while searching or filtering, so nothing found is hidden. On a card inside a sheet the band's count uses `text-foreground/75`, since muted grey measured 4.43:1 there in the dark theme.
- **One way in per kind of input.** Where there are several ways to add something, the main one is one full-width solid button with a one-line description of what it covers ("Scan — Barcode, label, note or plate"), and the others share one grouped card of full-width rows with an icon and a chevron. Not a grid of half-width buttons: their labels wrap in Dutch. Variations of one action are modes inside it, not buttons beside it.
- **The camera** (`FoodScanner`) is the one place every food photo is taken: barcode, label, note and plate are modes, switched by a segmented capsule above the shutter or a sideways swipe, like the iOS camera. A mode that reads by itself (Barcode) shows no shutter, keeping the row's height so switching doesn't jump. The frame's shape shows what fits in it (a wide box, a table, a sheet, a circle). Its chrome stays dark in both themes.
- **Search field:** `SearchField` (`components/gym/SearchField.tsx`), the one search input: 48 pt, `glass-chip` like an unpicked chip, a 16 px magnifier, 16 px text and a clear button once something is typed. Add food, Exercises and Your current lifts had three different ones.
- **Card bands:** a card whose content is more than a list (a plan, a chart, a summary) opens with `CardHead` (`components/gym/CardHead.tsx`): the `card-head` band with a tonal badge (muted while empty), a 17 px bold title (two lines at most), an optional 12.5 px subtitle in `text-foreground/75` and its actions (the Edit pencil). It replaces a grey small-caps section label above the card or an eyebrow inside it. A list of rows is a `ListCard`, which draws the same band. Used on the Workout tab's plan and cardio cards and every block of Build your own (Quick start, Session settings, Recommended today, Muscle map), History's week cards (one `ListCard` per week, the sessions as rows), History's Progress chart, Records, Volume, Streak, Training load, Sets this week and Muscles to grow, and a session's page (its effort card and each exercise). Not used, on purpose: Settings (a list of setting rows under small-caps group labels, like iOS Settings), the exercise cards while lifting (they carry the logging controls and the current-exercise highlight), and the watch data card. A pill in a band (a PR) sits on `bg-background`: a 15% accent pill on the band's tint left its text at 4.17:1 in the light theme. A tonal `chip.on` button doesn't go in a band either ("Gebruik" measured 4.44:1); put it in the card's body. One-tap starts are rows in a `ListCard`, not a sideways row of small cards: those were cut off by the screen edge and a picked card's ring was clipped by the scroller.
- **Info:** a small ⓘ button opens the longer explanation. Keep the card itself to one line of explanation at most.

## 8. Icons

Use lucide-react, at 16–20 px in rows and badges and 22–24 px in the tab bar, with a stroke width of 2 (2.2–2.5 on a small solid badge). Each concept has one icon; reuse it everywhere that concept appears:

| Concept                     | Icon                                                            |
| --------------------------- | --------------------------------------------------------------- |
| Water                       | `Droplet`                                                       |
| Coffee                      | `Coffee`                                                        |
| Alcohol                     | `Beer` / `Wine`                                                 |
| Strength                    | `Dumbbell`                                                      |
| Cardio                      | `CARDIO_ICONS` (per activity)                                   |
| Streak                      | `Flame`                                                         |
| Records                     | `Trophy`                                                        |
| Meals                       | `Sunrise`, `Sun`, `Moon`, `Cookie`                              |
| Exercises tab               | `BookOpen` (not a magnifying glass)                             |
| Swap a food                 | `ArrowLeftRight`                                                |
| Scan (the camera, any mode) | `ScanLine`; a label inside it `ScanBarcode`                     |
| Read a note                 | `NotebookPen`; a plate photo `Camera`; typing or speaking `Mic` |
| Import a screenshot         | `ImagePlus`                                                     |
| Body composition            | `PieChart`; bodyweight `Scale`                                  |

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

- **Reduce Motion** is always respected: no slides or scale, a fade at most. `styles.css` has a fallback for the common cases (every `animate-in`/`animate-out` keeps its fade and loses its slide, zoom and spin; the card flash and confetti go), but check `prefers-reduced-motion` for every new animation of your own.
- **Page transitions** move only the content: a crossfade with no slide (120 ms out, 200 ms in, starting together). The chrome, meaning the header (title, profile button, sub-tabs) and the tab bar, never moves or fades between screens; each has its own `view-transition-name` and swaps in place. A new piece of chrome that sits in the same spot on every screen gets the same treatment. A sliding, fading header shows two titles at once.
- Don't animate on first paint from SSR without `fill-mode-both` (see CLAUDE.md, Splash screen).

## 10. Haptics

`haptic(ms)` on every tap that changes data. On iPhone, `installAppWideHaptics` puts the switch tick on every button automatically. Use `<HapticSwitch />` on a button tapped many times in a row (a stepper, a quick-add, Log set), and `data-no-haptic` to opt out. Never inside a form's submit button.

## 11. Accessibility

- **Text contrast:** 4.5:1 for text (3:1 from 24 px, or 18.66 px bold), 3:1 for the graphics you need (WCAG 2.x). The tokens are built to pass (`text-primary-text`, `text-warning-text`, `text-destructive-text`, `text-muted-foreground`); fading text with an opacity (`/70`, `opacity-50` on a whole cell) is what usually breaks it. Disabled controls are exempt.
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

- **Every visible string lives in `lib/gym/i18n.ts`,** in both `en` and `nl` (the type enforces it), units included in sentences ("1/3 sets · 6–10 reps"). A page that can render outside `GymProvider` (the 404 and error pages) reads the language itself and uses `dictFor`. Exercise names, muscles and split names stay English (see CLAUDE.md).
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
5. **Run `npm run ui-check`** (with `npm run dev` running) on the routes you changed, and with `--open "<button name>"` on each sheet you added or changed. At the four sizes in en/dark and nl/light, with realistic demo data by default, it reports:
   - sideways overflow and content left under the tab bar;
   - text under 4.5:1 (3:1 large) and tap areas under 44 pt;
   - page errors and cut-off text;
   - more than one solid accent control (a warning).

   Fix every finding. A deliberate exception gets `data-cut-ok`, `data-target-ok` or `data-solid-ok` and a comment saying why, rather than being ignored. If the demo data doesn't reach the new UI, pass `--seed` with data that does.

6. **Look at the screenshots** (`--shots`) in both themes. The script checks layout, not taste.
7. **Updated this guide** if you decided something new, and CLAUDE.md's feature section as usual.

## 15. Known inconsistencies (backlog)

Found in an app-wide audit on 6 October 2026, ordered by how visible they are. Fixed since: card headers on Workout, History and a session's page, the main buttons, the unpicked chips, the search fields and the Records list (6 October). Each is a place where older screens don't follow this guide yet. Fix them when you're changing that screen anyway, and remove the item here when it's done.

1. **Back buttons.** Four looks: a 44 pt glass circle without `tap-target` (a session's page), a 40 pt glass circle (Equipment), a rounded grey square (the workout screen), 28 pt arrows (Nutrition's week strip). Fix: one 36 pt round button with `tap-target`, like the Edit button.
2. **Icon badges.** Solid on the drink and meal cards and Settings rows, tonal on `ListCard`s. Decide one rule (for example: solid = something logged or active, tonal = a plain list) and write it in §7.
3. **Card corners.** Mostly `rounded-2xl`; 8 cards are `rounded-3xl` and 2 `rounded-xl`. Fix: `rounded-2xl` (Home's cards already are).
4. **Units.** "150g" and "250ml" without a space in some strings (Add food's portion line, quick-add amounts, "use serving size", water texts, the meal and recipe builders), against about 100 places with the space. Fix: always a space, except the water quick-adds' "+250ml", which needs to fit its button.
5. **Session-length chips.** The Workout tab's "30m" next to "45 min" elsewhere. Fix: "min" everywhere, or record "30m" as a chip-only short form in §12.
6. **First visit in light mode.** A page error (React's warning about the inline script) with the known first-visit hydration mismatch. (Home's cut-off Dutch hero title went with the Home redesign.)
7. **Type scale.** 22 px text 3 times in the welcome tour (not on the scale); about 100 small grey lines at 12 px where §3 says 12.5; the `text.*` house styles are hardly used.
8. **English in the Dutch app.** Exercise form tips and muscle names stay English by design (§12), but they stand out on otherwise Dutch screens. Translating them is a separate, larger job.
