/**
 * Accounts of DATEV's standard charts SKR 03 and SKR 04 that a small business
 * books to, checked against DATEV's own chart PDFs "Gültig für 2026"
 * (Art.-Nr. 11174 SKR03 / 11175 SKR04, research pass of 2026-10-10).
 *
 * The two charts number the same thing differently — 2100 is interest
 * expense in SKR 03 but private withdrawals in SKR 04 — so a mapping is always
 * kept per chart and never carried across.
 */

export type DatevChart = '03' | '04';

export interface DatevConcept {
  skr03: string;
  skr04: string;
  name03: string;
  name04: string;
}

export const DATEV_CONCEPTS = {
  bank: { skr03: '1200', skr04: '1800', name03: 'Bank', name04: 'Bank' },
  cash: { skr03: '1000', skr04: '1600', name03: 'Kasse', name04: 'Kasse' },
  revenue_19: {
    skr03: '8400',
    skr04: '4400',
    name03: 'Erlöse 19 % USt',
    name04: 'Erlöse 19 % USt',
  },
  revenue_7: { skr03: '8300', skr04: '4300', name03: 'Erlöse 7 % USt', name04: 'Erlöse 7 % USt' },
  revenue_tax_free: {
    skr03: '8100',
    skr04: '4100',
    name03: 'Steuerfreie Umsätze § 4 Nr. 8 ff. UStG',
    name04: 'Steuerfreie Umsätze § 4 Nr. 8 ff. UStG',
  },
  revenue_small_business_19: {
    skr03: '8192',
    skr04: '4184',
    name03: 'Steuerfreie Erlöse Kleinunternehmer nach § 19 Abs. 1 UStG',
    name04: 'Steuerfreie Erlöse Kleinunternehmer nach § 19 Abs. 1 UStG',
  },
  revenue_eu_reverse_charge_services: {
    skr03: '8336',
    skr04: '4336',
    name03:
      'Erlöse aus im anderen EU-Land steuerpflichtigen sonstigen Leistungen, für die der Leistungsempfänger die Umsatzsteuer schuldet',
    name04:
      'Erlöse aus im anderen EU-Land steuerpflichtigen sonstigen Leistungen, für die der Leistungsempfänger die Umsatzsteuer schuldet',
  },
  revenue_domestic_13b: {
    skr03: '8337',
    skr04: '4337',
    name03:
      'Erlöse aus Leistungen, für die der Leistungsempfänger die Umsatzsteuer nach § 13b UStG schuldet',
    name04:
      'Erlöse aus Leistungen, für die der Leistungsempfänger die Umsatzsteuer nach § 13b UStG schuldet',
  },
  goods_purchase_19: {
    skr03: '3400',
    skr04: '5400',
    name03: 'Wareneingang 19 % Vorsteuer',
    name04: 'Wareneingang 19 % Vorsteuer',
  },
  goods_purchase_7: {
    skr03: '3300',
    skr04: '5300',
    name03: 'Wareneingang 7 % Vorsteuer',
    name04: 'Wareneingang 7 % Vorsteuer',
  },
  external_services: {
    skr03: '3100',
    skr04: '5900',
    name03: 'Fremdleistungen',
    name04: 'Fremdleistungen',
  },
  external_services_19: {
    skr03: '3106',
    skr04: '5906',
    name03: 'Fremdleistungen 19 % Vorsteuer',
    name04: 'Fremdleistungen 19 % Vorsteuer',
  },
  external_services_7: {
    skr03: '3108',
    skr04: '5908',
    name03: 'Fremdleistungen 7 % Vorsteuer',
    name04: 'Fremdleistungen 7 % Vorsteuer',
  },
  external_services_no_vat: {
    skr03: '3109',
    skr04: '5909',
    name03: 'Fremdleistungen ohne Vorsteuer',
    name04: 'Fremdleistungen ohne Vorsteuer',
  },
  wages_salaries: {
    skr03: '4100',
    skr04: '6000',
    name03: 'Löhne und Gehälter',
    name04: 'Löhne und Gehälter',
  },
  premises_costs: { skr03: '4200', skr04: '6305', name03: 'Raumkosten', name04: 'Raumkosten' },
  rent: {
    skr03: '4210',
    skr04: '6310',
    name03: 'Miete (unbewegliche Wirtschaftsgüter)',
    name04: 'Miete (unbewegliche Wirtschaftsgüter)',
  },
  telephone: { skr03: '4920', skr04: '6805', name03: 'Telefon', name04: 'Telefon' },
  internet: { skr03: '4925', skr04: '6810', name03: 'Internetkosten', name04: 'Internetkosten' },
  travel_owner: {
    skr03: '4670',
    skr04: '6670',
    name03: 'Reisekosten Unternehmer',
    name04: 'Reisekosten Unternehmer',
  },
  travel_owner_transport: {
    skr03: '4673',
    skr04: '6673',
    name03: 'Reisekosten Unternehmer Fahrtkosten',
    name04: 'Reisekosten Unternehmer Fahrtkosten',
  },
  travel_owner_meals_allowance: {
    skr03: '4674',
    skr04: '6674',
    name03: 'Reisekosten Unternehmer Verpflegungsmehraufwand',
    name04: 'Reisekosten Unternehmer Verpflegungsmehraufwand',
  },
  travel_owner_accommodation: {
    skr03: '4676',
    skr04: '6680',
    name03: 'Reisekosten Unternehmer Übernachtungsaufwand und Reisenebenkosten',
    name04: 'Reisekosten Unternehmer Übernachtungsaufwand und Reisenebenkosten',
  },
  entertainment: {
    skr03: '4650',
    skr04: '6640',
    name03: 'Bewirtungskosten',
    name04: 'Bewirtungskosten',
  },
  entertainment_nondeductible: {
    skr03: '4654',
    skr04: '6644',
    name03: 'Nicht abzugsfähige Bewirtungskosten',
    name04: 'Nicht abzugsfähige Bewirtungskosten',
  },
  gifts_deductible: {
    skr03: '4630',
    skr04: '6610',
    name03: 'Geschenke abzugsfähig ohne § 37b EStG',
    name04: 'Geschenke abzugsfähig ohne § 37b EStG',
  },
  gifts_nondeductible: {
    skr03: '4635',
    skr04: '6620',
    name03: 'Geschenke nicht abzugsfähig ohne § 37b EStG',
    name04: 'Geschenke nicht abzugsfähig ohne § 37b EStG',
  },
  advertising: { skr03: '4600', skr04: '6600', name03: 'Werbekosten', name04: 'Werbekosten' },
  office_supplies: { skr03: '4930', skr04: '6815', name03: 'Bürobedarf', name04: 'Bürobedarf' },
  postage: { skr03: '4910', skr04: '6800', name03: 'Porto', name04: 'Porto' },
  literature: {
    skr03: '4940',
    skr04: '6820',
    name03: 'Zeitschriften, Bücher, digitale Medien (Fachliteratur)',
    name04: 'Zeitschriften, Bücher, digitale Medien (Fachliteratur)',
  },
  training: {
    skr03: '4945',
    skr04: '6821',
    name03: 'Fortbildungskosten',
    name04: 'Fortbildungskosten',
  },
  insurance: { skr03: '4360', skr04: '6400', name03: 'Versicherungen', name04: 'Versicherungen' },
  contributions: { skr03: '4380', skr04: '6420', name03: 'Beiträge', name04: 'Beiträge' },
  legal_consulting: {
    skr03: '4950',
    skr04: '6825',
    name03: 'Rechts- und Beratungskosten',
    name04: 'Rechts- und Beratungskosten',
  },
  bookkeeping: {
    skr03: '4955',
    skr04: '6830',
    name03: 'Buchführungskosten',
    name04: 'Buchführungskosten',
  },
  closing_audit: {
    skr03: '4957',
    skr04: '6827',
    name03: 'Abschluss- und Prüfungskosten',
    name04: 'Abschluss- und Prüfungskosten',
  },
  vehicle_running_costs: {
    skr03: '4530',
    skr04: '6530',
    name03: 'Laufende Fahrzeug-Betriebskosten',
    name04: 'Laufende Fahrzeug-Betriebskosten',
  },
  vehicle_costs_general: {
    skr03: '4500',
    skr04: '6500',
    name03: 'Fahrzeugkosten',
    name04: 'Fahrzeugkosten',
  },
  vehicle_other: {
    skr03: '4580',
    skr04: '6570',
    name03: 'Sonstige Fahrzeugkosten',
    name04: 'Sonstige Fahrzeugkosten',
  },
  bank_fees: {
    skr03: '4970',
    skr04: '6855',
    name03: 'Nebenkosten des Geldverkehrs',
    name04: 'Nebenkosten des Geldverkehrs',
  },
  it_hardware_software_maintenance: {
    skr03: '4806',
    skr04: '6495',
    name03: 'Wartungskosten für Hard- und Software',
    name04: 'Wartungskosten für Hard- und Software',
  },
  software_licenses_rental: {
    skr03: '4964',
    skr04: '6837',
    name03:
      'Aufwendungen für die zeitlich befristete Überlassung von Rechten (Lizenzen, Konzessionen)',
    name04:
      'Aufwendungen für die zeitlich befristete Überlassung von Rechten (Lizenzen, Konzessionen)',
  },
  other_operating_expenses: {
    skr03: '4900',
    skr04: '6300',
    name03: 'Sonstige betriebliche Aufwendungen',
    name04: 'Sonstige betriebliche Aufwendungen',
  },
  vat_prepayments: {
    skr03: '1780',
    skr04: '3820',
    name03: 'Umsatzsteuer-Vorauszahlungen',
    name04: 'Umsatzsteuer-Vorauszahlungen',
  },
  vat_payable_prior_year: {
    skr03: '1790',
    skr04: '3841',
    name03: 'Umsatzsteuerverbindlichkeiten Vorjahr',
    name04: 'Umsatzsteuerverbindlichkeiten Vorjahr',
  },
  vat_receivable_prior_year: {
    skr03: '1546',
    skr04: '1422',
    name03: 'Umsatzsteuerforderungen Vorjahr',
    name04: 'Umsatzsteuerforderungen Vorjahr',
  },
  input_vat_19: {
    skr03: '1576',
    skr04: '1406',
    name03: 'Abziehbare Vorsteuer 19 %',
    name04: 'Abziehbare Vorsteuer 19 %',
  },
  input_vat_7: {
    skr03: '1571',
    skr04: '1401',
    name03: 'Abziehbare Vorsteuer 7 %',
    name04: 'Abziehbare Vorsteuer 7 %',
  },
  output_vat_19: {
    skr03: '1776',
    skr04: '3806',
    name03: 'Umsatzsteuer 19 %',
    name04: 'Umsatzsteuer 19 %',
  },
  output_vat_7: {
    skr03: '1771',
    skr04: '3801',
    name03: 'Umsatzsteuer 7 %',
    name04: 'Umsatzsteuer 7 %',
  },
  private_withdrawals: {
    skr03: '1800',
    skr04: '2100',
    name03: 'Privatentnahmen allgemein',
    name04: 'Privatentnahmen allgemein',
  },
  private_deposits: {
    skr03: '1890',
    skr04: '2180',
    name03: 'Privateinlagen',
    name04: 'Privateinlagen',
  },
  private_taxes: { skr03: '1810', skr04: '2150', name03: 'Privatsteuern', name04: 'Privatsteuern' },
  interest_income: {
    skr03: '2650',
    skr04: '7100',
    name03: 'Sonstige Zinsen und ähnliche Erträge',
    name04: 'Sonstige Zinsen und ähnliche Erträge',
  },
  interest_expense: {
    skr03: '2100',
    skr04: '7300',
    name03: 'Zinsen und ähnliche Aufwendungen',
    name04: 'Zinsen und ähnliche Aufwendungen',
  },
  depreciation_tangible: {
    skr03: '4830',
    skr04: '6220',
    name03: 'Abschreibungen auf Sachanlagen (ohne AfA auf Fahrzeuge und Gebäude)',
    name04: 'Abschreibungen auf Sachanlagen (ohne AfA auf Fahrzeuge und Gebäude)',
  },
  gwg_immediate_writeoff: {
    skr03: '4855',
    skr04: '6260',
    name03: 'Sofortabschreibung geringwertiger Wirtschaftsgüter',
    name04: 'Sofortabschreibungen geringwertiger Wirtschaftsgüter',
  },
  gwg_asset: {
    skr03: '0480',
    skr04: '0670',
    name03: 'Geringwertige Wirtschaftsgüter',
    name04: 'Geringwertige Wirtschaftsgüter',
  },
  gwg_pool_asset: {
    skr03: '0485',
    skr04: '0675',
    name03: 'Wirtschaftsgüter (Sammelposten)',
    name04: 'Wirtschaftsgüter (Sammelposten)',
  },
  gwg_pool_depreciation: {
    skr03: '4862',
    skr04: '6264',
    name03: 'Abschreibungen auf den Sammelposten Wirtschaftsgüter',
    name04: 'Abschreibungen auf den Sammelposten Wirtschaftsgüter',
  },
  cash_in_transit: { skr03: '1360', skr04: '1460', name03: 'Geldtransit', name04: 'Geldtransit' },
  clearing_eur: {
    skr03: '1371',
    skr04: '1486',
    name03: 'Verrechnungskonto Gewinnermittlung § 4 Abs. 3 EStG, nicht ergebniswirksam',
    name04: 'Verrechnungskonto für Gewinnermittlung § 4 Abs. 3 EStG, nicht ergebniswirksam',
  },
  transitory_items: {
    skr03: '1590',
    skr04: '1370',
    name03: 'Durchlaufende Posten',
    name04: 'Durchlaufende Posten',
  },
} as const satisfies Record<string, DatevConcept>;

