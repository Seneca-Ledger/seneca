import { balanceAccountName } from '@/modules/balance/balance-account-name';

const preset = {
  name: 'I. Внеоборотные активы',
  nameEn: 'I. Non-current assets',
  nameKk: 'I. Айналымнан тыс активтер',
};

describe('balanceAccountName', () => {
  it('reads the stored (Russian) name in ru and when no language is given', () => {
    expect(balanceAccountName(preset, 'ru')).toBe('I. Внеоборотные активы');
    expect(balanceAccountName(preset)).toBe('I. Внеоборотные активы');
  });

  it('reads the Kazakh column in kk', () => {
    expect(balanceAccountName(preset, 'kk')).toBe('I. Айналымнан тыс активтер');
  });

  it('reads English in en and in every other language, never the Russian name', () => {
    for (const locale of ['en', 'de', 'ja', 'hi']) {
      expect(balanceAccountName(preset, locale)).toBe('I. Non-current assets');
    }
  });

  it('keeps the name of an account the user made, which has no translations', () => {
    const own = { name: 'Notgroschen', nameEn: null, nameKk: null };
    expect(balanceAccountName(own, 'de')).toBe('Notgroschen');
    expect(balanceAccountName(own, 'kk')).toBe('Notgroschen');
  });
});
