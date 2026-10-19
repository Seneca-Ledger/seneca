// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { WorkspaceStep } from './WorkspaceStep';

vi.mock('@/app/i18n', () => ({
  useIntlayer: (key: string) =>
    key === 'onboardingPage'
      ? {
          workspace: {
            title: { value: { en: 'Set up your first workspace', ru: 'RU title' } },
            profileLabel: 'What is this workspace for?',
            profileRequired: 'Choose one to continue.',
          },
        }
      : { workspaceProfileCard: { home: 'Home', business: 'Business' } },
}));

vi.mock('@/app/(main)/workspaces/components/CurrencySelector', () => ({
  CurrencySelector: () => <div>Currency selector</div>,
}));

const props = {
  locale: 'en' as const,
  workspaceName: '',
  workspaceCurrency: 'USD',
  profile: null,
  onWorkspaceNameChange: vi.fn(),
  onWorkspaceCurrencyChange: vi.fn(),
  onProfileChange: vi.fn(),
};

describe('WorkspaceStep', () => {
  it('renders labels in the locale picked on the first step', () => {
    render(<WorkspaceStep {...props} />);

    expect(screen.getByText('Set up your first workspace')).toBeInTheDocument();
    expect(screen.queryByText('RU title')).toBeNull();
  });

  it('asks home or business with nothing pre-selected', () => {
    render(<WorkspaceStep {...props} />);

    const group = screen.getByRole('radiogroup', { name: 'What is this workspace for?' });
    expect(group).toBeInTheDocument();
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toHaveAttribute('aria-checked', 'false');
    }
  });

  it('reports the chosen profile', () => {
    const onProfileChange = vi.fn();
    render(<WorkspaceStep {...props} onProfileChange={onProfileChange} />);

    fireEvent.click(screen.getByRole('radio', { name: /Home/ }));
    expect(onProfileChange).toHaveBeenCalledWith('home');
  });

  it('says why Next is unavailable until the profile is chosen', () => {
    const { rerender } = render(<WorkspaceStep {...props} />);
    expect(screen.getByText('Choose one to continue.')).toBeInTheDocument();

    rerender(<WorkspaceStep {...props} profile="business" />);
    expect(screen.queryByText('Choose one to continue.')).toBeNull();
  });

  it('asks for the language only when the flow has no language step of its own', () => {
    const { rerender } = render(<WorkspaceStep {...props} />);
    expect(document.getElementById('onboarding-locale')).toBeNull();

    rerender(<WorkspaceStep {...props} onLocaleChange={vi.fn()} />);
    expect(document.getElementById('onboarding-locale')).not.toBeNull();
  });

  it('no longer asks for a background image', () => {
    render(<WorkspaceStep {...props} />);

    expect(screen.queryByText(/background/i)).toBeNull();
  });
});
