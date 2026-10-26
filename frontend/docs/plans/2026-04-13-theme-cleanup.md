# Theme Cleanup: Blue Primary + Dark Theme Fix + No Border-Radius

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify primary color to LinkedIn blue (#0a66c2), eliminate all white elements in dark theme, remove all border-radius throughout the app.

**Architecture:** Three-pass approach: (1) update design tokens and theme config at the source, (2) fix all hardcoded white backgrounds in components to use theme tokens, (3) remove all remaining border-radius from CSS block files and inline styles.

**Tech Stack:** MUI theme, CSS custom properties, BEM CSS blocks, React inline styles (sx prop).

---

## Color Reference

| Token | Light | Dark |
|-------|-------|------|
| primary | `#0a66c2` | `#5B9BD5` |
| primary-hover | `#084e96` | `#4A8BC5` |
| primary-light | `#3b82c4` | `#7AAFE0` |
| primary-dark | `#084e96` | `#4A8BC5` |
| background | `#ffffff` | `#0F1419` |
| surface/paper | `#ffffff` | `#151C24` |
| surface-muted | `#f1f5f9` | `#1E2A3A` |

**Rule for white replacement:** Every `'white'`, `'#fff'`, `'#ffffff'` background in components must become:
- In MUI sx: `bgcolor: 'background.paper'` or `bgcolor: 'background.default'`
- In CSS: `var(--seneca-color-surface)` or `var(--card-bg)`

---

## Task 1: Update Design Tokens (source of truth)

**Files:**
- Modify: `app/theme.ts`
- Modify: `app/globals.css` (lines 25-26)
- Modify: `app/styles/tokens.css` (line 8-9)

**Step 1: Update MUI theme primary colors**

In `app/theme.ts`, change:
- `SURFACE_TOKENS.light.primary`: `'#0284c7'` → `'#0a66c2'`
- `paletteByMode.light.primary.main`: `'#0284c7'` → `'#0a66c2'`
- `paletteByMode.light.primary.light`: `'#38bdf8'` → `'#3b82c4'`
- `paletteByMode.light.primary.dark`: `'#0369a1'` → `'#084e96'`

**Step 2: Update CSS variable primary (red → blue)**

In `app/globals.css` `:root`:
- `--primary: #e42313` → `--primary: #0a66c2`
- `--primary-hover: #c11b0e` → `--primary-hover: #084e96`
- `--ring: #38bdf8` → `--ring: #3b82c4`

**Step 3: Update tokens.css light primary**

In `app/styles/tokens.css` `:root`:
- `--seneca-color-primary: #0284c7` → `--seneca-color-primary: #0a66c2`
- `--seneca-color-primary-hover: #0369a1` → `--seneca-color-primary-hover: #084e96`

**Step 4: Commit**

```
refactor(frontend): unify primary color to LinkedIn blue #0a66c2
```

---

## Task 2: Fix hardcoded white backgrounds in Dashboard components

**Files:**
- Modify: `app/components/dashboard/RecentActivity.tsx` (line 94)
- Modify: `app/components/dashboard/FinlabIncomeCard.tsx` (line 73)
- Modify: `app/components/dashboard/FinlabTransactionCard.tsx` (line 61)
- Modify: `app/components/dashboard/FinlabExpenseCard.tsx` (line 87)
- Modify: `app/components/dashboard/FinlabBalanceStatCard.tsx` (line 103)
- Modify: `app/components/dashboard/FinlabExpenseCategoryCard.tsx` (line 57)
- Modify: `app/components/dashboard/FinancialSnapshot.tsx` (line 45)
- Modify: `app/components/dashboard/TopMerchantsCard.tsx` (lines 22, 35)
- Modify: `app/components/dashboard/PeriodDropdown.tsx` (line 49)
- Modify: `app/components/dashboard/OverviewTab.tsx` (lines 182, 247, 288)
- Modify: `app/components/dashboard/TransactionTab.tsx` (lines 160, 195)

**Step 1: Replace all `bgcolor: 'white'` / `backgroundColor: 'white'` with `bgcolor: 'background.paper'`**

In every file listed above, replace:
- `bgcolor: 'white'` → `bgcolor: 'background.paper'`
- `backgroundColor: 'white'` → `backgroundColor: 'background.paper'` (for inline style objects, use CSS var: `var(--card-bg)`)
- `background: 'white'` → `background: 'background.paper'` (if in sx) or `var(--card-bg)` (if in style)

**Step 2: Also fix hardcoded light backgrounds in RecentActivity**

- `bgcolor: '#f8fafc'` → `bgcolor: 'action.hover'`
- `bgcolor: '#f1f5f9'` → `bgcolor: 'action.selected'`

**Step 3: Commit**

```
refactor(frontend): replace hardcoded white backgrounds in dashboard with theme tokens
```

---

## Task 3: Fix hardcoded white backgrounds in Storage pages

**Files:**
- Modify: `app/storage/StoragePageContent.tsx` (~15 instances)
- Modify: `app/storage/[id]/page.tsx` (~16 instances)
- Modify: `app/storage/gmail-receipts/[id]/page.tsx` (instances with `#fff`)
- Modify: `app/storage/gmail-receipts/components/ReceiptPreviewModal.tsx` (3 instances)
- Modify: `app/storage/components/DraggableFileRow.tsx`

**Step 1: In all files, replace:**

- `bgcolor: '#fff'` → `bgcolor: 'background.paper'`
- `bgcolor: 'white'` → `bgcolor: 'background.paper'`
- `backgroundColor: '#fff'` → use `'background.paper'` in sx or `var(--card-bg)` in style
- `background: '#fff'` → `bgcolor: 'background.paper'`

**Step 2: Commit**

```
refactor(frontend): replace hardcoded white backgrounds in storage pages with theme tokens
```

---

## Task 4: Fix hardcoded white backgrounds in Integrations pages

**Files:**
- Modify: `app/integrations/page.tsx` (2 instances)
- Modify: `app/integrations/gmail/page.tsx` (3 instances)
- Modify: `app/integrations/dropbox/page.tsx` (3 instances)
- Modify: `app/integrations/google-drive/page.tsx` (3 instances)
- Modify: `app/integrations/google-sheets/page.tsx` (5 instances)
- Modify: `app/integrations/components/IntegrationStatusCard.tsx` (1 instance)

**Step 1: Replace all `bgcolor: '#fff'` with `bgcolor: 'background.paper'`**

**Step 2: Commit**

```
refactor(frontend): replace hardcoded white backgrounds in integrations with theme tokens
```

---

## Task 5: Fix hardcoded white in Statements, Workspaces, Custom Tables

**Files:**
- Modify: `app/(main)/statements/components/TopSpendersView.tsx`
- Modify: `app/(main)/statements/components/TopCategoriesView.tsx`
- Modify: `app/(main)/statements/components/UnapprovedCashView.tsx`
- Modify: `app/(main)/statements/components/PayablesView.tsx`
- Modify: `app/(main)/workspaces/components/WorkspacesListContent.tsx`
- Modify: `app/(main)/workspaces/components/BackgroundSelector.tsx`
- Modify: `app/(main)/custom-tables/[id]/page.tsx` (40+ instances)
- Modify: `app/(main)/custom-tables/page.tsx` (7+ instances)
- Modify: `app/(main)/custom-tables/import/google-sheets/page.tsx`
- Modify: `app/(main)/supported-banks/page.tsx`

**Step 1: Replace all hardcoded white backgrounds with `'background.paper'` (sx) or `var(--card-bg)` (inline style/CSS)**

**Step 2: Commit**

```
refactor(frontend): replace hardcoded white in statements, workspaces, custom-tables
```

---

## Task 6: Fix hardcoded white in remaining components

**Files:**
- Modify: `app/components/side-panel/SidePanel.tsx` (lines 124, 312)
- Modify: `app/components/side-panel/sections/index.tsx` (lines 567, 706, 738)
- Modify: `app/components/PDFThumbnail.tsx` (line 179)
- Modify: `app/components/TransactionDocumentViewer.tsx` (lines 129, 156)
- Modify: `app/components/receipts/ReceiptDetailPanel.tsx` (3 instances)
- Modify: `app/components/receipts/ReceiptParsedDataForm.tsx` (1 instance)
- Modify: `app/components/receipts/ReceiptUploadModal.tsx` (2 instances)
- Modify: `app/components/ConfirmModal.tsx`
- Modify: `app/components/ChangelogModal.tsx`
- Modify: `app/transactions/duplicates/page.tsx` (3 instances)
- Modify: `app/transactions/duplicates/components/DuplicateGroupCard.tsx` (1 instance)
- Modify: `app/audit/page.tsx` (2 instances)
- Modify: `app/audit/components/EntityHistoryTimeline.tsx` (1 instance)
- Modify: `app/audit/components/AuditEventDrawer.tsx` (1 instance)
- Modify: `app/admin/page.tsx` (2 instances)
- Modify: `app/global-error.tsx`
- Modify: `app/components/BankLogoAvatar.tsx` (`backgroundColor: '#f3f4f6'` → `'action.hover'`)

**Step 1: Replace all hardcoded white/light backgrounds**

Same pattern: `'white'`/`'#fff'`/`'#ffffff'` → `'background.paper'` in sx, `var(--card-bg)` in style.
`'#f3f4f6'`/`'#f8fafc'`/`'#f1f5f9'` → `'action.hover'` in sx.

**Step 2: Commit**

```
refactor(frontend): replace hardcoded white in shared components, audit, admin, transactions
```

---

## Task 7: Fix hardcoded white backgrounds in CSS block files

**Files:**
- Modify: `app/styles/blocks/seneca-statements.css` (64+ instances of `#fff`)
- Modify: `app/styles/blocks/seneca-transaction-table.css` (2 instances of `white`)
- Modify: `app/styles/blocks/seneca-audit-panel.css` (check for `#fff`/`white`)

**Step 1: In seneca-statements.css — replace all `background: #fff` with `background: var(--seneca-color-surface)`**

Use find-and-replace: `#fff` → `var(--seneca-color-surface)` for backgrounds.
For light tinted backgrounds like `#fffbeb` (amber tint) → `var(--seneca-color-surface-muted)`.

**Step 2: In seneca-transaction-table.css:**
- `background-color: white` → `background-color: var(--seneca-color-surface)`
- `background: white` → `background: var(--seneca-color-surface)`

**Step 3: Commit**

```
refactor(frontend): replace hardcoded white in CSS block files with design tokens
```

---

## Task 8: Remove all remaining border-radius

**Files:**
- Modify: `app/styles/blocks/seneca-statements.css` (132 instances: 2px, 4px, 6px, 8px, 12px, 16px, 9999px)
- Modify: `app/styles/blocks/seneca-navigation.css` (12 instances: 6px, 10px, 12px, 16px, 9999px, 0.375rem)
- Modify: `app/styles/blocks/seneca-pdf-preview-modal.css` (13 instances: 8px, 9px, 18px, 22px, 24px, 9999px)
- Modify: `app/styles/blocks/seneca-notification-dropdown.css` (3 instances: 9999px)
- Modify: `app/styles/blocks/seneca-transaction-table.css` (5 instances: 50%)
- Modify: `app/styles/blocks/seneca-language-switcher.css` (1 instance: 50%)
- Modify: `app/tours/tour-theme.css` (border-radius: 12px, 6px)

**Step 1: In every CSS block file, set all `border-radius` values to `0`**

Exceptions (keep rounded):
- `border-radius: 50%` on circular avatars/icons (semantic circles) — keep
- `border-radius: 9999px` on notification badge dots — keep as `50%` (they are small circular indicators)

Everything else (8px, 12px, 16px, 6px, 22px, 0.375rem, etc.) → `0`.

**Step 2: Remove border-radius from tour-theme.css**
- `.driver-popover` → `border-radius: 0`
- `.driver-popover-navigation-btns` → `border-radius: 0`
- etc.

**Step 3: Commit**

```
refactor(frontend): remove all non-circular border-radius from CSS block files
```

---

## Task 9: Remove border-radius from inline styles in TSX files

**Files:** All TSX files with `borderRadius` in sx/style props. Major hotspots:
- `app/storage/StoragePageContent.tsx` (35 instances)
- `app/storage/gmail-receipts/[id]/page.tsx` (27 instances)
- `app/integrations/page.tsx` (30+ instances)
- `app/admin/page.tsx` (2 instances)
- `app/global-error.tsx` (1 instance)
- `app/storage/components/DraggableFileRow.tsx`
- `app/integrations/components/IntegrationStatusCard.tsx`
- `app/components/receipts/ReceiptCard.tsx`
- `app/components/ConfirmModal.tsx`
- `app/components/ChangelogModal.tsx`
- And 40+ additional component files

**Step 1: Search for all `borderRadius` in TSX/TS files**

```bash
cd frontend && grep -rn 'borderRadius' --include='*.tsx' --include='*.ts' app/
```

**Step 2: For each instance:**
- `borderRadius: 0` → remove the property entirely (theme default is 0)
- `borderRadius: N` (any non-zero, non-50%) → change to `0` or remove
- `borderRadius: '50%'` → KEEP (circular elements like avatars)
- `borderRadius: '0 !important'` → remove (redundant, theme is 0)

**Step 3: Commit**

```
refactor(frontend): remove all non-circular border-radius from inline styles
```

---

## Task 10: Fix navigation hardcoded colors

**Files:**
- Modify: `app/styles/blocks/seneca-navigation.css`

**Step 1: Update logo icon color**
- `.seneca-navigation__logo-icon` background: `#0a66c2` → `var(--seneca-color-primary)` (already `#0a66c2` in light, `#5B9BD5` in dark)
- Or keep hardcoded `#0a66c2` if brand logo should stay LinkedIn blue regardless of theme

**Step 2: Commit**

```
refactor(frontend): use theme tokens in navigation CSS
```

---

## Task 11: Verification pass

**Step 1: Global search for remaining hardcoded whites**

```bash
grep -rn "bgcolor: 'white'\|bgcolor: '#fff'\|backgroundColor: 'white'\|backgroundColor: '#fff'\|background: '#fff'\|background: 'white'" --include='*.tsx' --include='*.ts' app/
```

Expected: 0 results (except `PDFThumbnail` if PDF canvas needs white bg).

**Step 2: Global search for remaining red primary**

```bash
grep -rn '#e42313\|#c11b0e' app/
```

Expected: 0 results.

**Step 3: Search for non-zero border-radius in CSS**

```bash
grep -rn 'border-radius:' app/styles/ app/tours/ | grep -v '0\|50%'
```

Expected: 0 results.

**Step 4: Build check**

```bash
npm run build
```

Expected: successful build.

**Step 5: Commit (if any fixups needed)**

```
refactor(frontend): fix remaining theme issues found during verification
```

---

## Execution Notes

- **Parallel-safe tasks:** Tasks 2-6 (white backgrounds in different areas) can be dispatched in parallel via subagents.
- **Sequential:** Task 1 must come first (tokens). Tasks 7-9 (border-radius) can run in parallel. Task 11 must be last.
- **PDFThumbnail exception:** PDF canvas backgrounds may legitimately need white for document rendering — use judgement.
- **Story files:** Storybook `.stories.tsx` files with hardcoded colors can be skipped (not user-facing).
