import type { Client } from '../../entities/client.entity';
import type { CreditNote } from '../../entities/credit-note.entity';
import type { Invoice } from '../../entities/invoice.entity';
import type { WorkspaceBusinessProfile } from '../../entities/workspace-business-profile.entity';
import { loadPdfMake } from '../reports/report-document.util';
import { type InvoiceLabelMap, renderInvoiceLabels } from './invoice-document.translations';

/**
 * The invoice as a document.
 *
 * It opens with who is billing — legal name, address, tax ids, logo — because
 * an invoice that does not identify its issuer is not a document any client can
 * pay or any auditor can accept, and closes with how to pay it. The tax is
 * broken down per rate, not as one line, so a client can check the figure and a
 * reverse-charged supply can say so.
 */

export interface InvoiceDocumentLine {
  description: string;
  quantity: number;
  unitPrice: number;
  /** Percentage points; null when the line carries no tax. */
  taxRatePercent: number | null;
  taxRateName: string | null;
  isReverseCharge: boolean;
  netAmount: number;
  taxAmount: number;
  grossAmount: number;
}

export interface InvoiceDocumentInput {
  invoice: Invoice;
  client: Client;
  profile: WorkspaceBusinessProfile;
  lines: InvoiceDocumentLine[];
  /** Data URI, or null when the workspace has no logo. */
  logo: string | null;
  /** Stamped across the page: a preview of a draft is not an invoice yet. */
  draft?: boolean;
}

export interface CreditNoteDocumentInput {
  creditNote: CreditNote;
  client: Client;
  profile: WorkspaceBusinessProfile;
  lines: InvoiceDocumentLine[];
  /** The numbers of the invoices this note credits. */
  creditedInvoices: string[];
  logo: string | null;
}

type Cell = { text: string; style?: string };
type Content = Record<string, unknown>;

const MUTED = '#6b7280';
const RULE = '#e5e7eb';

function money(amount: number | string, currency: string): string {
  return `${Number(amount).toFixed(2)} ${currency}`;
}

function quantity(value: number): string {
  // 2 and 2.5 both read better than 2.00 and 2.50 in a quantity column.
  return Number.isInteger(value) ? String(value) : String(Number(value));
}

/** Lines of text, with the empty ones dropped rather than printed as gaps. */
function stack(lines: Array<string | null | undefined>, style: string): Content[] {
  return lines
    .filter((line): line is string => Boolean(line?.trim()))
    .flatMap(line => line.split('\n').map(part => ({ text: part.trim(), style })));
}

function labelled(label: string, value: string | null | undefined): string | null {
  return value?.trim() ? `${label}: ${value.trim()}` : null;
}

/** One row per rate, so a two-rate invoice shows both. */
function taxRows(
  lines: InvoiceDocumentLine[],
  labels: InvoiceLabelMap,
  currency: string,
): Array<[Cell, Cell]> {
  const byRate = new Map<string, { label: string; tax: number }>();
  for (const line of lines) {
    if (line.taxRatePercent === null) {
      continue;
    }
    const key = `${line.taxRatePercent}:${line.isReverseCharge}`;
    const suffix = line.isReverseCharge ? ` · ${labels.reverseCharge}` : '';
    const existing = byRate.get(key) ?? {
      label: `${labels.tax} ${line.taxRatePercent}%${suffix}`,
      tax: 0,
    };
    existing.tax += line.taxAmount;
    byRate.set(key, existing);
  }

  if (byRate.size === 0) {
    return [];
  }
  return [...byRate.values()].map(entry => [
    { text: entry.label, style: 'summaryLabel' },
    { text: money(entry.tax, currency), style: 'summaryValue' },
  ]);
}

const STYLES = {
  title: { bold: true, fontSize: 22 },
  invoiceNumber: { fontSize: 11, color: MUTED, margin: [0, 2, 0, 0] },
  blockLabel: { fontSize: 8, color: MUTED, bold: true, margin: [0, 0, 0, 3] },
  issuerName: { fontSize: 11, bold: true },
  value: { fontSize: 11, bold: true },
  muted: { fontSize: 9, color: MUTED, lineHeight: 1.25 },
  note: { fontSize: 9, bold: true, margin: [0, 6, 0, 0] },
  tableHeader: { bold: true, fontSize: 8, color: MUTED },
  tableHeaderRight: { bold: true, fontSize: 8, color: MUTED, alignment: 'right' },
  cell: { fontSize: 9 },
  cellRight: { fontSize: 9, alignment: 'right' },
  summaryLabel: { fontSize: 9, color: MUTED },
  summaryValue: { fontSize: 9, alignment: 'right' },
  summaryLabelBold: { fontSize: 11, bold: true, margin: [0, 4, 0, 0] },
  summaryValueBold: { fontSize: 11, bold: true, alignment: 'right', margin: [0, 4, 0, 0] },
  footer: { fontSize: 8, color: MUTED, alignment: 'center' },
};

