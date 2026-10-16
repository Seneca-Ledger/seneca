/**
 * Writes an invoice or credit note as Peppol BIS Billing 3.0 — UBL 2.1, the
 * format every Peppol receiver outside Germany expects (Belgium's B2B mandate
 * from 2026 among them). Same input as the XRechnung writer, so both formats
 * carry the same figures; the VAT breakdown is the same EN 16931 one.
 *
 * Peppol addresses parties by their participant id (BT-34/BT-49, rules
 * PEPPOL-EN16931-R020/R010) and needs a buyer reference or an order reference
 * (R003). The XRechnung-only rules (seller contact, phone, IBAN) do not apply:
 * without an IBAN the invoice simply names no payment means.
 */

import { parsePeppolId } from './peppol-id';
import {
  type Breakdown,
  blank,
  cents,
  decimal,
  EXEMPTION_CODES,
  escapeXml,
  money,
  PEPPOL_BILLING,
  paymentTermsText,
  percent,
  vatBreakdownOf,
  type XRechnungInput,
  type XRechnungParty,
} from './xrechnung-writer';

export const PEPPOL_BIS_CUSTOMIZATION =
  'urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0';

/** Peppol document type ids (code list "Document types" v9.7). */
export const PEPPOL_DOCTYPES = {
  bisInvoice: `urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##${PEPPOL_BIS_CUSTOMIZATION}::2.1`,
  bisCreditNote: `urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2::CreditNote##${PEPPOL_BIS_CUSTOMIZATION}::2.1`,
  xrechnungCii:
    'urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100::CrossIndustryInvoice##urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0::D16B',
} as const;

export type PeppolMissing =
  | 'number'
  | 'buyer_reference'
  | 'seller_name'
  | 'seller_country'
  | 'seller_vat_or_tax_number'
  | 'seller_vat_id'
  | 'seller_peppol_id'
  | 'buyer_name'
  | 'buyer_country'
  | 'buyer_vat_id'
  | 'buyer_peppol_id'
  | 'delivery_date'
  | 'lines';

/** What the document still needs before it can go over Peppol; empty when nothing. */
export function missingForPeppol(input: XRechnungInput): PeppolMissing[] {
  const { seller, buyer } = input;
  const categories = new Set(input.lines.map(line => line.category));
  const checks: Array<[PeppolMissing, boolean]> = [
    ['number', blank(input.number)],
    // PEPPOL-EN16931-R003: a buyer reference or an order reference.
    ['buyer_reference', blank(input.buyerReference)],
    ['seller_name', blank(seller.name)],
    ['seller_country', blank(seller.countryCode)],
    ['seller_vat_or_tax_number', blank(seller.vatId) && blank(seller.taxNumber)],
    ['seller_vat_id', (categories.has('AE') || categories.has('K')) && blank(seller.vatId)],
    ['seller_peppol_id', !parsePeppolId(seller.peppolId)],
    ['buyer_name', blank(buyer.name)],
    ['buyer_country', blank(buyer.countryCode)],
    ['buyer_vat_id', (categories.has('AE') || categories.has('K')) && blank(buyer.vatId)],
    ['buyer_peppol_id', !parsePeppolId(buyer.peppolId)],
    ['delivery_date', categories.has('K') && blank(input.deliveryDate)],
    ['lines', input.lines.length === 0],
  ];
  return checks.filter(([, missing]) => missing).map(([field]) => field);
}

function el(name: string, value: string | null | undefined, attributes = ''): string {
  return value === null || value === undefined || value.trim() === ''
    ? ''
    : `<${name}${attributes}>${escapeXml(value.trim())}</${name}>`;
}

function amount(name: string, centsValue: number, currency: string): string {
  return `<${name} currencyID="${escapeXml(currency)}">${money(centsValue)}</${name}>`;
}

function postalAddress(party: XRechnungParty, tag = 'cac:PostalAddress'): string {
  return [
    `<${tag}>`,
    el('cbc:StreetName', party.street),
    el('cbc:CityName', party.city),
    el('cbc:PostalZone', party.postalCode),
    `<cac:Country>${el('cbc:IdentificationCode', party.countryCode?.toUpperCase())}</cac:Country>`,
    `</${tag}>`,
  ].join('');
}

function endpoint(party: XRechnungParty): string {
  const id = parsePeppolId(party.peppolId);
  return id ? el('cbc:EndpointID', id.value, ` schemeID="${id.scheme}"`) : '';
}

function taxScheme(companyId: string | null, scheme: 'VAT' | 'FC'): string {
  return companyId
    ? `<cac:PartyTaxScheme>${el('cbc:CompanyID', scheme === 'VAT' ? companyId.replace(/\s+/g, '') : companyId)}<cac:TaxScheme><cbc:ID>${scheme}</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>`
    : '';
}

