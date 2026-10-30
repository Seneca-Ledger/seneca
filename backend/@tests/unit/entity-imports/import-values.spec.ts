import { detectDateOrder, parseImportDate } from '../../../src/modules/entity-imports/helpers/import-values';

describe('detectDateOrder', () => {
  it('settles the order from one value that reads only one way', () => {
    expect(detectDateOrder(['01/02/2026', '13/02/2026'])).toBe('dmy');
    expect(detectDateOrder(['01/02/2026', '02/13/2026'])).toBe('mdy');
  });

  it('gives null when every value reads both ways, or both kinds occur', () => {
    expect(detectDateOrder(['01/02/2026', '03/04/26'])).toBeNull();
    expect(detectDateOrder(['13/02/2026', '02/13/2026'])).toBeNull();
    expect(detectDateOrder(['2026-02-13', 'not a date'])).toBeNull();
  });
});

describe('parseImportDate with a known order', () => {
  it('reads numeric dates in that order, two-digit years as recent', () => {
    expect(parseImportDate('03/04/2026', 'mdy')).toBe('2026-03-04');
    expect(parseImportDate('03/04/2026', 'dmy')).toBe('2026-04-03');
    expect(parseImportDate('03.04.26', 'dmy')).toBe('2026-04-03');
  });

  it('refuses a day the month does not have instead of rolling it over', () => {
    expect(parseImportDate('02/31/2026', 'mdy')).toBeNull();
  });

  it('leaves ISO dates alone', () => {
    expect(parseImportDate('2026-12-31', 'mdy')).toBe('2026-12-31');
  });
});
