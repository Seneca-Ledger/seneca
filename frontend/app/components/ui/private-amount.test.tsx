// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { setPrivacyMode } from '@/app/lib/privacy-mode';
import { fillTemplateNodes, PrivateAmount } from './private-amount';

afterEach(() => {
  act(() => setPrivacyMode(false));
});

describe('PrivateAmount', () => {
  it('marks the amount for redaction and keeps the exact figure as a tooltip', () => {
    render(<PrivateAmount title="$1,939.42">$1,939</PrivateAmount>);

    const amount = screen.getByText('$1,939');
    expect(amount).toHaveClass('seneca-private');
    expect(amount).toHaveAttribute('title', '$1,939.42');
  });

  it('drops the tooltip in privacy mode, where it would give the figure away', () => {
    render(<PrivateAmount title="$1,939.42">$1,939</PrivateAmount>);

    act(() => setPrivacyMode(true));

    expect(screen.getByText('$1,939')).not.toHaveAttribute('title');
  });
});

describe('fillTemplateNodes', () => {
  it('redacts the amounts of a sentence and leaves its words readable', () => {
    const { container } = render(
      <p>{fillTemplateNodes('{{spent}} of {limit} left', { spent: '$120', limit: '$500' })}</p>,
    );

    expect(container.textContent).toBe('$120 of $500 left');
    expect([...container.querySelectorAll('.seneca-private')].map(node => node.textContent)).toEqual([
      '$120',
      '$500',
    ]);
  });

  it('leaves a placeholder without a value as written', () => {
    const { container } = render(<p>{fillTemplateNodes('{{count}} items', {})}</p>);

    expect(container.textContent).toBe('{{count}} items');
  });
});
