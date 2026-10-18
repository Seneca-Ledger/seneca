import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProcessingSection } from './ProcessingSection';

const tx = (_path: string[], fallback: string) => fallback;

describe('ProcessingSection', () => {
  it('names the switch after the setting it changes', () => {
    render(
      <ProcessingSection
        tx={tx}
        processing={{
          settings: {
            categorizationThreshold: 0.7,
            duplicateResolution: 'skip',
            merchantLearning: true,
          },
          loading: false,
          saving: false,
          error: null,
          message: null,
          update: vi.fn(),
        }}
      />,
    );

    expect(screen.getByRole('switch', { name: 'Learn from my corrections' })).toBeChecked();
  });
});
