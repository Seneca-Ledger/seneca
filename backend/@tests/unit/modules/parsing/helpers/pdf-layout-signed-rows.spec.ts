import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import { readLayoutTransactions } from '@/modules/parsing/helpers/pdf-layout-table.helper';

/** A word is [text, x]; width is 5pt per character, height 9pt. */
type Word = [string, number];

const row = (y: number, words: Word[]): PdfTextRow => ({
  page: 1,
  y,
  text: words.map(([text]) => text).join(' '),
  items: words.map(([text, x]) => ({ text, x, y, width: text.length * 5, height: 9, page: 1 })),
});

// "Valor" ends at 563; each amount carries its side after it, as a word of its
// own or glued, and sits 0.6 to 0.8 of a line under the row's kind of entry.
describe('layout rows with the side after the amount', () => {
  it('reads Portuguese headings, (+)/(-) sides and the balance rows apart', () => {
    const rows = readLayoutTransactions([
      row(100, [['Dia', 23], ['Histórico', 84], ['Valor', 540]]),
      row(112.7, [['30/07/2023', 23]]),
      row(117.9, [['Saldo', 84], ['Anterior', 109], ['35,65', 527], ['(+)', 552]]),
      row(132.7, [['03/07/2023', 23], ['PIX', 84], ['-', 101], ['Recebido', 107]]),
      row(137.9, [['1.500,00', 515], ['(+)', 552]]),
      row(143.4, [['03/07', 84], ['07:50', 109], ['MEMBER', 134], ['ONE', 170]]),
      row(152.7, [['03/07/2023', 23], ['Compra', 84], ['com', 118], ['cartao', 138]]),
      row(157.9, [['1.500,00', 517], ['(-)', 554]]),
      row(163.4, [['03/07', 84], ['14:21', 109], ['ACME', 134], ['STORE', 160]]),
      row(172.7, [['20/07/2023', 23], ['PIX', 84], ['-', 101], ['Recebido', 107]]),
      row(179.9, [['120.000,00(+)', 498]]),
      row(183.1, [['20/07', 84], ['15:52', 109], ['ACME', 134], ['HOUSE', 160]]),
      row(192.7, [['31/07/2023', 23]]),
      row(197.9, [['S', 84], ['A', 90], ['L', 96], ['D', 102], ['O', 108], ['120.035,65', 503], ['(+)', 552]]),
    ]);
    expect(rows.map(t => [t.dateText, t.firstLine, t.description, t.amount])).toEqual([
      ['03/07/2023', 'PIX - Recebido', 'PIX - Recebido 07:50 MEMBER ONE', 1500],
      ['03/07/2023', 'Compra com cartao', 'Compra com cartao 14:21 ACME STORE', -1500],
      ['20/07/2023', 'PIX - Recebido', 'PIX - Recebido 15:52 ACME HOUSE', 120000],
    ]);
  });
});
