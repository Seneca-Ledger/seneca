import { fireEvent, screen } from '@testing-library/react';

/**
 * Picks an option in the shared `Select`. Outside phone widths it renders MUI's
 * menu instead of a native `<select>`, so `fireEvent.change` has no value setter
 * to drive — the menu has to be opened and the option clicked.
 */
export function selectOption(trigger: HTMLElement, optionName: string | RegExp): void {
  fireEvent.mouseDown(trigger);
  fireEvent.click(screen.getByRole('option', { name: optionName }));
}
