// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/app/components/dashboard/test-setup';

const appLocale = vi.hoisted(() => ({ current: 'en' }));

vi.mock('@/app/i18n', () => ({
  // Every string is its own key; the card reads `.value` of some, renders others.
  useIntlayer: () =>
    new Proxy(
      {},
      {
        get: (_target, key) => {
          const text = key === 'nextToStep' ? 'nextToStep {step}' : String(key);
          const node = Object.assign([text], { value: text });
          return key === 'issues'
            ? new Proxy({}, { get: (_t, code) => String(code) })
            : node;
        },
      },
    ),
  useLocale: () => ({ locale: appLocale.current }),
}));

import type { CompletenessReport } from '../tax-declaration.types';
import { DataCheckStep } from './DataCheckStep';

const clean: CompletenessReport = {
  score: 100,
  issues: [],
  activeDaysRatio: 0.71,
  daysSinceLastUpload: 3,
};

describe('DataCheckStep', () => {
  beforeEach(() => {
    appLocale.current = 'en';
  });

  it('lists every check it ran, and flags a year with few recorded days', () => {
    const { container } = render(<DataCheckStep completeness={clean} onGoToStep={vi.fn()} />);

    for (const code of [
      'uncategorized_transactions',
      'unmapped_categories',
      'missing_exchange_rates',
      'statement_coverage_gaps',
    ]) {
      expect(screen.getByText(code)).toBeInTheDocument();
    }
    expect(screen.getByText('71%')).toBeInTheDocument();
    expect(screen.getByText('checkActiveDaysHint')).toBeInTheDocument();
    // Nothing distorts the draft, so the sentence about what does is not said.
    expect(screen.queryByText('dataIntro')).toBeNull();
    expect(container.textContent).toContain('noIssues');
  });

  it('says what distorts the draft only when something does', () => {
    render(
      <DataCheckStep
        completeness={{
          ...clean,
          score: 80,
          issues: [{ code: 'missing_exchange_rates', severity: 'critical', count: 4 }],
        }}
        onGoToStep={vi.fn()}
      />,
    );

    expect(screen.getByText('dataIntro')).toBeInTheDocument();
    expect(screen.queryByText('noIssues')).toBeNull();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it("names unmapped system categories in the reader's language", () => {
    appLocale.current = 'ru';
    render(
      <DataCheckStep
        completeness={{
          ...clean,
          score: 90,
          issues: [
            {
              code: 'unmapped_categories',
              severity: 'warning',
              count: 1,
              params: { categories: [{ name: 'Advertising', transactionCount: 3 }] },
            },
          ],
        }}
        onGoToStep={vi.fn()}
      />,
    );

    expect(screen.getByText('Реклама (3)')).toBeInTheDocument();
  });

  it('leads on to the form lines and back to the profile', () => {
    const onGoToStep = vi.fn();
    render(<DataCheckStep completeness={clean} onGoToStep={onGoToStep} />);

    fireEvent.click(screen.getByRole('button', { name: 'nextToStep stepMapping' }));
    fireEvent.click(screen.getByRole('button', { name: 'back' }));
    expect(onGoToStep.mock.calls).toEqual([['mapping'], ['profile']]);
  });
});
