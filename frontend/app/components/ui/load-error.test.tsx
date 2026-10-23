import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoadError } from './load-error';

describe('LoadError', () => {
  it('announces the message with a sad face over it', () => {
    const { container } = render(<LoadError>Could not load the forecast</LoadError>);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Could not load the forecast');
    expect(alert).toHaveClass('seneca-load-error');
    // The face is decoration: the words carry the meaning for a screen reader.
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it('takes the room it is given around it', () => {
    render(<LoadError spacing={6}>Could not load goals</LoadError>);

    expect(screen.getByRole('alert')).toHaveAttribute('data-spacing', '6');
  });
});
