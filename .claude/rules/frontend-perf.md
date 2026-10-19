---
paths:
  - "frontend/**"
---

# Frontend Performance & State Management

## 1. State Management (Next.js/React)
- **Local State**: Use `useState` for component-only state.
- **Global State**: Use `Zustand` or specialized Context providers for cross-page state (e.g., WorkspaceContext).
- **Server State**: Use `React Query` (TanStack Query) for data fetching, caching, and synchronization. Never store fetched API data in global state manually.

## 2. Performance Optimization
- **Memoization**: Use `useMemo` and `useCallback` for expensive calculations or when passing functions to memoized components.
- **Dynamic Imports**: Lazy load heavy components (e.g., charts, complex modals) using `next/dynamic`.
- **Image Optimization**: Always use `next/image` for images to ensure proper sizing and lazy loading.

## 3. Rendering & Hydration
- **SSR vs Client**: Prefer Server Components for data-heavy views. Use Client Components only for interactivity.
- **Avoid Layout Shift**: Reserve space for loading elements using Skeletons to maintain cumulative layout shift (CLS) near zero.

## 4. Accessibility & Quality
- **Semantic HTML**: Use proper tags (`<nav>`, `<article>`, `<button>` vs `<div>`).
- **Contrast**: Maintain a high contrast ratio for financial data accessibility.
- **Offline Support**: Implement graceful degradation or "Offline Mode" indicators for better reliability.
