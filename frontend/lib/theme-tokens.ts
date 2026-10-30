// lib/theme-tokens.ts
// JS/TS token constants — mirrors abstracts/_variables.scss and _variables-dark.scss.
// Use these wherever CSS custom properties (var(--seneca-*)) were used in JS/TSX.
//
// For dark-mode-aware colors in client components:
//   import { useTheme } from 'next-themes';
//   import { tokens } from '@/lib/theme-tokens';
//   const { resolvedTheme } = useTheme();
//   const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;

export const tokens = {
  // ── Static (same in both themes) ───────────────────────────
  radius: {
    none: '0',
    xs: '6px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    full: '999px',
  },
  /** Keyboard focus ring (mirrors $seneca-focus-ring-* in _variables.scss). `reach` is how far,
   *  in px, it extends outside an element: the room a clipping container leaves its items. */
  focusRing: { reach: 4 },
  space: {
    0: '0',
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
  },
  font: {
    size: {
      xs: '12px',
      sm: '13px',
      base: '14px',
      md: '15px',
      lg: '16px',
      xl: '18px',
    },
    weight: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
    },
  },
  zIndex: {
    dropdown: 1000,
    modal: 1300,
    popover: 1400,
    tooltip: 1500,
  },

  // ── Light theme colors (default) ────────────────────────────
  color: {
    primary: '#5b7b6a',
    // Background of a filled control carrying white text. Same as `primary`
    // here; deliberately different in `dark` below — see the note there.
    primaryFill: '#5b7b6a',
    primaryFillHover: '#4e6b5c',
    primaryHover: '#4e6b5c',
    primaryDark: '#3f574a',
    forest: '#0e2a10',
    lime: '#9fe870',
    primary50: '#eef3f0',
    primary100: '#dce6e0',
    primary200: '#b9cbc1',
    primaryContrast: '#ffffff',
    ink900: '#0b0b10',
    ink800: '#171720',
    ink700: '#2a2a35',
    ink600: '#4a4a58',
    ink500: '#6b6b78',
    ink400: '#8e8e9a',
    ink300: '#b7b7c0',
    ink200: '#d6cfc3',
    ink150: '#e1dbd1',
    ink100: '#e7e2d9',
    ink50: '#eeeae3',
    white: '#ffffff',
    success: '#10b981',
    successSoft: '#ecfdf5',
    warning: '#f59e0b',
    warningSoft: '#fffbeb',
    danger: '#e11d48',
    dangerSoft: '#fff1f2',
    info: '#0ea5e9',
    infoSoft: '#f0f9ff',
    bg: '#ebe7df',
    surface: '#f3f0ea',
    surfaceMuted: '#e7e2d9',
    surfaceWarning: '#fffbeb',
    surfaceError: '#fff1f2',
    textPrimary: '#0b0b10',
    textSecondary: '#4a4a58',
    border: '#ececef',
    borderStrong: '#dcdce1',
    skeleton: '#e2ddd3',
    catFood: '#f59e0b',
    catTransport: '#0ea5e9',
    catHousing: '#8b5cf6',
    catShopping: '#ec4899',
    catIncome: '#10b981',
    catOther: '#64748b',
  },

  shadow: {
    xs: '0 1px 0 0 rgba(12, 12, 20, 0.04)',
    sm: '0 1px 2px 0 rgba(12, 12, 20, 0.05), 0 1px 0 0 rgba(12, 12, 20, 0.02)',
    md: '0 4px 16px -4px rgba(12, 12, 20, 0.08), 0 1px 2px rgba(12, 12, 20, 0.04)',
    lg: '0 20px 40px -12px rgba(12, 12, 20, 0.12), 0 2px 6px rgba(12, 12, 20, 0.04)',
  },

  // ── Dark theme colors ───────────────────────────────────────
  dark: {
    color: {
      primary: '#8fb39f',
      // Not `primary`: white text on #8fb39f is ~1.9:1, well under the 4.5:1
      // minimum. Filled controls (buttons, badges) use this instead — a
      // deeper, less saturated step of the same hue, 5.4:1 with white text.
      // Mirrors --primary-fill in styles/themes/_globals.scss; keep both in step.
      primaryFill: '#3f5e4e',
      primaryFillHover: '#4a6b5a',
      primaryHover: '#a3c2b0',
      primaryDark: '#3f5e4e',
      forest: '#0e2a10',
      lime: '#9fe870',
      primary50: 'rgba(143, 179, 159, 0.1)',
      primary100: 'rgba(143, 179, 159, 0.2)',
      primary200: 'rgba(143, 179, 159, 0.35)',
      primaryContrast: '#ece7de',
      ink900: '#ece7de',
      ink800: '#d6d0c5',
      ink700: '#bdb6aa',
      ink600: '#b0a99d',
      ink500: '#a8a196',
      ink400: '#857f75',
      ink300: '#5f5a53',
      ink200: '#3a3733',
      ink150: '#2e2c29',
      ink100: '#2b2926',
      ink50: '#262523',
      white: '#2e2c29',
      success: '#8fb39f',
      successSoft: 'rgba(143, 179, 159, 0.12)',
      warning: '#d4a94f',
      warningSoft: 'rgba(212, 169, 79, 0.12)',
      danger: '#d9806f',
      dangerSoft: 'rgba(217, 128, 111, 0.12)',
      info: '#8fa5b8',
      infoSoft: 'rgba(143, 165, 184, 0.12)',
      bg: '#1b1a18',
      surface: '#232220',
      surfaceMuted: '#1f1e1c',
      surfaceWarning: 'rgba(212, 169, 79, 0.12)',
      surfaceError: 'rgba(217, 128, 111, 0.12)',
      textPrimary: '#ece7de',
      textSecondary: '#a8a196',
      border: '#2e2c29',
      borderStrong: '#3a3733',
      skeleton: '#2e2c29',
      catFood: '#f59e0b',
      catTransport: '#38bdf8',
      catHousing: '#a78bfa',
      catShopping: '#f472b6',
      catIncome: '#34d399',
      catOther: '#94a3b8',
    },
    shadow: {
      xs: '0 1px 0 0 rgba(0, 0, 0, 0.2)',
      sm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
      md: '0 4px 16px -4px rgba(0, 0, 0, 0.4)',
      lg: '0 20px 40px -12px rgba(0, 0, 0, 0.5)',
    },
  },
} as const;

export type ThemeColor = keyof typeof tokens.color;
