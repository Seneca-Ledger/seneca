// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Chip, ChipGroup } from '../Chip';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('Chip', () => {
  it('renders a toggle button with aria-pressed mirroring active', () => {
    const onClick = vi.fn();
    render(
      <Chip active onClick={onClick}>
        Aug
      </Chip>,
    );
    const button = screen.getByRole('button', { name: 'Aug' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button.className).toContain('seneca-chip--active');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled and marks muted chips', () => {
    const onClick = vi.fn();
    render(
      <Chip disabled muted onClick={onClick}>
        Dec
      </Chip>,
    );
    const button = screen.getByRole('button', { name: 'Dec' });
    expect(button).toBeDisabled();
    expect(button.className).toContain('seneca-chip--muted');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders a link with a trailing count when href is set', () => {
    render(
      <Chip href="/statements?status=error" count={3}>
        Errors
      </Chip>,
    );
    const link = screen.getByRole('link', { name: /Errors/ });
    expect(link).toHaveAttribute('href', '/statements?status=error');
    expect(screen.getByText('3').className).toContain('seneca-chip__count');
  });

  it('renders a static tone pill as a span', () => {
    render(<Chip tone="success">Done</Chip>);
    const pill = screen.getByText('Done');
    expect(pill.tagName).toBe('SPAN');
    expect(pill.className).toContain('seneca-chip--tone-success');
  });

  it('groups chips with a labelled role=group', () => {
    render(
      <ChipGroup aria-label="Months" scroll>
        <Chip onClick={() => undefined}>Jan</Chip>
      </ChipGroup>,
    );
    const group = screen.getByRole('group', { name: 'Months' });
    expect(group.className).toContain('seneca-chip-group--scroll');
  });

  it('scrolls a keyboard-focused chip fully into view in a scrolling group', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(
      <ChipGroup scroll aria-label="Months">
        <Chip onClick={vi.fn()}>Jul</Chip>
      </ChipGroup>,
    );

    fireEvent.focus(screen.getByRole('button', { name: 'Jul' }));

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
  });
});
