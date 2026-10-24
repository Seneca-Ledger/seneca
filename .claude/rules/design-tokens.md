---
paths:
  - "frontend/**"
---

# Design tokens: every style follows the light and dark theme tokens

Seneca's look is a calm Scandinavian palette: warm off-white and warm graphite,
sage as the one accent, earthy tones for data. Every colour, and every
text size and weight below, comes from the tokens. Nothing is styled outside them.

## The rule
- **No raw colours in components.** No hex, `rgb()` or named colours in TSX
  `sx`/`style`, and no raw colours in SCSS outside the token files. Use the CSS
  variables (`var(--primary)`, `var(--text-muted)`, …) or the SCSS tokens.
- **Both themes, always.** A colour that is not a CSS variable needs an
  `@include dark { … }` counterpart. Check every new screen in light and dark.
- **No library defaults.** MUI `color="success|error|warning|info"` and
  Tailwind palette classes (`text-emerald-500`, `bg-blue-50`, …) bring
  emerald, sky blue and pure red. Use the tokens instead. The theme's palette
  is aligned for leftovers, but do not rely on it for new work.
- **Category colours stored in the DB are not used for display.** Charts take
  the earthy tones by category name (`categoryTones` / `categoryTonesHex` in
  `app/components/charts/chart-theme.ts`).
- **Canvas charts (ECharts) cannot read CSS variables.** Use the hex mirrors
  (`CATEGORY_TONE_HEX`, `OTHER_TONE_HEX`, `tokens` / `tokens.dark` from
  `lib/theme-tokens.ts`) picked by `resolvedTheme`. SVG charts use the variables.

## Where tokens live (keep them in sync)
1. `app/styles/abstracts/_variables.scss`: light SCSS tokens.
2. `app/styles/abstracts/_variables-dark.scss`: dark SCSS tokens (`*-dk`).
3. `app/styles/themes/_globals.scss`: CSS variables, `:root` and `.dark`.
   Some are hand-written `rgb` triples (`--primary-rgb`).
4. `lib/theme-tokens.ts` and `app/lib/theme-tokens.ts`: JS mirrors (`tokens.color`, `tokens.dark.color`).
5. `app/theme.ts`: MUI palette, plus a few dark literals (`DARK_PRIMARY_FILL*`).

A new or changed token goes into all of these, in both themes.

## Palette

| Role | Light | Dark | CSS variable |
|---|---|---|---|
| Page background | `#FAF8F5` | `#1B1A18` | `--background` |
| Card | `#FFFFFF` | `#232220` | `--card` / `--card-bg` |
| Soft fill (tracks, selected tile, segment) | `#F4F1EB` | `#2B2926` | `--surface-soft` |
| Neutral circle / icon badge / progress track | `#EFEBE4` | `#2B2926` | `--icon-badge-bg` |
| Hairline / border | `#EDE9E2` | `#2E2C29` | `--border` |
| Field border | `#E3DED5` | `#3A3733` | `$seneca-color-slot-border` |
| Main text, figures | `#24211E` | `#ECE7DE` | `--foreground` |
| Readable secondary text | `#6B665D` | `#A8A196` | `--text-muted` |
| Decorative captions only | `#8A857C` | — | `$seneca-color-slot-text` |
| Accent (links, active, icons) | `#5B7B6A` | `#8FB39F` | `--primary` |
| Filled / selected control | `#5B7B6A` (button `#4F6F5E`) | `#3F5E4E` + `#ECE7DE` text | `--primary-fill` / `--primary-foreground` |
| Selected tile background | `#EEF3EF` | `--primary-50` | `--primary-50` |
| Money up / income / positive change | `#3F7D5C` | `#8FB39F` | `--money-up` |
| Money down / over limit | `#B4493F` | `#D9806F` | `--money-down` |
| Attention (warning, unconfirmed) | `#C79A3B` | `#D4A94F` | `--attention` |
| Chart tones (sage, terracotta, sand, dusty blue, clay) | `#6F8F7B #B8665A #D2B48C #7C93A8 #A98B76` | `#8FB39F #D9806F #DCC39E #93A9BD #BFA18B` | `--cat-tone-1…5` |
| Chart "Other", uncategorised, totals | `#A7ADA3` | `#7D8279` | `--cat-tone-other` |

## How colour is used
- **Colour only for real signals.** Amounts and figures stay ink. Spending is
  not an alarm and is not red. A zero is neutral: no sign, no arrow, no colour.
  Terracotta is for real overruns, ochre for attention, sage for good news.
- A status or category is text with a small dot. Pills appear only on hover.
- Contrast: readable text is `--text-muted` (about 5.7:1). `#8A857C` is never
  used for text that has to be read.

## Type and shapes
- Headings and card titles: sentence case, 15px, weight 500. No uppercase
  labels, no letter-spacing caps. Page headings are weight 500, not 600 or 700.
- Labels and secondary lines: 13–14px, `--text-muted`. Field labels sit
  permanently above fields, never floating inside them.
- Figures: weight 500, `font-variant-numeric: tabular-nums`. Money uses the
  app format (`app/lib/format-money.ts` in the user's locale): symbol first,
  typographic minus `−`. Whole units on overviews, cents under 100 and on hover.
- Radii: fields and buttons 8–10px, cards 12–16px.
- Switches between views are text tabs (`app/components/ui/text-tabs.tsx`)
  with the active one in ink over a sage underline, inactive `--text-muted`.
  No segmented pills, no filled icon toggles.
- Empty states: a line icon (1.5px stroke) in the `--icon-badge-bg` circle, a
  title of 18px/500, one grey line and one button (`EmptyState`). No illustrations.
- Icons are line icons. Category glyphs come from `app/lib/category-line-icons.tsx`.
- Modals use `ModalShell` (`--modal-backdrop`: soft `#24211E` at 20% in light, black at 55% in dark). Cancel is a ghost
  text button.

## Checklist before finishing UI work
- [ ] No new raw hex / MUI colour props / Tailwind palette classes.
- [ ] Looked at it in light **and** dark.
- [ ] Figures ink and tabular. Colour only where something deviates.
- [ ] Sentence case, 13–15px labels and titles, weight 500 at most.
