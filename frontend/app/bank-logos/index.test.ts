import { describe, expect, it } from 'vitest';
import { resolveBankLogo } from './index';

describe('resolveBankLogo', () => {
  it.each([
    ['kaspi', 'Kaspi'],
    ['bereke_new', 'Bereke'],
    ['hapoalim', 'Bank Hapoalim'],
    ['absa', 'Absa Bank'],
    ['ally', 'Ally Bank'],
    ['anz', 'ANZ'],
    ['associated', 'Associated Bank'],
    ['atb', 'ATB Financial'],
    ['axis', 'Axis Bank'],
    ['banco_do_brasil', 'Banco do Brasil'],
    ['bank_of_china', 'Bank of China (Hong Kong)'],
    ['bank_of_scotland', 'Bank of Scotland'],
    ['barclays', 'Barclays'],
  ])('names the bank stored as %s by its real name', (bankName, displayName) => {
    expect(resolveBankLogo(bankName).displayName).toBe(displayName);
  });

  it('leaves an unknown bank as other', () => {
    expect(resolveBankLogo('allyship credit union').key).toBe('other');
    expect(resolveBankLogo('other').key).toBe('other');
  });
});