export type DatevConceptKey = keyof typeof DATEV_CONCEPTS;

export function accountFor(concept: DatevConceptKey, chart: DatevChart): string {
  return chart === '03' ? DATEV_CONCEPTS[concept].skr03 : DATEV_CONCEPTS[concept].skr04;
}

/**
 * Automatic accounts (DATEV function AV/AM): VAT on them is booked by DATEV
 * itself, and a tax key must not be given — "Steuerschlüssel können nur in
 * Verbindung mit Konten ohne Automatik-Funktion genutzt werden". The rate is
 * the one the account books; 0 for the tax-free revenue accounts.
 */
const AUTOMATIC: Record<DatevChart, Record<string, number>> = {
  '03': {
    '8400': 19,
    '8300': 7,
    '8100': 0,
    '8192': 0,
    '8336': 0,
    '8337': 0,
    '3400': 19,
    '3300': 7,
    '3106': 19,
    '3108': 7,
  },
  '04': {
    '4400': 19,
    '4300': 7,
    '4100': 0,
    '4184': 0,
    '4336': 0,
    '4337': 0,
    '5400': 19,
    '5300': 7,
    '5906': 19,
    '5908': 7,
  },
};

/** The VAT rate an automatic account books, or NULL for an ordinary account. */
export function automaticRate(chart: DatevChart, account: string): number | null {
  return AUTOMATIC[chart][account] ?? null;
}

