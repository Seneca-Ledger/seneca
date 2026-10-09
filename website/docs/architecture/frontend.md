---
title: Frontend Architecture
description: Next.js routes, components, and state
---

The frontend is a Next.js 16 app (React 19, MUI 7) with route groups and modular UI components.

## Route structure

- `(auth)` — login, registration, forgot password, reset password, and email verification.
- `(main)` — the signed-in product UI: dashboard, statements, reports, budgets, goals, net worth, crypto,
  subscriptions, ROI, advice, AI analysis, custom tables, workspaces, supported banks, and the income tax
  declaration (`tax-declaration`).
- `(onboarding)` — guided setup.
- Standalone routes: `admin`, `audit`, `categories`, `chat`, `integrations`, `settings`, `storage/[id]`,
  `transactions/duplicates`, `invite/[token]`, `shared/[token]`, and `plugins`.

Key entry points live in `frontend/app`.

## Component system

- `frontend/app/components/ui` provides reusable UI primitives.
- Feature components live in folders such as `components/dashboard`, `components/transactions`,
  `components/receipts`, and `components/side-panel`.
- Guided tours are defined in `frontend/app/tours` with per-feature content files.

## State and data

- `frontend/app/lib/api.ts` is the shared Axios client. It sends cookies (`withCredentials`) and adds the CSRF
  header from `frontend/app/lib/csrf.ts`; the auth tokens themselves are HttpOnly and never readable by
  JavaScript.
- Server state is fetched and cached with TanStack Query.
- `AuthContext`, `WorkspaceContext`, `NotificationContext`, and `CurrencyDisplayContext` in
  `frontend/app/contexts` hold app-wide state; `useAuth` wraps the auth context.
- Real-time updates arrive through the Socket.IO client.
- Receipt maps render with Leaflet.

## Internationalization

Lumio uses Intlayer with 35 locales (default `en`). Content files (`*.content.ts`) sit next to the features they
describe; `intlayer build` runs on `postinstall` and `prebuild`.

## Styling and tooling

- MUI 7 with Emotion, plus SCSS under `app/styles` (checked by stylelint via `npm run lint:css`)
- Charts use Recharts and ECharts
- `npm run lint:check` runs both Biome and ESLint; `npm test` runs Vitest

Next: [Database Architecture](database)
