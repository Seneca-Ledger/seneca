/**
 * JS mirror of SCSS design tokens (app/styles/abstracts/_variables.scss).
 * Use these constants in TSX inline styles instead of CSS custom properties.
 * For dark-mode-aware colors, use tokens.dark.color with resolvedTheme check.
 */

export const tokens = {
  radius: {
    xs: '6px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    full: '999px',
  },

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
    family:
      '"Geist", ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
    familyMono: '"Geist Mono", ui-monospace, "SF Mono", Menlo, monospace',
  },

  zIndex: {
    dropdown: 1000,
    modal: 1300,
    popover: 1400,
    tooltip: 1500,
  },

  // Light mode colors
  color: {
    primary: '#5b7b6a',
    primaryHover: '#4e6b5c',
    primaryDark: '#3f574a',
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
    ink200: '#dcdce1',
    ink150: '#ececef',
    ink100: '#f2f2f4',
    ink50: '#f8f8f9',
    white: '#ffffff',

    success: '#10b981',
    successSoft: '#ecfdf5',
    warning: '#f59e0b',
    warningSoft: '#fffbeb',
    danger: '#e11d48',
    dangerSoft: '#fff1f2',
    info: '#0ea5e9',
    infoSoft: '#f0f9ff',

    bg: '#faf8f5',
    surface: '#ffffff',
    surfaceMuted: '#f2f2f4',
    surfaceWarning: '#fffbeb',
    surfaceError: '#fff1f2',

    textPrimary: '#0b0b10',
    textSecondary: '#4a4a58',

    border: '#ececef',
    borderStrong: '#dcdce1',
    skeleton: '#efebe4',
  },

  shadow: {
    xs: '0 1px 0 0 rgba(12, 12, 20, 0.04)',
    sm: '0 1px 2px 0 rgba(12, 12, 20, 0.05), 0 1px 0 0 rgba(12, 12, 20, 0.02)',
    md: '0 4px 16px -4px rgba(12, 12, 20, 0.08), 0 1px 2px rgba(12, 12, 20, 0.04)',
    lg: '0 20px 40px -12px rgba(12, 12, 20, 0.12), 0 2px 6px rgba(12, 12, 20, 0.04)',
  },

  dark: {
    color: {
      primary: '#8fb39f',
      primaryHover: '#a3c2b0',
      primaryDark: '#3f5e4e',
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
    },
    shadow: {
      xs: '0 1px 0 0 rgba(0, 0, 0, 0.2)',
      sm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
      md: '0 4px 16px -4px rgba(0, 0, 0, 0.4)',
      lg: '0 20px 40px -12px rgba(0, 0, 0, 0.5)',
    },
  },
} as const;

export type ThemeColor = typeof tokens.color;