/** The money table: one row per line, the amount column following the prices. */
function linesTable(
  lines: InvoiceDocumentLine[],
  labels: InvoiceLabelMap,
  currency: string,
  pricesIncludeTax: boolean,
): Content {
  return {
    table: {
      headerRows: 1,
      widths: ['*', 40, 70, 44, 70],
      body: [
        [
          { text: labels.description, style: 'tableHeader' },
          { text: labels.quantity, style: 'tableHeaderRight' },
          { text: labels.unitPrice, style: 'tableHeaderRight' },
          { text: labels.taxRate, style: 'tableHeaderRight' },
          { text: labels.amount, style: 'tableHeaderRight' },
        ],
        ...lines.map(line => [
          { text: line.description, style: 'cell' },
          { text: quantity(line.quantity), style: 'cellRight' },
          { text: money(line.unitPrice, currency), style: 'cellRight' },
          {
            text:
              line.taxRatePercent === null
                ? '—'
                : line.isReverseCharge
                  ? '0%'
                  : `${line.taxRatePercent}%`,
            style: 'cellRight',
          },
          {
            text: money(pricesIncludeTax ? line.grossAmount : line.netAmount, currency),
            style: 'cellRight',
          },
        ]),
      ],
    },
    layout: {
      hLineWidth: (index: number, node: { table: { body: unknown[] } }) =>
        index === 0 || index === 1 || index === node.table.body.length ? 0.7 : 0.3,
      vLineWidth: () => 0,
      hLineColor: () => RULE,
      paddingTop: () => 5,
      paddingBottom: () => 5,
    },
  };
}

/** Subtotal, one row per tax rate, and the total. */
function totalsBlock(
  lines: InvoiceDocumentLine[],
  labels: InvoiceLabelMap,
  currency: string,
  document: { subtotal: number | string; total: number | string; pricesIncludeTax: boolean },
): Content {
  return {
    margin: [0, 16, 0, 0],
    columns: [
      {
        width: '*',
        stack: [
          ...(document.pricesIncludeTax ? [{ text: labels.taxIncluded, style: 'muted' }] : []),
          ...(lines.some(line => line.isReverseCharge)
            ? [{ text: labels.reverseCharge, style: 'note' }]
            : []),
        ],
      },
      {
        width: 'auto',
        table: {
          body: [
            [
              { text: labels.subtotal, style: 'summaryLabel' },
              { text: money(document.subtotal, currency), style: 'summaryValue' },
            ],
            ...taxRows(lines, labels, currency),
            [
              { text: labels.total, style: 'summaryLabelBold' },
              { text: money(document.total, currency), style: 'summaryValueBold' },
            ],
          ],
        },
        layout: 'noBorders',
      },
    ],
  };
}

