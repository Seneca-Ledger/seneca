// @vitest-environment jsdom
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Select } from './select';
import { selectMenuComponents } from './select-menu-theme';

vi.mock('@/app/hooks/useIsMobile', () => ({ useIsMobile: () => false }));

// The app theme's Select rule on its own: importing the whole theme pulls in tokens
// that resolve differently under vitest.
const theme = createTheme({ components: selectMenuComponents });

const LONG = 'Refills up to the limit — leftover never piles up above it, overspend is taken off';

/**
 * jsdom lays nothing out; the field reports the width a drawer would give it:
 * `clientWidth` in its own CSS pixels, and on screen `onScreen` (less inside a
 * drawer shrunk with CSS zoom).
 */
function openWithFieldWidth(width: number, onScreen = width): HTMLElement {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: onScreen,
    height: 40,
    top: 0,
    left: 0,
    right: onScreen,
    bottom: 40,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  render(
    <ThemeProvider theme={theme}>
      <Select
        value="none"
        onChange={vi.fn()}
        inputProps={{ 'aria-label': 'Rollover' }}
        options={[
          { value: 'none', label: 'Expires' },
          { value: 'refill', label: LONG },
        ]}
      />
    </ThemeProvider>,
  );
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Rollover' }));
  return screen.getByRole('listbox').closest('.MuiPaper-root') as HTMLElement;
}

describe('Select menu width', () => {
  afterEach(() => vi.restoreAllMocks());

  it('opens a form field’s menu exactly as wide as the field, wrapping long options', () => {
    const paper = openWithFieldWidth(476);

    expect(paper.style.width).toBe('476px');
    expect(paper.style.maxWidth).toBe('476px');
    expect(paper.className).toContain('seneca-select-menu');
  });

  it('matches the field as it is on screen inside a zoomed drawer, not its unzoomed width', () => {
    // A drawer at zoom 0.88: the field is 551 CSS px inside it, 485 px on screen.
    const paper = openWithFieldWidth(551, 485);

    expect(paper.style.minWidth).toBe('485px');
    expect(paper.style.width).toBe('485px');
    expect(paper.style.maxWidth).toBe('485px');
  });

  it('lets a toolbar chip’s menu grow past it instead of wrapping every option', () => {
    const paper = openWithFieldWidth(120);

    expect(paper.style.minWidth).toBe('120px');
    expect(paper.style.width).toBe('');
  });
});