function supplier(seller: XRechnungInput['seller']): string {
  const hasContact = !(blank(seller.contactName) && blank(seller.phone) && blank(seller.email));
  return [
    '<cac:AccountingSupplierParty><cac:Party>',
    endpoint(seller),
    postalAddress(seller),
    taxScheme(seller.vatId, 'VAT'),
    taxScheme(seller.taxNumber, 'FC'),
    '<cac:PartyLegalEntity>',
    el('cbc:RegistrationName', seller.name),
    el('cbc:CompanyID', seller.registrationId),
    '</cac:PartyLegalEntity>',
    hasContact
      ? `<cac:Contact>${el('cbc:Name', seller.contactName)}${el('cbc:Telephone', seller.phone)}${el('cbc:ElectronicMail', seller.email)}</cac:Contact>`
      : '',
    '</cac:Party></cac:AccountingSupplierParty>',
  ].join('');
}

function customer(buyer: XRechnungParty): string {
  return [
    '<cac:AccountingCustomerParty><cac:Party>',
    endpoint(buyer),
    postalAddress(buyer),
    taxScheme(buyer.vatId, 'VAT'),
    `<cac:PartyLegalEntity>${el('cbc:RegistrationName', buyer.name)}</cac:PartyLegalEntity>`,
    buyer.email ? `<cac:Contact>${el('cbc:ElectronicMail', buyer.email)}</cac:Contact>` : '',
    '</cac:Party></cac:AccountingCustomerParty>',
  ].join('');
}

/** BG-13: the delivery date, and for an intra-Community supply the country delivered to (BR-IC-12). */
function delivery(input: XRechnungInput, breakdown: Breakdown[]): string {
  const toEu = breakdown.some(group => group.category === 'K');
  if (!(input.deliveryDate || toEu)) {
    return '';
  }
  return [
    '<cac:Delivery>',
    el('cbc:ActualDeliveryDate', input.deliveryDate?.slice(0, 10)),
    toEu
      ? `<cac:DeliveryLocation>${postalAddress(input.buyer, 'cac:Address')}</cac:DeliveryLocation>`
      : '',
    '</cac:Delivery>',
  ].join('');
}

function paymentMeans(input: XRechnungInput): string {
  const iban = input.seller.iban?.replace(/\s+/g, '');
  if (!iban) {
    return '';
  }
  return [
    '<cac:PaymentMeans><cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>',
    el('cbc:PaymentID', input.number),
    '<cac:PayeeFinancialAccount>',
    el('cbc:ID', iban),
    input.seller.bic
      ? `<cac:FinancialInstitutionBranch>${el('cbc:ID', input.seller.bic)}</cac:FinancialInstitutionBranch>`
      : '',
    '</cac:PayeeFinancialAccount></cac:PaymentMeans>',
  ].join('');
}

function classifiedTaxCategory(category: string, rate: number): string {
  return `<cac:ClassifiedTaxCategory><cbc:ID>${category}</cbc:ID><cbc:Percent>${percent(rate)}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory>`;
}

function taxSubtotal(group: Breakdown, currency: string): string {
  const reason =
    group.category === 'S'
      ? ''
      : `${el('cbc:TaxExemptionReasonCode', EXEMPTION_CODES[group.category])}${el('cbc:TaxExemptionReason', group.exemptionReason)}`;
  return [
    '<cac:TaxSubtotal>',
    amount('cbc:TaxableAmount', group.baseCents, currency),
    amount('cbc:TaxAmount', group.taxCents, currency),
    `<cac:TaxCategory><cbc:ID>${group.category}</cbc:ID><cbc:Percent>${percent(group.rate)}</cbc:Percent>${reason}<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory>`,
    '</cac:TaxSubtotal>',
  ].join('');
}

