import { alpha, createTheme, type ThemeOptions } from '@mui/material/styles';
import { createSvgIcon } from '@mui/material/utils';
import { createElement } from 'react';
import { tokens } from '@/lib/theme-tokens';

export type ThemeMode = 'light' | 'dark';

type AppSurfaceTokens = {
  primary: string;
};

const SURFACE_TOKENS: Record<ThemeMode, AppSurfaceTokens> = {
  light: { primary: '#168118' },
  dark: { primary: '#34d399' },
};

/**
 * Background of a filled control on a dark surface. Mirrors
 * `$lumio-color-primary-fill-dk` in styles/abstracts/_variables-dark.scss —
 * keep the two in step.
 */
const DARK_PRIMARY_FILL = '#047857';
const DARK_PRIMARY_FILL_HOVER = '#059669';

// Checkbox glyphs matching the filter option indicator (FilterOptionRow): a filled
// rounded 24px square, with the 16px Material check drawn in white when selected.
const CHECKBOX_BOX = { width: 24, height: 24, rx: 6, fill: 'currentColor' };
const CHECKBOX_MARK_COLOR = tokens.color.primaryContrast;

const CheckboxBlankIcon = createSvgIcon(createElement('rect', CHECKBOX_BOX), 'LumioCheckboxBlank');

const CheckboxCheckedIcon = createSvgIcon(
  [
    createElement('rect', { key: 'box', ...CHECKBOX_BOX }),
    createElement('path', {
      key: 'mark',
      d: 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
      fill: CHECKBOX_MARK_COLOR,
      transform: 'translate(4 4) scale(0.6667)',
    }),
  ],
  'LumioCheckboxChecked',
);

const CheckboxIndeterminateIcon = createSvgIcon(
  [
    createElement('rect', { key: 'box', ...CHECKBOX_BOX }),
    createElement('rect', {
      key: 'mark',
      x: 7,
      y: 11,
      width: 10,
      height: 2,
      rx: 1,
      fill: CHECKBOX_MARK_COLOR,
    }),
  ],
  'LumioCheckboxIndeterminate',
);

