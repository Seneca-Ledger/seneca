/**
 * Writes an invoice as an XRechnung 3.0 in UN/CEFACT CII — the structured
 * e-invoice German B2B invoicing requires (§ 14 UStG from 2025/2027/2028),
 * conforming to EN 16931 and the KoSIT XRechnung CIUS.
 *
 * Pure: it takes the figures and parties as they are and does no lookup. The
 * VAT breakdown follows EN 16931 (BR-CO-17): per category and rate, the tax
 * is the summed net times the rate, rounded once — so it may differ by a
 * cent from line-by-line rounding, and the XML is what counts.
 *
 * Every rule a value depends on is checked first; an invoice that cannot be
 * a valid XRechnung gets the list of what is missing, never a broken file.
 */

import { parsePeppolId } from './peppol-id';

/** UNCL 5305 categories a Lumio invoice line can be. */
export type XRechnungCategory = 'S' | 'Z' | 'E' | 'AE' | 'K';

export interface XRechnungParty {
  name: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  countryCode: string | null;
  vatId: string | null;
  email: string | null;
  /**
   * The party's Peppol participant id, `scheme:value` (e.g. `9930:DE123456789`).
   * When set it is the electronic address (BT-34/BT-49) instead of the e-mail.
   */
  peppolId?: string | null;
}

export interface XRechnungInput {
  /** UNCL 1001: 380 commercial invoice, 381 credit note. */
  typeCode?: '380' | '381';
  /** BG-3: the invoice a credit note corrects. */
  precedingInvoice?: { number: string; issueDate: string } | null;
  number: string | null;
  issueDate: string;
  dueDate: string | null;
  deliveryDate: string | null;
  currency: string;
  /** BT-10, mandatory in XRechnung (BR-DE-15). */
  buyerReference: string | null;
  note: string | null;
  seller: XRechnungParty & {
    taxNumber: string | null;
    registrationId: string | null;
    contactName: string | null;
    phone: string | null;
    iban: string | null;
    bic: string | null;
  };
  buyer: XRechnungParty;
  lines: Array<{
    name: string;
    quantity: number;
    unitCode: string;
    /** Net line amount, BT-131: after the line's discount or surcharge. */
    net: number;
    /**
     * A discount (negative amount) or surcharge (positive) on the line, as a
     * percentage of the net amount before it (BG-27 / BG-28). Omitted when none.
     */
    adjustment?: { percent: number; amount: number } | null;
    category: XRechnungCategory;
    /** Percent; 0 for every category but S. */
    rate: number;
    /** Why a non-S line carries no tax (BT-120); required for E, AE and K. */
    exemptionReason: string | null;
  }>;
}

export type XRechnungMissing =
  | 'number'
  | 'buyer_reference'
  | 'seller_name'
  | 'seller_street'
  | 'seller_postal_code'
  | 'seller_city'
  | 'seller_country'
  | 'seller_vat_or_tax_number'
  | 'seller_vat_id'
  | 'seller_contact'
  | 'seller_phone'
  | 'seller_email'
  | 'seller_iban'
  | 'buyer_name'
  | 'buyer_street'
  | 'buyer_postal_code'
  | 'buyer_city'
  | 'buyer_country'
  | 'buyer_email'
  | 'buyer_vat_id'
  | 'delivery_date'
  | 'lines';

export const XRECHNUNG_SPECIFICATION =
  'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0';
export const PEPPOL_BILLING = 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0';

/** VATEX codes for the exemption reasons EN 16931 knows by code. */
export const EXEMPTION_CODES: Partial<Record<XRechnungCategory, string>> = {
  AE: 'VATEX-EU-AE',
  K: 'VATEX-EU-IC',
};

export const blank = (value: string | null | undefined) => !value?.trim();

