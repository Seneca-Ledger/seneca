import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthGreeting } from './AuthGreeting';

const current = vi.hoisted(() => ({ locale: 'en' }));
vi.mock('@/app/i18n', () => ({ useLocale: () => ({ locale: current.locale }) }));

describe('AuthGreeting', () => {
  it('greets in the interface language', () => {
    current.locale = 'de';
    render(<AuthGreeting />);
    expect(screen.getByRole('heading', { name: 'Willkommen' }).getAttribute('lang')).toBe('de');
  });

  it('holds still: the same heading after time passes', () => {
    vi.useFakeTimers();
    current.locale = 'ru';
    render(<AuthGreeting />);
    vi.advanceTimersByTime(12000);
    expect(screen.getAllByRole('heading')).toHaveLength(1);
    expect(screen.getByRole('heading').textContent).toBe('Добро пожаловать');
    vi.useRealTimers();
  });

  it('falls back to English for unknown locales', () => {
    current.locale = 'xx';
    render(<AuthGreeting />);
    expect(screen.getByRole('heading').textContent).toBe('Welcome');
  });
});
