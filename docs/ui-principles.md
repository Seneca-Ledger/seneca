# UI stability principles

The loudest complaints about finance apps in 2026 were not about missing features. They were
about products that moved things around, hid routine actions behind extra taps, nagged, and
sold to people who had already paid. These rules exist so Seneca does not become that product.

1. **Routine actions stay one tap away.** Approve, clear, set a category, mark a transfer: never
   behind a "more" menu, never behind an animation. If a change adds a tap to something people do
   every day, it is a regression.
2. **Do not move what works.** A redesign of a screen people use daily ships with release notes,
   a reason, and a way to keep the previous layout for a while. Muscle memory is a feature.
3. **Every automatic decision is explainable and reversible.** A category shows which step chose
   it and why; a transfer pair shows how it was matched; a duplicate shows what matched. Undo is
   always available and never asks for support.
4. **Automation has an off switch.** AI categorisation, merchant renaming, learning, recurring
   suggestions: each can be turned off per workspace, and "off" means no influence at all, not
   "less".
5. **The raw data is never overwritten.** The statement's own text stays on the row next to
   anything derived from it.
6. **No selling inside the product.** No upsell panels in working screens, no tiers that hold
   back features from people who already pay, no marketing in transactional emails.
7. **Totals net the things that are not money in or out.** Transfers between own accounts and
   full reimbursements are not spend and not income, everywhere, by default.
8. **Keyboard first on desktop, thumb first on mobile.** Lists are navigable without a mouse;
   the one thing people do on a phone (add an expense, snap a receipt) is on the home screen.
9. **Reduce motion is a setting, density is a setting.** Animations never delay an action.
10. **Release notes say what changed and why**, in the product and in `CHANGELOG.md`, before the
    change reaches the user.