function line(
  item: XRechnungInput['lines'][number],
  index: number,
  currency: string,
  creditNote: boolean,
): string {
  const netCents = cents(item.net);
  const adjustmentCents = item.adjustment ? cents(item.adjustment.amount) : 0;
  // As in the CII writer: the price is before the line's allowance or charge.
  const baseCents = netCents - adjustmentCents;
  const unitPrice = item.quantity === 0 ? 0 : baseCents / 100 / item.quantity;
  const tag = creditNote ? 'CreditNoteLine' : 'InvoiceLine';
  const quantityTag = creditNote ? 'CreditedQuantity' : 'InvoicedQuantity';
  const charge = adjustmentCents > 0;
  return [
    `<cac:${tag}>`,
    `<cbc:ID>${index + 1}</cbc:ID>`,
    `<cbc:${quantityTag} unitCode="${escapeXml(item.unitCode)}">${decimal(item.quantity)}</cbc:${quantityTag}>`,
    amount('cbc:LineExtensionAmount', netCents, currency),
    item.adjustment && adjustmentCents !== 0
      ? [
          '<cac:AllowanceCharge>',
          `<cbc:ChargeIndicator>${charge}</cbc:ChargeIndicator>`,
          charge ? '' : '<cbc:AllowanceChargeReasonCode>95</cbc:AllowanceChargeReasonCode>',
          `<cbc:AllowanceChargeReason>${charge ? 'Surcharge' : 'Discount'}</cbc:AllowanceChargeReason>`,
          `<cbc:MultiplierFactorNumeric>${percent(Math.abs(item.adjustment.percent))}</cbc:MultiplierFactorNumeric>`,
          amount('cbc:Amount', Math.abs(adjustmentCents), currency),
          amount('cbc:BaseAmount', baseCents, currency),
          '</cac:AllowanceCharge>',
        ].join('')
      : '',
    `<cac:Item>${el('cbc:Name', item.name)}${classifiedTaxCategory(item.category, item.rate)}</cac:Item>`,
    `<cac:Price><cbc:PriceAmount currencyID="${escapeXml(currency)}">${decimal(unitPrice)}</cbc:PriceAmount></cac:Price>`,
    `</cac:${tag}>`,
  ].join('');
}

/** The Peppol BIS 3.0 UBL; throws when `missingForPeppol` is not empty. */
export function writePeppolUbl(input: XRechnungInput): string {
  const missing = missingForPeppol(input);
  if (missing.length > 0) {
    throw new Error(`Peppol document is missing: ${missing.join(', ')}`);
  }
  const creditNote = input.typeCode === '381';
  const root = creditNote ? 'CreditNote' : 'Invoice';
  const currency = input.currency.toUpperCase();
  const breakdown = vatBreakdownOf(input.lines);
  const baseCents = breakdown.reduce((sum, group) => sum + group.baseCents, 0);
  const taxCents = breakdown.reduce((sum, group) => sum + group.taxCents, 0);
  const totalCents = baseCents + taxCents;
  const preceding = input.precedingInvoice;

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<${root} xmlns="urn:oasis:names:specification:ubl:schema:xsd:${root}-2"`,
    ' xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"',
    ' xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">',
    `<cbc:CustomizationID>${PEPPOL_BIS_CUSTOMIZATION}</cbc:CustomizationID>`,
    `<cbc:ProfileID>${PEPPOL_BILLING}</cbc:ProfileID>`,
    el('cbc:ID', input.number),
    `<cbc:IssueDate>${input.issueDate.slice(0, 10)}</cbc:IssueDate>`,
    // A credit note has no due date of its own in UBL (BT-9 sits in the payment means).
    !creditNote && input.dueDate ? `<cbc:DueDate>${input.dueDate.slice(0, 10)}</cbc:DueDate>` : '',
    creditNote
      ? '<cbc:CreditNoteTypeCode>381</cbc:CreditNoteTypeCode>'
      : '<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>',
    el('cbc:Note', input.note),
    `<cbc:DocumentCurrencyCode>${escapeXml(currency)}</cbc:DocumentCurrencyCode>`,
    el('cbc:BuyerReference', input.buyerReference),
    preceding
      ? `<cac:BillingReference><cac:InvoiceDocumentReference>${el('cbc:ID', preceding.number)}${el('cbc:IssueDate', preceding.issueDate.slice(0, 10))}</cac:InvoiceDocumentReference></cac:BillingReference>`
      : '',
    supplier(input.seller),
    customer(input.buyer),
    delivery(input, breakdown),
    paymentMeans(input),
    `<cac:PaymentTerms>${el('cbc:Note', paymentTermsText(input))}</cac:PaymentTerms>`,
    '<cac:TaxTotal>',
    amount('cbc:TaxAmount', taxCents, currency),
    ...breakdown.map(group => taxSubtotal(group, currency)),
    '</cac:TaxTotal>',
    '<cac:LegalMonetaryTotal>',
    amount('cbc:LineExtensionAmount', baseCents, currency),
    amount('cbc:TaxExclusiveAmount', baseCents, currency),
    amount('cbc:TaxInclusiveAmount', totalCents, currency),
    amount('cbc:PayableAmount', totalCents, currency),
    '</cac:LegalMonetaryTotal>',
    ...input.lines.map((item, index) => line(item, index, currency, creditNote)),
    `</${root}>`,
    '',
  ].join('\n');
}
