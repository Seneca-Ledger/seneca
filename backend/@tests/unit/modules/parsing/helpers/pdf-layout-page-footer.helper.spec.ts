import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import { isPageFooterLine } from '@/modules/parsing/helpers/pdf-layout-page-footer.helper';

const row = (text: string): PdfTextRow => ({ text, y: 0, page: 1, items: [] });

describe('isPageFooterLine', () => {
  it('matches the word alone, whatever its case or spacing', () => {
    expect(isPageFooterLine(row('Continued'))).toBe(true);
    expect(isPageFooterLine(row('  continued '))).toBe(true);
  });

  it('keeps a row that only contains the word', () => {
    expect(isPageFooterLine(row('Card Payment to Continued Ltd'))).toBe(false);
    expect(isPageFooterLine(row('Continued on next page'))).toBe(false);
  });
});
