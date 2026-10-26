import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SHORTCUT_FOCUS_SEARCH } from '@/app/lib/keyboard-shortcuts';
import { StatementsSearchPopover } from './StatementsSearchPopover';

vi.mock('@/app/i18n', () => ({
  useIntlayer: () =>
    new Proxy({}, { get: (_, key: string) => ({ value: key, toString: () => key }) }),
}));

const openBox = (label: string): HTMLInputElement => {
  fireEvent.click(screen.getByRole('button', { name: label }));
  return screen.getByRole('searchbox') as HTMLInputElement;
};

describe('StatementsSearchPopover', () => {
  it('applies the trimmed term on Enter', () => {
    const onApply = vi.fn();
    render(<StatementsSearchPopover value="" onApply={onApply} applyLabel="Apply" />);

    const input = openBox('search');
    fireEvent.change(input, { target: { value: '  coffee  ' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    expect(onApply).toHaveBeenCalledWith('coffee');
  });

  it('leaves the search alone on Cancel', () => {
    const onApply = vi.fn();
    render(<StatementsSearchPopover value="" onApply={onApply} applyLabel="Apply" />);

    fireEvent.change(openBox('search'), { target: { value: 'coffee' } });
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));

    expect(onApply).not.toHaveBeenCalled();
  });

  it('shows the term in force and clears it', () => {
    const onApply = vi.fn();
    render(<StatementsSearchPopover value="coffee" onApply={onApply} applyLabel="Apply" />);

    expect(openBox('coffee').value).toBe('coffee');
    fireEvent.click(screen.getByRole('button', { name: 'clear' }));

    expect(onApply).toHaveBeenCalledWith('');
  });

  it('keeps Clear disabled while there is nothing to clear', () => {
    render(<StatementsSearchPopover value="" onApply={vi.fn()} applyLabel="Apply" />);

    openBox('search');

    expect(screen.getByRole('button', { name: 'clear' })).toBeDisabled();
  });

  it('opens the box with the term in force when the `/` shortcut fires', () => {
    render(<StatementsSearchPopover value="coffee" onApply={vi.fn()} applyLabel="Apply" />);

    act(() => {
      window.dispatchEvent(new CustomEvent(SHORTCUT_FOCUS_SEARCH));
    });

    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('coffee');
  });
});
