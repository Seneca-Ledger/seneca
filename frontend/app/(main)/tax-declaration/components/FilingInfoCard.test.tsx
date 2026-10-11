// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@/app/components/dashboard/test-setup';

vi.mock('@/app/i18n', () => ({
  // Every string is its own key, with the one placeholder the card fills in. The card
  // renders some entries as nodes and reads `.value` of others: an array is both.
  useIntlayer: () =>
    new Proxy(
      {},
      {
        get: (_target, key) => {
          const text = `${String(key)} {date}`;
          return Object.assign([text], { value: text });
        },
      },
    ),
  useLocale: () => ({ locale: 'en' }),
}));

import type { FilingInfo } from '../tax-declaration.types';
import { FilingInfoCard } from './FilingInfoCard';

const INFO: FilingInfo = {
  countryCode: 'DE',
  taxYear: 2026,
  formName: 'Einkommensteuererklärung (ESt 1 A)',
  filingOpens: null,
  deadlines: [{ kind: 'standard', date: '2099-08-02' }],
  authorityPreparation: null,
  portal: 'ELSTER',
  sourceUrl: 'https://www.gesetze-im-internet.de/ao_1977/__149.html',
  retention: null,
  basis: 'statute',
  checkedAt: '2026-10-10',
};

describe('FilingInfoCard', () => {
  it('says the dates were worked out from the law, and when it was read', () => {
    render(<FilingInfoCard info={INFO} />);
    expect(screen.getByText('basisStatute Oct 10, 2026')).toBeInTheDocument();
  });

  it('says the dates were published by the authority', () => {
    render(<FilingInfoCard info={{ ...INFO, basis: 'published', checkedAt: '2026-09-14' }} />);
    expect(screen.getByText('basisPublished Sep 14, 2026')).toBeInTheDocument();
  });

  it('says nothing about the basis for a draft saved before it was recorded', () => {
    const { basis: _basis, checkedAt: _checkedAt, ...older } = INFO;
    render(<FilingInfoCard info={older} />);
    expect(screen.queryByText(/^basis/)).not.toBeInTheDocument();
  });

  it('says when no deadline was verified for the case', () => {
    render(<FilingInfoCard info={{ ...INFO, deadlines: [] }} />);
    expect(screen.getByText(/^noVerifiedDeadline/)).toBeInTheDocument();
  });
});
