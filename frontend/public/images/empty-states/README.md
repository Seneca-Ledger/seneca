# Empty-state illustrations

Source: [unDraw](https://undraw.co) — free for commercial and personal use, no attribution
required (see https://undraw.co/license).

The original files were recolored to the Lumio palette so they read on both the light and dark
theme: the unDraw accent (`#6c63ff`) became `#5b9bd5`, the near-black figure tones were lifted to
slate (`#334155`/`#475569`/`#64748b`), and the light greys were darkened slightly so they stay
visible on a white background.

`no-data` (a report under a magnifier), `subscriptions` (a desk calendar and a clock),
`receivables` (a bank building), `top-categories` (a piggy bank), `statements` (a till receipt),
`dashboard` (a sprout in a coin stack), `integrations` (a vault taking coins), `tables` (a
signed-off document), `net-worth` (a rising bar chart with coin stacks), `reports` (the same signed-off document as
`tables`, kept as its own copy so the two pages can diverge) and `payables` (a card
terminal printing a receipt) `advice` (a wallet with a banknote) `goals` (a shield over a card) `money-bag` (a sack beside a coin stack) `cash-bundle` (banded banknotes) `clients` (a person reading a receipt) and `notifications` (a bell, the one
illustration built from gradients rather than flat fills) and `security` (a padlocked shield, the
only one of these that is not an empty state — it sits above the 2FA password field) and
`sessions` (a phone taking coins) and `password` (a padlock) — the last three are section headers
rather than empty states — are a separate case: supplied designs, recolored to the brand green and shipped as light/dark pairs (`<name>.svg`
plus `<name>-dark.svg`), because their dark tones have to move in opposite directions on the two
themes and cannot be reused from one file. The component renders both and `_empty-state.scss`
hides the one that does not match the theme.

Rendered through `app/components/ui/EmptyStateIllustration.tsx`; add a new file here and register
it in that component's `ILLUSTRATIONS` map.