/**
 * What the seeded categories most plausibly book to. A suggestion only:
 * choosing the account is the user's — or their adviser's — call, and only a
 * confirmed mapping is exported. Categories with no single obvious account
 * (travel, utilities, equipment, home office, repairs) get none.
 */
export function suggestedConcept(
  categoryName: string,
  vatRegistered: boolean,
): DatevConceptKey | null {
  switch (categoryName.trim().toLowerCase()) {
    case 'sales':
    case 'services':
      return vatRegistered ? 'revenue_19' : 'revenue_small_business_19';
    case 'interest income':
      return 'interest_income';
    case 'advertising':
      return 'advertising';
    case 'rent':
      return 'rent';
    case 'office supplies':
      return 'office_supplies';
    case 'insurance':
      return 'insurance';
    case 'professional services':
      return 'legal_consulting';
    case 'meals and entertainment':
      return 'entertainment';
    case 'fees and charges':
      return 'bank_fees';
    case 'payroll':
      return 'wages_salaries';
    case 'vehicle expenses':
      return 'vehicle_running_costs';
    case 'interest':
      return 'interest_expense';
    case 'materials':
      return vatRegistered ? 'goods_purchase_19' : null;
    case 'taxes':
      return vatRegistered ? 'vat_prepayments' : 'private_taxes';
    case 'other expenses':
      return 'other_operating_expenses';
    default:
      return null;
  }
}