/** What the invoice still needs before it can be written; empty when nothing. */
export function missingForXRechnung(input: XRechnungInput): XRechnungMissing[] {
  const { seller, buyer } = input;
  const categories = new Set(input.lines.map(line => line.category));
  const checks: Array<[XRechnungMissing, boolean]> = [
    ['number', blank(input.number)],
    ['buyer_reference', blank(input.buyerReference)],
    ['seller_name', blank(seller.name)],
    ['seller_street', blank(seller.street)],
    ['seller_postal_code', blank(seller.postalCode)],
    ['seller_city', blank(seller.city)],
    ['seller_country', blank(seller.countryCode)],
    // BR-S-02 / BR-E-02: a VAT id or a tax number for taxed or exempt lines.
    ['seller_vat_or_tax_number', blank(seller.vatId) && blank(seller.taxNumber)],
    // BR-AE-02 / BR-K-02: both VAT ids for a reverse charge or an EU supply.
    ['seller_vat_id', (categories.has('AE') || categories.has('K')) && blank(seller.vatId)],
    ['buyer_vat_id', (categories.has('AE') || categories.has('K')) && blank(buyer.vatId)],
    // BR-IC-11: an intra-Community supply states when the goods were delivered.
    ['delivery_date', categories.has('K') && blank(input.deliveryDate)],
    // BR-DE-2/5/6/7: a seller contact with name, phone and e-mail.
    ['seller_contact', blank(seller.contactName) && blank(seller.name)],
    ['seller_phone', blank(seller.phone)],
    ['seller_email', blank(seller.email)],
    // Payment by SEPA credit transfer (code 58) needs the IBAN (BR-DE-19).
    ['seller_iban', blank(seller.iban)],
    ['buyer_name', blank(buyer.name)],
    ['buyer_street', blank(buyer.street)],
    ['buyer_postal_code', blank(buyer.postalCode)],
    ['buyer_city', blank(buyer.city)],
    ['buyer_country', blank(buyer.countryCode)],
    // XRechnung 3.0: the buyer's electronic address (BT-49): e-mail or Peppol id.
    ['buyer_email', blank(buyer.email) && !parsePeppolId(buyer.peppolId)],
    ['lines', input.lines.length === 0],
  ];
  return checks.filter(([, missing]) => missing).map(([field]) => field);
}

export const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export const cents = (value: number) => Math.round(value * 100);
export const money = (centsValue: number) => (centsValue / 100).toFixed(2);
const date102 = (value: string) => value.slice(0, 10).replace(/-/g, '');
/** Quantities and unit prices keep up to four decimals, without trailing zeros. */
export const decimal = (value: number) => String(Number(value.toFixed(4)));
export const percent = (value: number) => String(Number(value.toFixed(2)));

function element(name: string, value: string | null | undefined, attributes = ''): string {
  return value === null || value === undefined || value.trim() === ''
    ? ''
    : `<${name}${attributes}>${escapeXml(value.trim())}</${name}>`;
}

function dateTime(name: string, value: string): string {
  return `<${name}><udt:DateTimeString format="102">${date102(value)}</udt:DateTimeString></${name}>`;
}

function address(party: XRechnungParty): string {
  return [
    '<ram:PostalTradeAddress>',
    element('ram:PostcodeCode', party.postalCode),
    element('ram:LineOne', party.street),
    element('ram:CityName', party.city),
    element('ram:CountryID', party.countryCode?.toUpperCase()),
    '</ram:PostalTradeAddress>',
  ].join('');
}

/** BT-34/BT-49: the Peppol participant id when the party has one, else the e-mail. */
function electronicAddress(party: XRechnungParty): string {
  const peppol = parsePeppolId(party.peppolId);
  if (peppol) {
    return `<ram:URIUniversalCommunication>${element('ram:URIID', peppol.value, ` schemeID="${peppol.scheme}"`)}</ram:URIUniversalCommunication>`;
  }
  return party.email
    ? `<ram:URIUniversalCommunication>${element('ram:URIID', party.email, ' schemeID="EM"')}</ram:URIUniversalCommunication>`
    : '';
}

