import { type OcrWord, ocrWordsToRows } from '@/common/utils/pdf-ocr.util';

/** A word at x/y in pixels at 300 dpi, 100 px wide and 25 px tall unless given. */
const word = (text: string, x: number, y: number, confidence = 95, height = 25): OcrWord => ({
  text,
  confidence,
  bbox: { x0: x, y0: y, x1: x + 100, y1: y + height },
});

const texts = (words: OcrWord[]) => ocrWordsToRows(words, 1).map(row => row.text);

describe('pdf-ocr.util', () => {
  it('puts words of one printed line in one row, in points, left to right', () => {
    const rows = ocrWordsToRows(
      [word('1,950.31', 2230, 1372), word('Aug', 355, 1372), word('$8.88', 1576, 1370, 95, 29)],
      2,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].text).toBe('Aug $8.88 1,950.31');
    expect(rows[0].items[0]).toMatchObject({ x: 85.2, page: 2 });
  });

  it('keeps a short date the engine is unsure of when its line reads well', () => {
    expect(
      texts([word('Sep', 356, 1929, 42), word('7', 415, 1929, 42), word('POS', 552, 1929), word('Purchase', 616, 1929)]),
    ).toEqual(['Sep 7 POS Purchase']);
  });

  it('drops what table rulings and the margin code read as', () => {
    expect(
      texts([
        // A ruling under a row: dashes, and letters the engine barely believes.
        word('————', 350, 1360, 38),
        word('EEE', 961, 1360, 39),
        word('ERR', 1319, 1360, 37),
        // The margin code beside a row, far left of it.
        word('=', 67, 1329, 85),
        word('5', 74, 1519, 25),
        word('2', 74, 1700, 80),
        word('Aug', 355, 1700),
        word('15', 422, 1700),
      ]),
    ).toEqual(['Aug 15']);
  });
});
