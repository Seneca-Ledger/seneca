import * as xlsx from 'xlsx';
import type { BalanceAccountNode, BalanceSheetResponse } from '../../contracts';
import { loadPdfMake } from '../reports/report-document.util';

/** The balance sheet as a spreadsheet or a PDF, two columns side by side. */

function formatAmount(value: number, currency: string): string {
  return `${round2(value).toFixed(2)} ${currency}`;
}

function getExportLabels(locale?: string): Record<string, string> {
  const resolvedLocale = locale === 'en' || locale === 'kk' || locale === 'ru' ? locale : 'en';
  const labels = {
    ru: {
      balanceAsOf: 'Баланс на',
      assets: 'Активы',
      liabilities: 'Пассивы',
      total: 'Итого',
      difference: 'Разница',
      balanced: 'Сходится',
      yes: 'Да',
      no: 'Нет',
      notBalanced: 'не сходится',
    },
    en: {
      balanceAsOf: 'Balance sheet as of',
      assets: 'Assets',
      liabilities: 'Liabilities',
      total: 'Total',
      difference: 'Difference',
      balanced: 'Balanced',
      yes: 'Yes',
      no: 'No',
      notBalanced: 'not balanced',
    },
    kk: {
      balanceAsOf: 'Баланс',
      assets: 'Активтер',
      liabilities: 'Пассивтер',
      total: 'Барлығы',
      difference: 'Айырма',
      balanced: 'Сәйкес',
      yes: 'Иә',
      no: 'Жоқ',
      notBalanced: 'сәйкес емес',
    },
  };

  return labels[resolvedLocale];
}

function flattenForExport(
  accounts: BalanceAccountNode[],
  level = 0,
): Array<{ label: string; amount: number }> {
  const rows: Array<{ label: string; amount: number }> = [];

  for (const account of accounts) {
    rows.push({
      label: `${'  '.repeat(level)}${account.name}`,
      amount: round2(account.amount),
    });

    if (account.children.length > 0) {
      rows.push(...flattenForExport(account.children, level + 1));
    }
  }

  return rows;
}

export async function exportBalanceAsExcel(
  data: BalanceSheetResponse,
  locale?: string,
): Promise<Buffer> {
  const labels = getExportLabels(locale);
  const leftRows = flattenForExport(data.assets.sections);
  const rightRows = flattenForExport(data.liabilities.sections);
  const maxRows = Math.max(leftRows.length, rightRows.length);

  const rows: Array<Array<string | number>> = [
    [`${labels.balanceAsOf} ${data.date}`, '', '', ''],
    ['', '', '', ''],
    [
      `${labels.assets} (${formatAmount(data.assets.total, data.currency)})`,
      '',
      `${labels.liabilities} (${formatAmount(data.liabilities.total, data.currency)})`,
      '',
    ],
    ['', '', '', ''],
  ];

  for (let i = 0; i < maxRows; i++) {
    const left = leftRows[i];
    const right = rightRows[i];
    rows.push([
      left?.label || '',
      left ? round2(left.amount) : '',
      right?.label || '',
      right ? round2(right.amount) : '',
    ]);
  }

  rows.push(['', '', '', '']);
  rows.push([
    labels.total,
    round2(data.assets.total),
    labels.total,
    round2(data.liabilities.total),
  ]);
  rows.push([
    labels.difference,
    round2(data.difference),
    labels.balanced,
    data.isBalanced ? labels.yes : labels.no,
  ]);

  const worksheet = xlsx.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = [{ wch: 46 }, { wch: 16 }, { wch: 46 }, { wch: 16 }];

  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Balance');

  return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/**
 * Rendered with pdfmake rather than pdf-lib: pdf-lib's standard fonts are
 * WinAnsi-encoded and throw on Cyrillic, which broke every ru/kk export.
 * pdfmake's bundled Roboto covers those alphabets and paginates on its own,
 * so long sheets are no longer silently cut off at one page.
 */
export async function exportBalanceAsPdf(
  data: BalanceSheetResponse,
  locale?: string,
): Promise<Buffer> {
  const labels = getExportLabels(locale);
  const leftRows = flattenForExport(data.assets.sections);
  const rightRows = flattenForExport(data.liabilities.sections);
  const maxRows = Math.max(leftRows.length, rightRows.length);

  const body: unknown[][] = [
    [
      { text: labels.assets, style: 'th' },
      { text: formatAmount(data.assets.total, data.currency), style: 'thAmount' },
      { text: labels.liabilities, style: 'th' },
      { text: formatAmount(data.liabilities.total, data.currency), style: 'thAmount' },
    ],
  ];

  for (let i = 0; i < maxRows; i++) {
    const left = leftRows[i];
    const right = rightRows[i];
    body.push([
      { text: left?.label ?? '' },
      { text: left ? formatAmount(left.amount, data.currency) : '', alignment: 'right' },
      { text: right?.label ?? '' },
      { text: right ? formatAmount(right.amount, data.currency) : '', alignment: 'right' },
    ]);
  }

  const pdfMake = await loadPdfMake();
  const docDefinition = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [40, 40, 40, 40],
    content: [
      { text: `${labels.balanceAsOf} ${data.date}`, style: 'title' },
      {
        table: { headerRows: 1, widths: ['*', 'auto', '*', 'auto'], body },
        layout: 'lightHorizontalLines',
      },
      {
        text: `${labels.difference}: ${formatAmount(data.difference, data.currency)} (${
          data.isBalanced ? labels.balanced : labels.notBalanced
        })`,
        color: data.isBalanced ? '#1f8033' : '#b33333',
        bold: true,
        margin: [0, 16, 0, 0],
      },
    ],
    styles: {
      title: { bold: true, fontSize: 16, margin: [0, 0, 0, 14] },
      th: { bold: true, fontSize: 11 },
      thAmount: { bold: true, fontSize: 11, alignment: 'right' },
    },
    defaultStyle: { font: 'Roboto', fontSize: 9 },
  };

  return new Promise<Buffer>(resolve => {
    pdfMake.createPdf(docDefinition).getBuffer((buffer: Uint8Array) => {
      resolve(Buffer.from(buffer));
    });
  });
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
