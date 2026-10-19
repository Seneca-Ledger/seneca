// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ChoiceCards } from './choice-cards';

const options = [
  { value: 'home', title: 'Home', description: 'Family money' },
  { value: 'business', title: 'Business' },
] as const;

function Controlled({ initial = null }: { initial?: 'home' | 'business' | null }) {
  const [value, setValue] = useState<'home' | 'business' | null>(initial);
  return <ChoiceCards aria-label="Profile" value={value} onChange={setValue} options={options} />;
}

describe('ChoiceCards', () => {
  it('is a radio group with nothing checked until a choice is made', () => {
    render(<Controlled />);

    expect(screen.getByRole('radiogroup', { name: 'Profile' })).toBeInTheDocument();
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toHaveAttribute('aria-checked', 'false');
    }
    // Without a choice the first card is the one Tab reaches.
    expect(screen.getByRole('radio', { name: /Home/ })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: /Business/ })).toHaveAttribute('tabindex', '-1');
  });

  it('checks the clicked card', () => {
    const onChange = vi.fn();
    render(<ChoiceCards value={null} onChange={onChange} options={options} />);

    fireEvent.click(screen.getByRole('radio', { name: /Business/ }));
    expect(onChange).toHaveBeenCalledWith('business');
  });

  it('moves the choice and the focus with the arrow keys, wrapping around', () => {
    render(<Controlled initial="home" />);
    const home = screen.getByRole('radio', { name: /Home/ });
    const business = screen.getByRole('radio', { name: /Business/ });

    fireEvent.keyDown(home, { key: 'ArrowRight' });
    expect(business).toHaveAttribute('aria-checked', 'true');
    expect(business).toHaveFocus();
    expect(business).toHaveAttribute('tabindex', '0');

    fireEvent.keyDown(business, { key: 'ArrowDown' });
    expect(home).toHaveAttribute('aria-checked', 'true');
    expect(home).toHaveFocus();
  });
});