function taxRegistrations(vatId: string | null, taxNumber: string | null): string {
  return [
    vatId
      ? `<ram:SpecifiedTaxRegistration>${element('ram:ID', vatId.replace(/\s+/g, ''), ' schemeID="VA"')}</ram:SpecifiedTaxRegistration>`
      : '',
    taxNumber
      ? `<ram:SpecifiedTaxRegistration>${element('ram:ID', taxNumber, ' schemeID="FC"')}</ram:SpecifiedTaxRegistration>`
      : '',
  ].join('');
}

export interface Breakdown {
  category: XRechnungCategory;
  rate: number;
  baseCents: number;
  taxCents: number;
  exemptionReason: string | null;
}

/** BG-23: one entry per category and rate, tax rounded once on the summed base (BR-CO-17). */
export function vatBreakdownOf(lines: XRechnungInput['lines']): Breakdown[] {
  const groups = new Map<string, Breakdown>();
  for (const line of lines) {
    const key = `${line.category}:${line.rate}`;
    const group = groups.get(key) ?? {
      category: line.category,
      rate: line.rate,
      baseCents: 0,
      taxCents: 0,
      exemptionReason: line.exemptionReason,
    };
    group.baseCents += cents(line.net);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    group.taxCents = group.category === 'S' ? Math.round((group.baseCents * group.rate) / 100) : 0;
  }
  return [...groups.values()];
}

function tradeTax(group: Breakdown): string {
  return [
    '<ram:ApplicableTradeTax>',
    `<ram:CalculatedAmount>${money(group.taxCents)}</ram:CalculatedAmount>`,
    '<ram:TypeCode>VAT</ram:TypeCode>',
    group.category === 'S' ? '' : element('ram:ExemptionReason', group.exemptionReason),
    `<ram:BasisAmount>${money(group.baseCents)}</ram:BasisAmount>`,
    `<ram:CategoryCode>${group.category}</ram:CategoryCode>`,
    element('ram:ExemptionReasonCode', EXEMPTION_CODES[group.category]),
    `<ram:RateApplicablePercent>${percent(group.rate)}</ram:RateApplicablePercent>`,
    '</ram:ApplicableTradeTax>',
  ].join('');
}

/**
 * A line allowance (BG-27) or charge (BG-28). An allowance carries reason
 * code 95 (UNTDID 5189, discount); a charge only its reason text, which
 * BR-42/BR-44 accept in place of a code.
 */
function lineAllowanceCharge(percentValue: number, baseCents: number, amountCents: number): string {
  const charge = amountCents > 0;
  return [
    '<ram:SpecifiedTradeAllowanceCharge>',
    `<ram:ChargeIndicator><udt:Indicator>${charge}</udt:Indicator></ram:ChargeIndicator>`,
    `<ram:CalculationPercent>${percent(Math.abs(percentValue))}</ram:CalculationPercent>`,
    `<ram:BasisAmount>${money(baseCents)}</ram:BasisAmount>`,
    `<ram:ActualAmount>${money(Math.abs(amountCents))}</ram:ActualAmount>`,
    charge ? '' : '<ram:ReasonCode>95</ram:ReasonCode>',
    `<ram:Reason>${charge ? 'Surcharge' : 'Discount'}</ram:Reason>`,
    '</ram:SpecifiedTradeAllowanceCharge>',
  ].join('');
}

