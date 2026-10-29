import { checkOutcome, layoutSubmission } from '@/modules/parsing/helpers/layout-submission.helper';
import { layoutShareConfig } from '@/modules/parsing/services/layout-share.config';

const template = {
  headings: [{ phrase: 'when', role: 'date' as const }],
  columns: [{ role: 'debit' as const, x0: 295.04, x1: 342.000_000_6 }],
  skip: ['member one 14 example street'],
  balances: { start: 'brought forward' },
  institution: 'Northwind Mutual',
};

describe('layoutSubmission', () => {
  it('sends the layout and not the lines the user marked to skip', () => {
    const sent = layoutSubmission(template, 'other', '1.2.0');
    expect(sent).toEqual({
      version: 1,
      bankName: 'other',
      institution: 'Northwind Mutual',
      headings: [{ phrase: 'when', role: 'date' }],
      columns: [{ role: 'debit', x0: 295, x1: 342 }],
      balances: { start: 'brought forward' },
      appVersion: '1.2.0',
    });
    expect(JSON.stringify(sent)).not.toContain('member one');
  });
});

describe('checkOutcome', () => {
  it('tells a passed, a failed and an absent check apart', () => {
    const checks = [
      { code: 'balance_chain', passed: true },
      { code: 'printed_totals', passed: false },
    ];
    expect(checkOutcome(checks, 'balance_chain')).toBe('passed');
    expect(checkOutcome(checks, 'printed_totals')).toBe('failed');
    expect(checkOutcome(checks, 'section_totals')).toBe('unchecked');
    expect(checkOutcome(undefined, 'balance_chain')).toBe('unchecked');
  });
});

describe('layoutShareConfig', () => {
  it('is on by default, offers the e-mail without a service, and never reaches out from tests', () => {
    expect(layoutShareConfig({ NODE_ENV: 'test' })).toEqual({
      enabled: true,
      url: '',
      email: 'peterbaikov12@proton.me',
    });
    expect(layoutShareConfig({ PARSER_SUBMISSIONS_ENABLED: 'False' }).enabled).toBe(false);
    expect(
      layoutShareConfig({ NODE_ENV: 'test', PARSER_SUBMISSIONS_URL: 'https://example.com/submit' }).url,
    ).toBe('https://example.com/submit');
  });
});
