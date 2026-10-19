// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { OnboardingNavigation } from './OnboardingNavigation';

const labels = { back: 'Back', next: 'Next', skip: 'Skip', saving: 'Saving...' };

describe('OnboardingNavigation', () => {
  it('offers Back only when there is somewhere to go back to', () => {
    const { rerender } = render(
      <OnboardingNavigation
        canGoBack={false}
        isSubmitting={false}
        onBack={vi.fn()}
        onNext={vi.fn()}
        labels={labels}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();

    const onBack = vi.fn();
    rerender(
      <OnboardingNavigation
        canGoBack
        isSubmitting={false}
        onBack={onBack}
        onNext={vi.fn()}
        labels={labels}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows Skip only on steps that pass a handler', () => {
    const onSkip = vi.fn();
    render(
      <OnboardingNavigation
        canGoBack
        isSubmitting={false}
        onBack={vi.fn()}
        onNext={vi.fn()}
        onSkip={onSkip}
        labels={labels}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('keeps Next disabled while a required answer is missing', () => {
    const onNext = vi.fn();
    render(
      <OnboardingNavigation
        canGoBack
        isSubmitting={false}
        nextDisabled
        onBack={vi.fn()}
        onNext={onNext}
        labels={labels}
      />,
    );
    const next = screen.getByRole('button', { name: 'Next' });
    expect(next).toBeDisabled();
    fireEvent.click(next);
    expect(onNext).not.toHaveBeenCalled();
    // Back stays available: the user may want to leave instead of answering.
    expect(screen.getByRole('button', { name: 'Back' })).toBeEnabled();
  });

  it('locks every button while saving', () => {
    render(
      <OnboardingNavigation
        canGoBack
        isSubmitting
        onBack={vi.fn()}
        onNext={vi.fn()}
        onSkip={vi.fn()}
        labels={labels}
      />,
    );
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeDisabled();
  });
});
