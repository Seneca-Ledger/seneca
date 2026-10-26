// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('draws a named illustration as a line icon in the circle, with texts and action', () => {
    const { container } = render(
      <EmptyState
        illustration="reports"
        title="Nothing yet"
        description="Add data to see a chart"
        action={<button type="button">Add</button>}
      />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.seneca-empty-state__icon svg')).not.toBeNull();
    expect(container.firstElementChild?.className).toContain('seneca-empty-state--icon');
    expect(screen.getByRole('heading', { name: 'Nothing yet' })).toBeInTheDocument();
    expect(screen.getByText('Add data to see a chart')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  it('applies the compact modifier and a smaller circle', () => {
    const { container } = render(<EmptyState illustration="no-data" size="sm" compact />);
    expect(container.firstElementChild?.className).toContain('seneca-empty-state--compact');
    expect(container.querySelector('.seneca-empty-state__icon--sm')).not.toBeNull();
  });

  it('draws a line icon in a circle instead of a picture', () => {
    const { container } = render(
      <EmptyState icon={<svg data-testid="line-icon" />} title="No subscriptions yet" />,
    );
    expect(container.querySelector('.seneca-empty-state__icon [data-testid="line-icon"]')).not.toBeNull();
    expect(container.firstElementChild?.className).toContain('seneca-empty-state--icon');
  });

  it('adds a grey hint under the action and centres a whole-page empty state', () => {
    const { container } = render(
      <EmptyState
        fill
        icon={<svg />}
        title="No goals yet"
        action={<button type="button">Create a goal</button>}
        hint="Examples: emergency fund, trip, new laptop"
      />,
    );
    const hint = screen.getByText('Examples: emergency fund, trip, new laptop');
    expect(hint.className).toBe('seneca-empty-state__hint');
    // The hint follows the button, not the other way round.
    expect(
      screen.getByRole('button', { name: 'Create a goal' }).compareDocumentPosition(hint) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(container.firstElementChild?.className).toContain('seneca-empty-state--fill');
  });
});
