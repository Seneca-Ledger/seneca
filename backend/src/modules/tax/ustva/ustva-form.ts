/**
 * The German VAT advance return (Umsatzsteuer-Voranmeldung, form USt 1 A)
 * filled from the workspace's assessed transactions, Kennzahl by Kennzahl,
 * for typing into Mein ELSTER.
 *
 * Only form years read against the BMF letter are known (FORMS). Line numbers,
 * Kennzahlen and labels are those of that letter; nothing is guessed. Rows the
 * data cannot place on one line are listed as open items instead: a 0 % sale
 * (photovoltaics at 0 %, an export, or exempt — line 15, 22 or 23), and a
 * cross-border reverse-charge row whose payee is not marked as supplying goods
 * or services (line 19 or 35 for a sale, 25–28 or 30 for a purchase).
 */

export type SupplyType = 'goods' | 'services';

export interface UstvaRow {
  transactionId: string;
  direction: 'income' | 'expense';
  reverseCharge: boolean;
  /** The rate's percentage. */
  ratePercent: number;
  /** In euros, converted at the row's own date. */
  net: number;
  /** In euros; the notional tax on a reverse-charge row. */
  tax: number;
  payeeId: string | null;
  payeeName: string | null;
  supplyType: SupplyType | null;
}

export interface UstvaField {
  kz: string;
  /** Line of form USt 1 A. */
  line: number;
  /** Official label, as printed on the form. */
  label: string;
  /** base: whole euros (Bemessungsgrundlage); tax: euros and cents. */
  kind: 'base' | 'tax';
  amount: number;
  transactionIds: string[];
}

export interface UstvaOpenItem {
  reason: 'zero_rated' | 'supply_type_unknown';
  direction: 'income' | 'expense';
  /** The lines the amount belongs on, one of which applies. */
  lines: number[];
  net: number;
  tax: number;
  payeeId: string | null;
  payeeName: string | null;
  transactionIds: string[];
}

export interface UstvaForm {
  form: 'USt 1 A';
  year: number;
  sourceUrl: string;
  checkedAt: string;
  fields: UstvaField[];
  /** Line 50: the advance payment (positive) or the surplus (negative). */
  kz83: number;
  open: UstvaOpenItem[];
}

interface FormYear {
  sourceUrl: string;
  checkedAt: string;
}

/** BMF letter of 29 December 2025, III C 3 - S 7344/00039/007/036. */
export const FORMS: Readonly<Record<number, FormYear>> = {
  2026: {
    sourceUrl:
      'https://www.bundesfinanzministerium.de/Content/DE/Downloads/BMF_Schreiben/Steuerarten/Umsatzsteuer/2025-12-29-vordruckmuster-USt-voranmeldung-2026.html',
    checkedAt: '2026-10-11',
  },
};

/** Kennzahl → line and label, from the 2026 form. */
const LINES: Readonly<Record<string, { line: number; label: string; kind: 'base' | 'tax' }>> = {
  '81': { line: 13, label: 'Steuerpflichtige Umsätze zum Steuersatz von 19 %', kind: 'base' },
  '86': { line: 14, label: 'Steuerpflichtige Umsätze zum Steuersatz von 7 %', kind: 'base' },
  '35': { line: 16, label: 'Steuerpflichtige Umsätze zu anderen Steuersätzen', kind: 'base' },
  '36': { line: 16, label: 'Steuer zu anderen Steuersätzen', kind: 'tax' },
  '41': {
    line: 19,
    label: 'Innergemeinschaftliche Lieferungen an Abnehmer mit USt-IdNr.',
    kind: 'base',
  },
  '89': {
    line: 25,
    label: 'Steuerpflichtige innergemeinschaftliche Erwerbe zum Steuersatz von 19 %',
    kind: 'base',
  },
  '93': {
    line: 26,
    label: 'Steuerpflichtige innergemeinschaftliche Erwerbe zum Steuersatz von 7 %',
    kind: 'base',
  },
  '95': {
    line: 28,
    label: 'Steuerpflichtige innergemeinschaftliche Erwerbe zu anderen Steuersätzen',
    kind: 'base',
  },
  '98': {
    line: 28,
    label: 'Steuer auf innergemeinschaftliche Erwerbe zu anderen Steuersätzen',
    kind: 'tax',
  },
  '46': {
    line: 30,
    label:
      'Sonstige Leistungen eines im übrigen Gemeinschaftsgebiet ansässigen Unternehmers (§ 13b Abs. 1 UStG)',
    kind: 'base',
  },
  '47': { line: 30, label: 'Steuer auf Leistungen nach § 13b Abs. 1 UStG', kind: 'tax' },
  '21': {
    line: 35,
    label: 'Nicht steuerbare sonstige Leistungen gemäß § 18b Satz 1 Nr. 2 UStG',
    kind: 'base',
  },
  '66': {
    line: 38,
    label: 'Vorsteuerbeträge aus Rechnungen von anderen Unternehmern',
    kind: 'tax',
  },
  '61': {
    line: 39,
    label: 'Vorsteuerbeträge aus dem innergemeinschaftlichen Erwerb von Gegenständen',
    kind: 'tax',
  },
  '67': { line: 41, label: 'Vorsteuerbeträge aus Leistungen im Sinne des § 13b UStG', kind: 'tax' },
  '83': {
    line: 50,
    label: 'Verbleibende Umsatzsteuer-Vorauszahlung / verbleibender Überschuss',
    kind: 'tax',
  },
};

/** Where the form works the tax out itself from the base. */
const RATE_OF_BASE: Readonly<Record<string, number>> = { '81': 19, '86': 7, '89': 19, '93': 7 };