const getSharedOptions = (
  mode: ThemeMode,
): Pick<ThemeOptions, 'shape' | 'typography' | 'components'> => {
  const c = mode === 'dark' ? tokens.dark.color : tokens.color;
  return {
    shape: { borderRadius: 12 },
    typography: {
      fontFamily:
        'var(--font-geist), "Geist", ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
      h1: { fontWeight: 700, fontSize: '2.5rem', letterSpacing: '-0.025em' },
      h2: { fontWeight: 700, fontSize: '2rem', letterSpacing: '-0.02em' },
      h3: { fontWeight: 680, fontSize: '1.75rem', letterSpacing: '-0.015em' },
      h4: { fontWeight: 660, fontSize: '1.5rem', letterSpacing: '-0.01em' },
      h5: { fontWeight: 640, fontSize: '1.25rem' },
      h6: { fontWeight: 620, fontSize: '1rem' },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            // Square-ish, the same corner the toolbar controls use — not a pill.
            borderRadius: tokens.radius.md,
            padding: '8px 18px',
            height: 40,
            fontSize: '14px',
            fontWeight: 600,
            letterSpacing: '-0.005em',
            whiteSpace: 'nowrap',
            transition: 'background-color .15s, border-color .15s, color .15s, transform .06s',
            '&:active': { transform: 'translateY(1px)' },
          },
          sizeSmall: {
            height: 32,
            padding: '4px 14px',
            fontSize: '13px',
          },
          sizeLarge: {
            height: 48,
            padding: '10px 24px',
            fontSize: '15px',
          },
          contained: {
            boxShadow: 'none',
            '&:hover': {
              boxShadow: 'none',
            },
          },
          // In dark mode the palette's primary is the light accent used for
          // text, icons and outlined variants, where it has to stay bright to
          // be legible. As a filled background under white text it is only
          // 2.2:1, so contained buttons take the deeper brand green instead
          // (5.2:1). Keep both roles — swapping the palette value would fix
          // the buttons and break every primary-coloured label.
          containedPrimary: ({ theme }: { theme: import('@mui/material/styles').Theme }) =>
            theme.palette.mode === 'dark'
              ? {
                  backgroundColor: DARK_PRIMARY_FILL,
                  '&:hover': { backgroundColor: DARK_PRIMARY_FILL_HOVER },
                }
              : {
                  '&:hover': { backgroundColor: theme.palette.primary.dark },
                },
          outlined: {
            boxShadow: 'none',
          },
          // A secondary action is a white button with dark text, not green-on-
          // transparent: the accent is reserved for the one primary action on a
          // screen. Error and other colours keep their own outlined look.
          outlinedPrimary: {
            backgroundColor: c.surface,
            borderColor: c.ink150,
            color: c.ink900,
            '&:hover': {
              backgroundColor: c.ink50,
              borderColor: c.ink300,
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: tokens.radius.full,
            '&:hover': { backgroundColor: c.ink100 },
          },
        },
      },
      MuiCheckbox: {
        defaultProps: {
          icon: createElement(CheckboxBlankIcon),
          checkedIcon: createElement(CheckboxCheckedIcon),
          indeterminateIcon: createElement(CheckboxIndeterminateIcon),
        },
        styleOverrides: {
          root: {
            borderRadius: tokens.radius.xs,
            padding: 0,
            color: mode === 'dark' ? 'rgba(232, 232, 240, 0.18)' : '#f5f5f5',
            // Dark green fill in both themes: dark mode's primary (#34d399) is a light green.
            '&.Mui-checked, &.MuiCheckbox-indeterminate': {
              color: c.primaryFill,
            },
            '&.Mui-disabled': {
              opacity: 0.55,
            },
            '& .MuiSvgIcon-root, &.MuiCheckbox-sizeSmall .MuiSvgIcon-root': {
              fontSize: 24,
            },
            // Let clicks just outside the box still toggle it, without growing the layout.
            '& .PrivateSwitchBase-input': {
              top: -6,
              left: -6,
              width: 'calc(100% + 12px)',
              height: 'calc(100% + 12px)',
            },
          },
        },
      },
      // MUI spaces a label from its control with the control's own 9px padding
      // and a -11px margin that cancels it. The checkbox above has no padding,
      // so that pair glued every checkbox label to its box and pulled the box
      // out past the column's edge. Radios keep their padding and default.
      MuiFormControlLabel: {
        styleOverrides: {
          root: {
            '&:has(> .MuiCheckbox-root)': {
              marginLeft: 0,
              gap: 10,
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: tokens.radius.lg,
            boxShadow: 'none',
            backgroundImage: 'none',
            border: `1px solid ${c.ink150}`,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
          rounded: { borderRadius: tokens.radius.lg },
          elevation1: { boxShadow: '0 1px 2px 0 rgba(12, 12, 20, 0.05)' },
          elevation2: { boxShadow: '0 4px 16px -4px rgba(12, 12, 20, 0.08)' },
          elevation3: { boxShadow: '0 20px 40px -12px rgba(12, 12, 20, 0.12)' },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: tokens.radius.xl,
            boxShadow:
              '0 30px 80px -20px rgba(15, 23, 42, 0.35), 0 8px 16px -4px rgba(15, 23, 42, 0.1)',
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: tokens.radius.md,
            height: 40,
            fontSize: '14px',
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: c.ink300,
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              boxShadow: `0 0 0 3px ${c.primary50}`,
            },
            '&.MuiInputBase-sizeSmall': {
              height: 34,
              fontSize: '13px',
            },
            '&.MuiInputBase-multiline': {
              height: 'auto',
            },
          },
        },
      },
      MuiFilledInput: {
        styleOverrides: { root: { borderRadius: tokens.radius.md } },
      },
      MuiTextField: {
        defaultProps: { variant: 'outlined' },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: tokens.radius.full,
            height: 26,
            fontSize: '12.5px',
            fontWeight: 600,
          },
          sizeSmall: {
            height: 22,
            fontSize: '11.5px',
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: tokens.radius.md,
            fontSize: '13px',
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: tokens.radius.md,
            boxShadow: '0 4px 16px -4px rgba(12, 12, 20, 0.08), 0 1px 2px rgba(12, 12, 20, 0.04)',
            border: `1px solid ${c.ink150}`,
          },
          // The paper clips overflow; full-width items need room for their focus ring.
          list: { paddingInline: tokens.focusRing.reach },
        },
      },
      MuiPopover: {
        styleOverrides: {
          paper: {
            borderRadius: tokens.radius.md,
            boxShadow: '0 4px 16px -4px rgba(12, 12, 20, 0.08)',
            border: `1px solid ${c.ink150}`,
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: tokens.radius.sm,
            fontSize: '12px',
            fontWeight: 500,
            padding: '5px 10px',
          },
        },
      },
      MuiTableContainer: {
        styleOverrides: { root: { borderRadius: tokens.radius.lg } },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            fontSize: '14px',
            fontWeight: 600,
            textTransform: 'none',
            minHeight: 44,
          },
        },
      },
      // Tabs clip their strip. A fixed strip doesn't need to; a scrollable one must, so it
      // gets inner room for the focus ring, taken back with a negative margin on the root.
      MuiTabs: {
        styleOverrides: {
          root: {
            '&:has(> .MuiTabs-fixed)': { overflow: 'visible' },
            '&:has(> .MuiTabs-scrollableX)': { margin: -tokens.focusRing.reach },
          },
          scroller: {
            '&.MuiTabs-fixed': { overflow: 'visible' },
            '&.MuiTabs-scrollableX': {
              padding: tokens.focusRing.reach,
              scrollPaddingInline: tokens.focusRing.reach,
            },
          },
          indicator: {
            '.MuiTabs-scrollableX > &': { bottom: tokens.focusRing.reach },
          },
        },
      },
      // Avatar, Switch, CircularProgress intentionally NOT overridden (stay round)
    },
  };
};

