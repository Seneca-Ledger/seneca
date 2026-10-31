// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Figure } from '../Figure';

describe('Figure', () => {
  it('tells the stylesheet how many characters the figure has, nested markup included', () => {
    const figure = '$12,345';
    render(
      <Figure className="seneca-chart__total">
        <span>{figure}</span>
      </Figure>,
    );
    const value = screen.getByText(figure).parentElement;
    expect(value).toHaveClass('seneca-figure__value', 'seneca-chart__total');
    expect(value?.parentElement).toHaveClass('seneca-figure');
    expect(value?.style.getPropertyValue('--figure-chars')).toBe(String(figure.length));
  });

  it('counts at least one character while the figure is a placeholder', () => {
    const { container } = render(<Figure>{null}</Figure>);
    const value = container.querySelector<HTMLElement>('.seneca-figure__value');
    expect(value?.style.getPropertyValue('--figure-chars')).toBe('1');
  });
});