const toCents = (euros: number) => Math.round(euros * 100);

/**
 * The form for the period, or NULL when that year's form was not read. Bases
 * are summed in cents and entered in whole euros, the cents dropped — the form
 * asks for whole euros and dropping them is in the taxpayer's favour on sales
 * (USt 1 E, "So werden die Vordrucke ausgefüllt"). The form computes the tax
 * of lines 13, 14, 25 and 26 from those whole-euro bases, and so does Kz 83.
 */
export function buildUstva(year: number, rows: UstvaRow[]): UstvaForm | null {
  const form = FORMS[year];
  if (!form) {
    return null;
  }

  const sums = new Map<string, { cents: number; ids: Set<string> }>();
  const add = (kz: string, euros: number, id: string) => {
    const entry = sums.get(kz) ?? { cents: 0, ids: new Set<string>() };
    entry.cents += toCents(euros);
    entry.ids.add(id);
    sums.set(kz, entry);
  };
  const open = new Map<string, UstvaOpenItem>();
  const addOpen = (row: UstvaRow, reason: UstvaOpenItem['reason'], lines: number[]) => {
    const key = `${reason}:${row.direction}:${row.payeeId ?? row.transactionId}`;
    const item = open.get(key) ?? {
      reason,
      direction: row.direction,
      lines,
      net: 0,
      tax: 0,
      payeeId: row.payeeId,
      payeeName: row.payeeName,
      transactionIds: [],
    };
    item.net = (toCents(item.net) + toCents(row.net)) / 100;
    item.tax = (toCents(item.tax) + toCents(row.tax)) / 100;
    item.transactionIds.push(row.transactionId);
    open.set(key, item);
  };

  for (const row of rows) {
    if (row.direction === 'income') {
      placeSale(row, add, addOpen);
    } else {
      placePurchase(row, add, addOpen);
    }
  }

  const { fields, kz83 } = fieldsOf(sums);

  return {
    form: 'USt 1 A',
    year,
    ...form,
    fields,
    kz83,
    open: [...open.values()],
  };
}

/**
 * The filled lines, in form order, and Kz 83: the tax the form works out from
 * the whole-euro bases, plus the tax entered as such, less the input tax.
 */
function fieldsOf(sums: Map<string, { cents: number; ids: Set<string> }>): {
  fields: UstvaField[];
  kz83: number;
} {
  const fields: UstvaField[] = [];
  let payableCents = 0;
  for (const kz of Object.keys(LINES).filter(code => code !== '83')) {
    const entry = sums.get(kz);
    if (!entry || entry.cents === 0) {
      continue;
    }
    const meta = LINES[kz];
    const amount = meta.kind === 'base' ? Math.trunc(entry.cents / 100) : entry.cents / 100;
    fields.push({ kz, ...meta, amount, transactionIds: [...entry.ids] });
    payableCents += payableEffect(kz, amount, entry.cents);
  }
  return {
    fields: fields.sort((a, b) => a.line - b.line || Number(a.kz) - Number(b.kz)),
    kz83: payableCents / 100,
  };
}

function payableEffect(kz: string, amount: number, cents: number): number {
  if (RATE_OF_BASE[kz] !== undefined) {
    // Whole euros × percent = cents.
    return amount * RATE_OF_BASE[kz];
  }
  if (OWED.has(kz)) {
    return cents;
  }
  return DEDUCTED.has(kz) ? -cents : 0;
}

const OWED = new Set(['36', '98', '47']);
const DEDUCTED = new Set(['66', '61', '67']);

type Add = (kz: string, euros: number, id: string) => void;
type AddOpen = (row: UstvaRow, reason: UstvaOpenItem['reason'], lines: number[]) => void;

function placeSale(row: UstvaRow, add: Add, addOpen: AddOpen): void {
  if (row.reverseCharge) {
    // A supply to a business in another member state: goods are an
    // intra-Community supply (line 19), services are not taxable here (line 35).
    if (row.supplyType === 'goods') {
      add('41', row.net, row.transactionId);
    } else if (row.supplyType === 'services') {
      add('21', row.net, row.transactionId);
    } else {
      addOpen(row, 'supply_type_unknown', [19, 35]);
    }
    return;
  }
  if (row.ratePercent === 19) {
    add('81', row.net, row.transactionId);
  } else if (row.ratePercent === 7) {
    add('86', row.net, row.transactionId);
  } else if (row.ratePercent === 0) {
    // 0 % (photovoltaics, line 15), an export (line 22) or exempt (line 23).
    addOpen(row, 'zero_rated', [15, 22, 23]);
  } else {
    add('35', row.net, row.transactionId);
    add('36', row.tax, row.transactionId);
  }
}

function placePurchase(row: UstvaRow, add: Add, addOpen: AddOpen): void {
  if (!row.reverseCharge) {
    if (row.tax !== 0) {
      add('66', row.tax, row.transactionId);
    }
    return;
  }
  // Reverse charge from a supplier in another member state: the tax is owed
  // and, for a business with full input-tax deduction, deducted again.
  if (row.supplyType === 'services') {
    add('46', row.net, row.transactionId);
    add('47', row.tax, row.transactionId);
    add('67', row.tax, row.transactionId);
  } else if (row.supplyType === 'goods') {
    const kz = row.ratePercent === 19 ? '89' : row.ratePercent === 7 ? '93' : '95';
    add(kz, row.net, row.transactionId);
    if (kz === '95') {
      add('98', row.tax, row.transactionId);
    }
    add('61', row.tax, row.transactionId);
  } else {
    addOpen(row, 'supply_type_unknown', [25, 26, 28, 30]);
  }
}