const paletteByMode: Record<ThemeMode, ThemeOptions['palette']> = {
  light: {
    mode: 'light',
    primary: {
      main: '#168118',
      light: '#3e9c35',
      dark: '#036704',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#4a4a58',
      light: '#6b6b78',
      dark: '#2a2a35',
      contrastText: '#ffffff',
    },
    error: {
      main: '#e11d48',
      light: '#fb7185',
      dark: '#be123c',
      contrastText: '#ffffff',
    },
    warning: {
      main: '#f59e0b',
      light: '#fbbf24',
      dark: '#d97706',
      contrastText: '#ffffff',
    },
    success: {
      main: '#10b981',
      light: '#34d399',
      dark: '#059669',
      contrastText: '#ffffff',
    },
    info: {
      main: '#0ea5e9',
      light: '#38bdf8',
      dark: '#0284c7',
      contrastText: '#ffffff',
    },
    background: {
      default: '#f7f8f7',
      paper: '#ffffff',
    },
    text: {
      primary: '#0b0b10',
      secondary: '#4a4a58',
    },
    divider: '#ececef',
  },
  dark: {
    mode: 'dark',
    primary: {
      main: '#34d399',
      light: '#6ee7b7',
      dark: '#047857',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#242b3a',
      light: '#333b4d',
      dark: '#171c26',
      contrastText: '#e8e8f0',
    },
    error: {
      main: '#fb7185',
      light: '#fda4af',
      dark: '#e11d48',
      contrastText: '#ffffff',
    },
    warning: {
      main: '#fbbf24',
      light: '#fcd34d',
      dark: '#f59e0b',
      contrastText: '#0b0b10',
    },
    success: {
      main: '#34d399',
      light: '#6ee7b7',
      dark: '#10b981',
      contrastText: '#0b0b10',
    },
    info: {
      main: '#38bdf8',
      light: '#7dd3fc',
      dark: '#0ea5e9',
      contrastText: '#0b0b10',
    },
    background: {
      default: '#12161f',
      paper: '#1e2430',
    },
    text: {
      primary: '#e8e8f0',
      secondary: '#a0a0b4',
    },
    divider: 'rgba(255, 255, 255, 0.07)',
  },
};

export type UiDensity = 'comfortable' | 'compact';

export type AppThemeOptions = {
  density?: UiDensity;
  reduceMotion?: boolean;
};

/**
 * Density lives in the theme rather than in each table, so all two dozen tables
 * pick it up without being touched. Reduced motion cannot ride along here: the
 * app never renders <CssBaseline />, so MuiCssBaseline overrides would be dead
 * configuration — it is applied as a document attribute instead (globals.css).
 */
const getPreferenceOverrides = ({ density }: AppThemeOptions): ThemeOptions => {
  const compact = density === 'compact';

  return {
    components: {
      ...(compact
        ? {
            MuiTableCell: {
              styleOverrides: {
                root: { paddingTop: 6, paddingBottom: 6, fontSize: '13px' },
              },
            },
            MuiTableRow: { styleOverrides: { root: { height: 'auto' } } },
          }
        : {}),
    },
  };
};

export const createAppTheme = (mode: ThemeMode, preferences: AppThemeOptions = {}) => {
  const surfaces = SURFACE_TOKENS[mode];
  const shared = getSharedOptions(mode);
  const overrides = getPreferenceOverrides(preferences);

  return createTheme({
    ...shared,
    components: { ...shared.components, ...overrides.components },
    palette: {
      ...paletteByMode[mode],
      action: {
        hover: alpha(surfaces.primary, mode === 'dark' ? 0.12 : 0.06),
        selected: alpha(surfaces.primary, mode === 'dark' ? 0.16 : 0.08),
      },
    },
  });
};

export const lightTheme = createAppTheme('light');
export const darkTheme = createAppTheme('dark');
