// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LanguageStep } from './LanguageStep';

vi.mock('@/app/i18n', () => ({
  useIntlayer: (key: string) =>
    key === 'onboardingPage'
      ? {
          language: {
            title: 'Language and timezone',
            greeting: 'Welcome, {name}',
            timeZoneLabel: 'Timezone',
          },
        }
      : { profileCard: { dateFormatLabel: 'Date format', firstDayOfWeekLabel: 'Week starts' } },
}));

const props = {
  locale: 'en' as const,
  timeZone: 'Asia/Almaty',
  dateFormat: 'auto' as const,
  firstDayOfWeek: null,
  onLocaleChange: vi.fn(),
  onTimeZoneChange: vi.fn(),
  onDateFormatChange: vi.fn(),
  onFirstDayOfWeekChange: vi.fn(),
};

describe('LanguageStep', () => {
  it('keeps the timezone input id that the label and e2e tests point at', () => {
    render(<LanguageStep {...props} />);

    expect(document.getElementById('onboarding-timezone-select')).not.toBeNull();
  });

  it('asks for the date format and the first day of the week with the language', () => {
    render(<LanguageStep {...props} />);

    expect(screen.getByText('Date format')).toBeInTheDocument();
    expect(screen.getByText('Week starts')).toBeInTheDocument();
  });

  it('greets the user by name, and only when there is one', () => {
    const { rerender } = render(<LanguageStep {...props} name="Anna" />);
    expect(screen.getByText('Welcome, Anna')).toBeInTheDocument();

    rerender(<LanguageStep {...props} name="  " />);
    expect(screen.queryByText(/Welcome/)).toBeNull();
  });
});
