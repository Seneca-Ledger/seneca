import { statementStartPages } from '@/modules/parsing/helpers/pdf-statement-split.helper';
import { BEREKE_STATEMENT_HEADER } from '@/modules/parsing/parsers/bereke-new.parser';

const header = (account: string) => `Выписка по счету\nСчет № ${account}\nза период`;
const ACCOUNT_ONE = 'KZ000000000000000001';
const ACCOUNT_TWO = 'KZ000000000000000002';

describe('statementStartPages', () => {
  it('starts a statement where the header names another account', () => {
    const pages = [header(ACCOUNT_ONE), header(ACCOUNT_TWO), 'Итого обороты'];
    expect(statementStartPages(pages, BEREKE_STATEMENT_HEADER)).toEqual([1, 2]);
  });

  it('keeps one statement whose header repeats on every page', () => {
    const pages = [header(ACCOUNT_ONE), header(ACCOUNT_ONE), 'Итого обороты'];
    expect(statementStartPages(pages, BEREKE_STATEMENT_HEADER)).toEqual([1]);
  });

  it('keeps one statement when no page names an account', () => {
    expect(statementStartPages(['', 'Итого'], BEREKE_STATEMENT_HEADER)).toEqual([1]);
  });
});