export async function buildInvoicePdf(input: InvoiceDocumentInput): Promise<Buffer> {
  const { invoice, client, profile, lines, logo, draft } = input;
  const labels = renderInvoiceLabels(client.locale);
  const pdfMake = await loadPdfMake();
  const currency = invoice.currency;

  const issuerBlock: Content[] = [
    { text: labels.issuer, style: 'blockLabel' },
    ...stack([profile.legalName], 'issuerName'),
    ...stack(
      [
        profile.addressLines,
        labelled(labels.registrationId, profile.registrationId),
        labelled(labels.taxId, profile.taxId),
        profile.email,
        profile.phone,
        profile.website,
      ],
      'muted',
    ),
  ];

  const clientBlock: Content[] = [
    { text: labels.billTo, style: 'blockLabel' },
    ...stack([client.name], 'value'),
    ...stack([client.billingAddress, labelled(labels.taxId, client.taxId)], 'muted'),
  ];

  const paymentBlock: Content[] = stack(
    [
      profile.bankName ? labelled(labels.bank, profile.bankName) : null,
      labelled(labels.bankAccount, profile.bankAccount),
      labelled(labels.bankCode, profile.bankCode),
      profile.paymentInstructions,
    ],
    'muted',
  );

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 56],
    watermark: draft
      ? { text: labels.draft, color: '#9ca3af', opacity: 0.12, bold: true }
      : undefined,
    content: [
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: labels.invoice, style: 'title' },
              {
                text: invoice.invoiceNumber ?? labels.draft,
                style: 'invoiceNumber',
              },
            ],
          },
          logo
            ? { width: 'auto', image: logo, fit: [140, 56], alignment: 'right' }
            : { width: 'auto', text: '' },
        ],
        margin: [0, 0, 0, 24],
      },
      {
        columns: [
          { width: '*', stack: issuerBlock },
          { width: '*', stack: clientBlock },
          {
            width: 'auto',
            stack: stack(
              [
                `${labels.issueDate}: ${invoice.issueDate}`,
                `${labels.dueDate}: ${invoice.dueDate}`,
              ],
              'muted',
            ),
          },
        ],
        columnGap: 16,
        margin: [0, 0, 0, 24],
      },
      linesTable(lines, labels, currency, invoice.pricesIncludeTax),
      totalsBlock(lines, labels, currency, invoice),
      ...(paymentBlock.length > 0
        ? [
            {
              margin: [0, 28, 0, 0],
              stack: [{ text: labels.paymentDetails, style: 'blockLabel' }, ...paymentBlock],
            },
          ]
        : []),
      ...(invoice.notes?.trim()
        ? [
            {
              margin: [0, 20, 0, 0],
              stack: [
                { text: labels.notes, style: 'blockLabel' },
                ...stack([invoice.notes], 'muted'),
              ],
            },
          ]
        : []),
    ],
    footer: profile.invoiceFooter?.trim()
      ? () => ({
          text: profile.invoiceFooter?.trim(),
          style: 'footer',
          margin: [40, 12, 40, 0],
        })
      : undefined,
    styles: STYLES,
    defaultStyle: { font: 'Roboto', fontSize: 9 },
  };

  return new Promise<Buffer>(resolve => {
    pdfMake.createPdf(docDefinition).getBuffer((buffer: Uint8Array) => {
      resolve(Buffer.from(buffer));
    });
  });
}

/**
 * The credit note as a document.
 *
 * Same issuer, client and money layout as an invoice — it is the same tax
 * document read backwards — but it names the invoices it credits instead of a
 * due date, and carries no payment details: this money is going the other way.
 */
export async function buildCreditNotePdf(input: CreditNoteDocumentInput): Promise<Buffer> {
  const { creditNote, client, profile, lines, creditedInvoices, logo } = input;
  const labels = renderInvoiceLabels(client.locale);
  const pdfMake = await loadPdfMake();
  const currency = creditNote.currency;

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 56],
    content: [
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: labels.creditNote, style: 'title' },
              { text: creditNote.creditNoteNumber ?? '', style: 'invoiceNumber' },
            ],
          },
          logo
            ? { width: 'auto', image: logo, fit: [140, 56], alignment: 'right' }
            : { width: 'auto', text: '' },
        ],
        margin: [0, 0, 0, 24],
      },
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: labels.issuer, style: 'blockLabel' },
              ...stack([profile.legalName], 'issuerName'),
              ...stack(
                [
                  profile.addressLines,
                  labelled(labels.registrationId, profile.registrationId),
                  labelled(labels.taxId, profile.taxId),
                  profile.email,
                  profile.phone,
                ],
                'muted',
              ),
            ],
          },
          {
            width: '*',
            stack: [
              { text: labels.billTo, style: 'blockLabel' },
              ...stack([client.name], 'value'),
              ...stack([client.billingAddress, labelled(labels.taxId, client.taxId)], 'muted'),
            ],
          },
          {
            width: 'auto',
            stack: stack(
              [
                `${labels.issueDate}: ${creditNote.issueDate}`,
                // Which invoices the money comes back off: the one thing a
                // credit note must say to be worth anything to either side.
                ...creditedInvoices.map(number => labels.creditFor.replace('{number}', number)),
              ],
              'muted',
            ),
          },
        ],
        columnGap: 16,
        margin: [0, 0, 0, 24],
      },
      linesTable(lines, labels, currency, creditNote.pricesIncludeTax),
      totalsBlock(lines, labels, currency, creditNote),
      ...(creditNote.reason?.trim()
        ? [
            {
              margin: [0, 20, 0, 0],
              stack: [
                { text: labels.reason, style: 'blockLabel' },
                ...stack([creditNote.reason], 'muted'),
              ],
            },
          ]
        : []),
    ],
    footer: profile.invoiceFooter?.trim()
      ? () => ({
          text: profile.invoiceFooter?.trim(),
          style: 'footer',
          margin: [40, 12, 40, 0],
        })
      : undefined,
    styles: STYLES,
    defaultStyle: { font: 'Roboto', fontSize: 9 },
  };

  return new Promise<Buffer>(resolve => {
    pdfMake.createPdf(docDefinition).getBuffer((buffer: Uint8Array) => {
      resolve(Buffer.from(buffer));
    });
  });
}
