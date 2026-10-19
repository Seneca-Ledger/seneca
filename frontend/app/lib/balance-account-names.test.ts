import { describe, expect, it } from 'vitest';
import { localizeBalanceAccountName } from './balance-account-names';

describe('localizeBalanceAccountName', () => {
  it('translates a preset account the server sent in English, Russian or Kazakh', () => {
    expect(localizeBalanceAccountName('III. Cash', 'de')).toBe('III. Liquide Mittel');
    expect(localizeBalanceAccountName('I. Внеоборотные активы', 'de')).toBe('I. Anlagevermögen');
    expect(localizeBalanceAccountName('Негізгі құралдар', 'ja')).toBe('有形固定資産');
  });

  it("names the app's own crypto and metals accounts in the reader's language", () => {
    expect(localizeBalanceAccountName('Crypto', 'ru')).toBe('Криптовалюта');
    expect(localizeBalanceAccountName('Precious metals', 'fr')).toBe('Métaux précieux');
  });

  it('keeps an account the user named as typed', () => {
    expect(localizeBalanceAccountName('Notgroschen', 'de')).toBe('Notgroschen');
    expect(localizeBalanceAccountName('II. Kassa Studio', 'de')).toBe('II. Kassa Studio');
  });
});