function lineItem(line: XRechnungInput['lines'][number], index: number): string {
  const netCents = cents(line.net);
  const adjustmentCents = line.adjustment ? cents(line.adjustment.amount) : 0;
  // The price is before the adjustment; the line total is price × quantity
  // less the allowance or plus the charge (BR-LIN-04).
  const baseCents = netCents - adjustmentCents;
  const unitPrice = line.quantity === 0 ? 0 : baseCents / 100 / line.quantity;
  return [
    '<ram:IncludedSupplyChainTradeLineItem>',
    `<ram:AssociatedDocumentLineDocument><ram:LineID>${index + 1}</ram:LineID></ram:AssociatedDocumentLineDocument>`,
    `<ram:SpecifiedTradeProduct>${element('ram:Name', line.name)}</ram:SpecifiedTradeProduct>`,
    '<ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice>',
    `<ram:ChargeAmount>${decimal(unitPrice)}</ram:ChargeAmount>`,
    '</ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>',
    `<ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="${escapeXml(line.unitCode)}">${decimal(line.quantity)}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>`,
    '<ram:SpecifiedLineTradeSettlement>',
    '<ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode>',
    `<ram:CategoryCode>${line.category}</ram:CategoryCode>`,
    `<ram:RateApplicablePercent>${percent(line.rate)}</ram:RateApplicablePercent>`,
    '</ram:ApplicableTradeTax>',
    line.adjustment && adjustmentCents !== 0
      ? lineAllowanceCharge(line.adjustment.percent, baseCents, adjustmentCents)
      : '',
    `<ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${money(netCents)}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>`,
    '</ram:SpecifiedLineTradeSettlement>',
    '</ram:IncludedSupplyChainTradeLineItem>',
  ].join('');
}

/**
 * BG-13: where and when the goods went. An intra-Community supply names the
 * country delivered to (BR-IC-12), and XRechnung then wants the whole address
 * (BR-DE-10/11): the buyer's.
 */
function delivery(input: XRechnungInput, breakdown: Breakdown[]): string {
  const shipTo = breakdown.some(group => group.category === 'K')
    ? `<ram:ShipToTradeParty>${address(input.buyer)}</ram:ShipToTradeParty>`
    : '';
  const event = input.deliveryDate
    ? `<ram:ActualDeliverySupplyChainEvent>${dateTime('ram:OccurrenceDateTime', input.deliveryDate)}</ram:ActualDeliverySupplyChainEvent>`
    : '';
  return shipTo || event
    ? `<ram:ApplicableHeaderTradeDelivery>${shipTo}${event}</ram:ApplicableHeaderTradeDelivery>`
    : '<ram:ApplicableHeaderTradeDelivery/>';
}

export function paymentTermsText(input: XRechnungInput): string {
  if (input.typeCode === '381') {
    return 'Der Betrag wird gutgeschrieben bzw. erstattet.';
  }
  return input.dueDate
    ? `Zahlbar bis ${input.dueDate.slice(8, 10)}.${input.dueDate.slice(5, 7)}.${input.dueDate.slice(0, 4)} ohne Abzug.`
    : 'Zahlbar sofort ohne Abzug.';
}

/** BG-3, after the totals as CII orders it: the invoice this credit note corrects. */
function precedingInvoice(input: XRechnungInput): string {
  const preceding = input.precedingInvoice;
  if (!preceding) {
    return '';
  }
  return [
    '<ram:InvoiceReferencedDocument>',
    element('ram:IssuerAssignedID', preceding.number),
    `<ram:FormattedIssueDateTime><qdt:DateTimeString format="102">${date102(preceding.issueDate)}</qdt:DateTimeString></ram:FormattedIssueDateTime>`,
    '</ram:InvoiceReferencedDocument>',
  ].join('');
}

