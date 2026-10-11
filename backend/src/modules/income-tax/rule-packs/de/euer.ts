import {
  type Figure,
  type FormLine,
  type LineItem,
  type PackInput,
  type PackResult,
  type PackWarning,
  type RulePack,
  sumItems,
} from '../types';
import { germanIncomeTax, hasGermanTariff } from './tariff';

/**
 * Anlage EÜR — cash-basis profit statement for the self-employed (§ 4 Abs. 3 EStG).
 *
 * Line and field numbers were checked against the 2025 form published with the
 * BMF letter of 29.08.2025 (VAT lines 18/57/58, gifts 62, entertainment 63 and
 * the catch-all line 60 in a second pass on 2026-10-11). Lines whose number was
 * not checked carry NULL; the limits applied below are quoted from the same
 * letter's instructions. Gifts and entertainment have two fields: not
 * deductible (164 / 165) and deductible (174 / 175).
 */

const ENTERTAINMENT_DEDUCTIBLE_PERCENT = 70;
const GIFT_EXEMPTION_LIMIT_MINOR = 50_00;
const HOME_OFFICE_DAILY_MINOR = 6_00;
const HOME_OFFICE_ANNUAL_CAP_MINOR = 1_260_00;
const ARBEITSZIMMER_MONTHLY_MINOR = 105_00;

const LINES: FormLine[] = [
  {
    key: 'revenue_small_business',
    section: 'income',
    lineNo: '12',
    fieldNo: '111',
    label: 'Revenue as a small business, VAT-exempt (Betriebseinnahmen als Kleinunternehmer)',
    suggestedFor: [],
  },
  {
    key: 'revenue_vatable',
    section: 'income',
    lineNo: '15',
    fieldNo: '112',
    label: 'Revenue subject to VAT (umsatzsteuerpflichtige Betriebseinnahmen)',
    suggestedFor: ['Sales', 'Services'],
  },
  {
    key: 'revenue_vat_free',
    section: 'income',
    lineNo: '16',
    fieldNo: '103',
    label: 'VAT-free revenue (umsatzsteuerfreie Betriebseinnahmen)',
    suggestedFor: [],
  },
  {
    key: 'vat_received',
    section: 'income',
    lineNo: '17',
    fieldNo: '140',
    label: 'VAT collected, incl. on private use (vereinnahmte Umsatzsteuer)',
    suggestedFor: [],
  },
  {
    key: 'vat_refunded',
    section: 'income',
    lineNo: '18',
    fieldNo: '141',
    label: 'VAT refunded by the tax office (vom Finanzamt erstattete Umsatzsteuer)',
    suggestedFor: [],
  },
  {
    key: 'goods',
    section: 'expense',
    lineNo: '27',
    fieldNo: '100',
    label: 'Goods, raw materials and supplies (Waren, Rohstoffe und Hilfsstoffe)',
    suggestedFor: ['Materials'],
  },
  {
    key: 'external_services',
    section: 'expense',
    lineNo: '29',
    fieldNo: '110',
    label: 'Bought-in services (bezogene Fremdleistungen)',
    suggestedFor: [],
  },
  {
    key: 'personnel',
    section: 'expense',
    lineNo: '30',
    fieldNo: '120',
    label: 'Staff costs (Ausgaben für eigenes Personal)',
    suggestedFor: ['Payroll', 'Benefits and compensation'],
  },
  {
    key: 'depreciation',
    section: 'expense',
    lineNo: '31–38',
    fieldNo: null,
    label: 'Depreciation (Absetzung für Abnutzung, AfA)',
    suggestedFor: [],
  },
  {
    key: 'rent',
    section: 'expense',
    lineNo: '39',
    fieldNo: '150',
    label: 'Rent for business premises (Miete/Pacht für Geschäftsräume)',
    suggestedFor: ['Rent'],
  },
  {
    key: 'telecom',
    section: 'expense',
    lineNo: '43',
    fieldNo: '280',
    label: 'Telecommunications (Aufwendungen für Telekommunikation)',
    suggestedFor: [],
  },
  {
    key: 'travel',
    section: 'expense',
    lineNo: '44',
    fieldNo: '221',
    label: 'Accommodation and travel costs, excl. transport (Übernachtungs- und Reisenebenkosten)',
    suggestedFor: ['Travel'],
  },
  {
    key: 'advisory',
    section: 'expense',
    lineNo: '46',
    fieldNo: '194',
    label: 'Legal and tax advice, bookkeeping (Rechts- und Steuerberatung, Buchführung)',
    suggestedFor: ['Professional services'],
  },
  {
    key: 'advertising',
    section: 'expense',
    lineNo: '54',
    fieldNo: '224',
    label: 'Advertising (Werbeaufwendungen)',
    suggestedFor: ['Advertising'],
  },
  {
    key: 'entertainment',
    section: 'expense',
    lineNo: '63',
    fieldNo: '165 / 175',
    label: 'Business entertainment, 70% deductible (Bewirtungsaufwendungen)',
    suggestedFor: ['Meals and entertainment'],
  },
  {
    key: 'gifts',
    section: 'expense',
    lineNo: '62',
    fieldNo: '164 / 174',
    label: 'Gifts to business contacts, max. 50 EUR per recipient (Geschenke)',
    suggestedFor: [],
  },
  {
    key: 'other_expenses',
    section: 'expense',
    lineNo: '60',
    fieldNo: '183',
    label: 'Other fully deductible business expenses (übrige Betriebsausgaben)',
    suggestedFor: [
      'Fees and charges',
      'Insurance',
      'Office supplies',
      'Utilities',
      'Maintenance and repairs',
      'Other expenses',
    ],
  },
  {
    key: 'input_vat_paid',
    section: 'expense',
    lineNo: '57',
    fieldNo: '185',
    label: 'Input VAT paid (gezahlte Vorsteuerbeträge)',
    suggestedFor: [],
  },
  {
    key: 'vat_paid_to_office',
    section: 'expense',
    lineNo: '58',
    fieldNo: '186',
    label: 'VAT paid to the tax office (an das Finanzamt gezahlte Umsatzsteuer)',
    suggestedFor: [],
  },
  {
    key: 'not_business',
    section: 'excluded',
    lineNo: null,
    fieldNo: null,
    label: 'Not part of this form (private, or reported elsewhere)',
    suggestedFor: ['Interest income'],
  },
];

