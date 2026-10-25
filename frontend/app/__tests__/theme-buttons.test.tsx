// @vitest-environment jsdom
import { Button, ThemeProvider } from '@mui/material';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createAppTheme, type ThemeMode } from '@/app/theme';
import { tokens } from '@/lib/theme-tokens';

const renderButton = (mode: ThemeMode, variant: 'contained' | 'outlined') =>
  render(
    <ThemeProvider theme={createAppTheme(mode)}>
      <Button variant={variant} color="primary">
        Save
      </Button>
    </ThemeProvider>,
  );

const background = (): string => getComputedStyle(screen.getByRole('button')).backgroundColor;

// The theme restyles primary buttons per variant. These overrides are easy to
// lose silently: MUI ignores style keys it no longer knows (v9 dropped the
// containedPrimary / outlinedPrimary classes they used to hang on).
describe('primary buttons in the app theme', () => {
  it('fills a contained button with the deep brand green in dark mode, not the light accent', () => {
    renderButton('dark', 'contained');

    // DARK_PRIMARY_FILL (#3f5e4e): white text on the dark palette's primary is 2.2:1.
    expect(background()).toBe('rgb(63, 94, 78)');
  });

  it('draws an outlined primary button as a secondary action: surface fill, dark text', () => {
    renderButton('light', 'outlined');
    const button = screen.getByRole('button');

    expect(getComputedStyle(button).backgroundColor).toBe(hexToRgb(tokens.color.surface));
    expect(getComputedStyle(button).color).toBe(hexToRgb(tokens.color.ink900));
  });
});

function hexToRgb(hex: string): string {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(offset => Number.parseInt(value.slice(offset, offset + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}