/** The XRechnung XML; throws when `missingForXRechnung` is not empty. */
export function writeXRechnung(input: XRechnungInput): string {
  const missing = missingForXRechnung(input);
  if (missing.length > 0) {
    throw new Error(`XRechnung is missing: ${missing.join(', ')}`);
  }
  const { seller, buyer } = input;
  const breakdown = vatBreakdownOf(input.lines);
  const baseCents = breakdown.reduce((sum, group) => sum + group.baseCents, 0);
  const taxCents = breakdown.reduce((sum, group) => sum + group.taxCents, 0);
  const totalCents = baseCents + taxCents;
  const currency = input.currency.toUpperCase();

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rsm:CrossIndustryInvoice',
    ' xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"',
    ' xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"',
    ' xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"',
    ' xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">',
    '<rsm:ExchangedDocumentContext>',
    `<ram:BusinessProcessSpecifiedDocumentContextParameter><ram:ID>${PEPPOL_BILLING}</ram:ID></ram:BusinessProcessSpecifiedDocumentContextParameter>`,
    `<ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>${XRECHNUNG_SPECIFICATION}</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter>`,
    '</rsm:ExchangedDocumentContext>',
    '<rsm:ExchangedDocument>',
    element('ram:ID', input.number),
    `<ram:TypeCode>${input.typeCode ?? '380'}</ram:TypeCode>`,
    dateTime('ram:IssueDateTime', input.issueDate),
    input.note ? `<ram:IncludedNote>${element('ram:Content', input.note)}</ram:IncludedNote>` : '',
    '</rsm:ExchangedDocument>',
    '<rsm:SupplyChainTradeTransaction>',
    ...input.lines.map(lineItem),
    '<ram:ApplicableHeaderTradeAgreement>',
    element('ram:BuyerReference', input.buyerReference),
    '<ram:SellerTradeParty>',
    element('ram:Name', seller.name),
    seller.registrationId
      ? `<ram:SpecifiedLegalOrganization>${element('ram:ID', seller.registrationId)}</ram:SpecifiedLegalOrganization>`
      : '',
    '<ram:DefinedTradeContact>',
    element('ram:PersonName', seller.contactName || seller.name),
    `<ram:TelephoneUniversalCommunication>${element('ram:CompleteNumber', seller.phone)}</ram:TelephoneUniversalCommunication>`,
    `<ram:EmailURIUniversalCommunication>${element('ram:URIID', seller.email)}</ram:EmailURIUniversalCommunication>`,
    '</ram:DefinedTradeContact>',
    address(seller),
    electronicAddress(seller),
    taxRegistrations(seller.vatId, seller.taxNumber),
    '</ram:SellerTradeParty>',
    '<ram:BuyerTradeParty>',
    element('ram:Name', buyer.name),
    address(buyer),
    electronicAddress(buyer),
    taxRegistrations(buyer.vatId, null),
    '</ram:BuyerTradeParty>',
    '</ram:ApplicableHeaderTradeAgreement>',
    delivery(input, breakdown),
    '<ram:ApplicableHeaderTradeSettlement>',
    `<ram:InvoiceCurrencyCode>${escapeXml(currency)}</ram:InvoiceCurrencyCode>`,
    '<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>58</ram:TypeCode>',
    `<ram:PayeePartyCreditorFinancialAccount>${element('ram:IBANID', seller.iban?.replace(/\s+/g, ''))}</ram:PayeePartyCreditorFinancialAccount>`,
    seller.bic
      ? `<ram:PayeeSpecifiedCreditorFinancialInstitution>${element('ram:BICID', seller.bic)}</ram:PayeeSpecifiedCreditorFinancialInstitution>`
      : '',
    '</ram:SpecifiedTradeSettlementPaymentMeans>',
    ...breakdown.map(tradeTax),
    '<ram:SpecifiedTradePaymentTerms>',
    element('ram:Description', paymentTermsText(input)),
    input.dueDate ? dateTime('ram:DueDateDateTime', input.dueDate) : '',
    '</ram:SpecifiedTradePaymentTerms>',
    '<ram:SpecifiedTradeSettlementHeaderMonetarySummation>',
    `<ram:LineTotalAmount>${money(baseCents)}</ram:LineTotalAmount>`,
    `<ram:TaxBasisTotalAmount>${money(baseCents)}</ram:TaxBasisTotalAmount>`,
    `<ram:TaxTotalAmount currencyID="${escapeXml(currency)}">${money(taxCents)}</ram:TaxTotalAmount>`,
    `<ram:GrandTotalAmount>${money(totalCents)}</ram:GrandTotalAmount>`,
    `<ram:DuePayableAmount>${money(totalCents)}</ram:DuePayableAmount>`,
    '</ram:SpecifiedTradeSettlementHeaderMonetarySummation>',
    precedingInvoice(input),
    '</ram:ApplicableHeaderTradeSettlement>',
    '</rsm:SupplyChainTradeTransaction>',
    '</rsm:CrossIndustryInvoice>',
    '',
  ].join('\n');
}