function lineFigure(line: FormLine, amountMinor: number, deductibleMinor = amountMinor): Figure {
  return {
    key: line.key,
    lineNo: line.lineNo,
    fieldNo: line.fieldNo,
    label: line.label,
    section: line.section,
    amountMinor,
    deductibleMinor,
  };
}

/**
 * Gifts are an exemption limit (Freigrenze), not an allowance: once one
 * recipient's gifts in the year pass 50 EUR, none of them are deductible.
 */
function deductibleGifts(items: LineItem[] | undefined, warnings: PackWarning[]): number {
  const perRecipient = new Map<string, number>();
  for (const item of items ?? []) {
    const recipient = item.counterparty.trim().toLowerCase() || '—';
    perRecipient.set(recipient, (perRecipient.get(recipient) ?? 0) + item.amountMinor);
  }

  let deductible = 0;
  for (const [recipient, total] of perRecipient) {
    if (total > GIFT_EXEMPTION_LIMIT_MINOR) {
      warnings.push({
        code: 'de_gift_limit_exceeded',
        lineKey: 'gifts',
        params: { recipient, amountMinor: total },
      });
    } else {
      deductible += total;
    }
  }
  return deductible;
}

function readWholeNumber(value: unknown, max: number): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return 0;
  }
  return Math.min(Math.floor(number), max);
}

/**
 * The daily home-office allowance and the annual study flat rate are
 * alternatives. When the profile claims both, only the annual one is used and
 * the user is told, rather than silently summing two things the law forbids
 * combining.
 */
function homeOfficeMinor(details: Record<string, unknown>, warnings: PackWarning[]): number {
  const days = readWholeNumber(details.homeOfficeDays, 366);
  const studyMonths = readWholeNumber(details.homeStudyMonths, 12);

  if (studyMonths > 0) {
    if (days > 0) {
      warnings.push({ code: 'de_home_office_exclusive' });
    }
    return HOME_OFFICE_ANNUAL_CAP_MINOR - ARBEITSZIMMER_MONTHLY_MINOR * (12 - studyMonths);
  }

  return Math.min(days * HOME_OFFICE_DAILY_MINOR, HOME_OFFICE_ANNUAL_CAP_MINOR);
}

function totalFigure(
  key: string,
  lineNo: string,
  fieldNo: string,
  label: string,
  section: 'total' | 'result',
  amountMinor: number,
): Figure {
  return { key, lineNo, fieldNo, label, section, amountMinor, deductibleMinor: amountMinor };
}

function compute(input: PackInput): PackResult {
  const warnings: PackWarning[] = [];
  const figures: Figure[] = [];

  let incomeMinor = 0;
  let expenseMinor = 0;

  for (const formLine of LINES) {
    if (formLine.section === 'excluded') {
      continue;
    }
    const amount = sumItems(input.items[formLine.key]);
    let deductible = amount;

    if (formLine.key === 'entertainment') {
      deductible = Math.trunc((amount * ENTERTAINMENT_DEDUCTIBLE_PERCENT) / 100);
      if (amount > 0) {
        warnings.push({ code: 'de_entertainment_records', lineKey: 'entertainment' });
      }
    } else if (formLine.key === 'gifts') {
      deductible = deductibleGifts(input.items.gifts, warnings);
    }

    if (formLine.section === 'income') {
      incomeMinor += amount;
    } else {
      expenseMinor += deductible;
    }
    figures.push(lineFigure(formLine, amount, deductible));
  }

  const homeOffice = homeOfficeMinor(input.details, warnings);
  if (homeOffice > 0) {
    const studyClaimed = readWholeNumber(input.details.homeStudyMonths, 12) > 0;
    figures.push({
      key: 'home_office',
      lineNo: studyClaimed ? '65' : '66',
      fieldNo: null,
      label: studyClaimed
        ? 'Home study, annual flat rate (Jahrespauschale häusliches Arbeitszimmer)'
        : 'Home office, 6 EUR per day (Tagespauschale)',
      section: 'expense',
      amountMinor: homeOffice,
      deductibleMinor: homeOffice,
    });
    expenseMinor += homeOffice;
  }

  if (input.details.smallBusiness === true && sumItems(input.items.revenue_vatable) > 0) {
    warnings.push({ code: 'de_small_business_with_vat_revenue', lineKey: 'revenue_vatable' });
  }

  const profitMinor = incomeMinor - expenseMinor;

  figures.push(
    totalFigure(
      'income_total',
      '23',
      '159',
      'Total business income (Summe Betriebseinnahmen)',
      'total',
      incomeMinor,
    ),
    totalFigure(
      'expense_total',
      '75',
      '199',
      'Total business expenses (Summe Betriebsausgaben)',
      'total',
      expenseMinor,
    ),
    totalFigure(
      'profit',
      '97',
      '219',
      'Profit (steuerpflichtiger Gewinn/Verlust)',
      'result',
      profitMinor,
    ),
  );

  return { figures, warnings, taxEstimate: estimate(profitMinor, input.taxYear) };
}

function estimate(profitMinor: number, taxYear: number): PackResult['taxEstimate'] {
  if (!hasGermanTariff(taxYear)) {
    return null;
  }
  const taxEuros = germanIncomeTax(Math.floor(profitMinor / 100), taxYear) ?? 0;
  return {
    amountMinor: taxEuros * 100,
    basis: `§ 32a EStG ${taxYear}, single assessment, with this profit as the only taxable income`,
    excludes: [
      'Other income (employment, rental, capital)',
      'Special expenses and allowances (Sonderausgaben, außergewöhnliche Belastungen)',
      'Solidarity surcharge and church tax',
      'Joint assessment of spouses (Splitting)',
      'Trade tax (Gewerbesteuer)',
    ],
  };
}

export const deEuerPack: RulePack = {
  formKey: 'de-euer',
  name: 'Anlage EÜR',
  countryCode: 'DE',
  taxpayerTypes: ['self_employed'],
  taxYears: [2025, 2026],
  formEditionYear: 2025,
  filingChannel: 'ELSTER (elster.de) — registration for a certificate can take up to two weeks',
  lines: LINES,
  // Under cash accounting VAT is income when collected and an expense when
  // paid, so a VAT-registered business reports revenue and costs net and the
  // tax on these two lines.
  vatLines: { output: 'vat_received', input: 'input_vat_paid' },
  compute,
};
