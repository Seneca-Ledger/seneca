import { XMLParser } from 'fast-xml-parser';
import { decodePDFRawStream, PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';

/**
 * Reads a structured e-invoice: an EN 16931 invoice in either syntax the
 * standard allows — UBL 2.1 (Invoice / CreditNote) or UN/CEFACT CII
 * (CrossIndustryInvoice) — given as the XML itself or embedded in a hybrid
 * PDF (ZUGFeRD / Factur-X: factur-x.xml, zugferd-invoice.xml, xrechnung.xml).
 *
 * Under § 14 UStG the structured part is the invoice: a hybrid PDF's picture
 * is a copy, and input tax may only be taken from the XML (BMF 15.10.2025,
 * UStAE 15.2a). So when a file carries the XML, its figures are used as they
 * are, with no OCR. ZUGFeRD's MINIMUM and BASIC-WL profiles do not meet
 * EN 16931 and are not e-invoices (UStAE 14.4 as amended); their figures are
 * still read, marked as such.
 */

export type EInvoiceSyntax = 'ubl' | 'cii';

export interface EInvoiceParty {
  name: string | null;
  vatId: string | null;
  /** Steuernummer and the like (CII scheme FC). */
  taxNumber: string | null;
  countryCode: string | null;
  address: string | null;
}

export interface EInvoiceVatBreakdown {
  /** UNCL 5305: S standard, Z zero, E exempt, AE reverse charge, K intra-EU, G export, O outside scope, L/M Canary/Ceuta. */
  category: string;
  rate: number | null;
  base: number;
  tax: number;
  exemptionReason: string | null;
}

export interface EInvoiceLine {
  name: string;
  quantity: number | null;
  unitCode: string | null;
  net: number;
  vatCategory: string | null;
  vatRate: number | null;
}

export interface EInvoice {
  syntax: EInvoiceSyntax;
  /** BT-24, the specification the invoice claims (e.g. XRechnung 3.0, Factur-X EN 16931). */
  profile: string | null;
  /** False for ZUGFeRD MINIMUM and BASIC-WL: not an e-invoice under § 14 UStG. */
  meetsEn16931: boolean;
  /** UNCL 1001: 380 invoice, 381 credit note, 384 corrected invoice, 389 self-billed… */
  typeCode: string | null;
  isCreditNote: boolean;
  number: string | null;
  issueDate: string | null;
  dueDate: string | null;
  deliveryDate: string | null;
  currency: string | null;
  buyerReference: string | null;
  seller: EInvoiceParty;
  buyer: EInvoiceParty;
  iban: string | null;
  /** BT-109, BT-110, BT-112, BT-115. */
  netTotal: number | null;
  taxTotal: number | null;
  grossTotal: number | null;
  payable: number | null;
  vat: EInvoiceVatBreakdown[];
  lines: EInvoiceLine[];
}

const EMBEDDED_NAMES = /^(factur-x|zugferd-invoice|zugferd|xrechnung|order-x)\.xml$/i;

type Node = Record<string, unknown>;

const parser = new XMLParser({
  removeNSPrefix: true,
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  // Never expand entities: an invoice from outside must not pull anything in.
  processEntities: false,
});

const asArray = <T>(value: T | T[] | undefined | null): T[] =>
  value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];

/** Follows a path of element names, taking the first match at every step. */
function at(node: unknown, ...path: string[]): unknown {
  let current: unknown = node;
  for (const key of path) {
    if (current === undefined || current === null) {
      return undefined;
    }
    const value = (Array.isArray(current) ? current[0] : current) as Node;
    current = typeof value === 'object' ? value[key] : undefined;
  }
  return Array.isArray(current) ? current[0] : current;
}

/** An element's text, whether it has attributes or not. */
function text(node: unknown, ...path: string[]): string | null {
  const value = at(node, ...path);
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'object') {
    const inner = (value as Node)['#text'];
    return inner === undefined ? null : String(inner).trim() || null;
  }
  return String(value).trim() || null;
}

function amount(node: unknown, ...path: string[]): number | null {
  const raw = text(node, ...path);
  if (raw === null) {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** Every child element of that name, not only the first. */
function children(node: unknown, key: string): Node[] {
  const value = (Array.isArray(node) ? node[0] : node) as Node | undefined;
  return value && typeof value === 'object' ? asArray(value[key] as Node | Node[]) : [];
}

function attr(node: unknown, name: string, ...path: string[]): string | null {
  const value = at(node, ...path);
  return value && typeof value === 'object'
    ? (((value as Node)[`@${name}`] as string) ?? null)
    : null;
}

/** CII dates come as format 102, YYYYMMDD. */
function ciiDate(node: unknown, ...path: string[]): string | null {
  const raw = text(node, ...path);
  const match = raw?.match(/^(\d{4})(\d{2})(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : (raw?.slice(0, 10) ?? null);
}

function joinAddress(parts: Array<string | null>): string | null {
  const joined = parts.filter(Boolean).join(', ');
  return joined || null;
}

function meetsEn16931(profile: string | null): boolean {
  return !(profile && /(minimum|basicwl|basic-wl)/i.test(profile));
}

function ublParty(party: unknown): EInvoiceParty {
  const schemes = children(party, 'PartyTaxScheme');
  const vatScheme = schemes.find(scheme => text(scheme, 'TaxScheme', 'ID') === 'VAT');
  const otherScheme = schemes.find(scheme => text(scheme, 'TaxScheme', 'ID') !== 'VAT');
  return {
    name: text(party, 'PartyLegalEntity', 'RegistrationName') ?? text(party, 'PartyName', 'Name'),
    vatId: vatScheme ? text(vatScheme, 'CompanyID') : null,
    taxNumber: otherScheme ? text(otherScheme, 'CompanyID') : null,
    countryCode: text(party, 'PostalAddress', 'Country', 'IdentificationCode'),
    address: joinAddress([
      text(party, 'PostalAddress', 'StreetName'),
      joinAddress([
        text(party, 'PostalAddress', 'PostalZone'),
        text(party, 'PostalAddress', 'CityName'),
      ])?.replace(', ', ' ') ?? null,
    ]),
  };
}

function parseUbl(root: Node, isCreditNote: boolean): EInvoice {
  const lineKey = isCreditNote ? 'CreditNoteLine' : 'InvoiceLine';
  const quantityKey = isCreditNote ? 'CreditedQuantity' : 'InvoicedQuantity';
  const profile = text(root, 'CustomizationID');
  // A credit note may repeat TaxTotal per currency; the one with subtotals is in the document currency.
  const taxTotals = asArray(root.TaxTotal as Node | Node[] | undefined);
  const mainTaxTotal = taxTotals.find(total => total.TaxSubtotal) ?? taxTotals[0];
  return {
    syntax: 'ubl',
    profile,
    meetsEn16931: meetsEn16931(profile),
    typeCode: text(root, isCreditNote ? 'CreditNoteTypeCode' : 'InvoiceTypeCode'),
    isCreditNote,
    number: text(root, 'ID'),
    issueDate: text(root, 'IssueDate'),
    dueDate: text(root, 'DueDate') ?? text(root, 'PaymentMeans', 'PaymentDueDate'),
    deliveryDate: text(root, 'Delivery', 'ActualDeliveryDate'),
    currency: text(root, 'DocumentCurrencyCode'),
    buyerReference: text(root, 'BuyerReference'),
    seller: ublParty(at(root, 'AccountingSupplierParty', 'Party')),
    buyer: ublParty(at(root, 'AccountingCustomerParty', 'Party')),
    iban: text(root, 'PaymentMeans', 'PayeeFinancialAccount', 'ID'),
    netTotal: amount(root, 'LegalMonetaryTotal', 'TaxExclusiveAmount'),
    taxTotal: mainTaxTotal ? amount(mainTaxTotal, 'TaxAmount') : null,
    grossTotal: amount(root, 'LegalMonetaryTotal', 'TaxInclusiveAmount'),
    payable: amount(root, 'LegalMonetaryTotal', 'PayableAmount'),
    vat: asArray(mainTaxTotal?.TaxSubtotal as Node | Node[] | undefined).map(subtotal => ({
      category: text(subtotal, 'TaxCategory', 'ID') ?? '',
      rate: amount(subtotal, 'TaxCategory', 'Percent'),
      base: amount(subtotal, 'TaxableAmount') ?? 0,
      tax: amount(subtotal, 'TaxAmount') ?? 0,
      exemptionReason: text(subtotal, 'TaxCategory', 'TaxExemptionReason'),
    })),
    lines: asArray(root[lineKey] as Node | Node[] | undefined).map(line => ({
      name: text(line, 'Item', 'Name') ?? '',
      quantity: amount(line, quantityKey),
      unitCode: attr(line, 'unitCode', quantityKey),
      net: amount(line, 'LineExtensionAmount') ?? 0,
      vatCategory: text(line, 'Item', 'ClassifiedTaxCategory', 'ID'),
      vatRate: amount(line, 'Item', 'ClassifiedTaxCategory', 'Percent'),
    })),
  };
}

function ciiParty(party: unknown): EInvoiceParty {
  const registrations = children(party, 'SpecifiedTaxRegistration');
  const byScheme = (scheme: string) => {
    const found = registrations.find(item => attr(item, 'schemeID', 'ID') === scheme);
    return found ? text(found, 'ID') : null;
  };
  return {
    name: text(party, 'Name'),
    vatId: byScheme('VA'),
    taxNumber: byScheme('FC'),
    countryCode: text(party, 'PostalTradeAddress', 'CountryID'),
    address: joinAddress([
      text(party, 'PostalTradeAddress', 'LineOne'),
      joinAddress([
        text(party, 'PostalTradeAddress', 'PostcodeCode'),
        text(party, 'PostalTradeAddress', 'CityName'),
      ])?.replace(', ', ' ') ?? null,
    ]),
  };
}

function parseCii(root: Node): EInvoice {
  const transaction = at(root, 'SupplyChainTradeTransaction') as Node | undefined;
  const agreement = at(transaction, 'ApplicableHeaderTradeAgreement');
  const settlement = at(transaction, 'ApplicableHeaderTradeSettlement') as Node | undefined;
  const summation = at(settlement, 'SpecifiedTradeSettlementHeaderMonetarySummation') as
    | Node
    | undefined;
  const currency = text(settlement, 'InvoiceCurrencyCode');
  // TaxTotalAmount may be given twice, in the invoice and in the tax currency.
  const taxTotals = asArray(summation?.TaxTotalAmount as unknown[] | unknown | undefined);
  const taxTotal =
    taxTotals.find(
      item => typeof item === 'object' && (item as Node)['@currencyID'] === currency,
    ) ?? taxTotals[0];
  const typeCode = text(root, 'ExchangedDocument', 'TypeCode');
  const profile = text(
    root,
    'ExchangedDocumentContext',
    'GuidelineSpecifiedDocumentContextParameter',
    'ID',
  );
  return {
    syntax: 'cii',
    profile,
    meetsEn16931: meetsEn16931(profile),
    typeCode,
    isCreditNote: typeCode === '381',
    number: text(root, 'ExchangedDocument', 'ID'),
    issueDate: ciiDate(root, 'ExchangedDocument', 'IssueDateTime', 'DateTimeString'),
    dueDate: ciiDate(settlement, 'SpecifiedTradePaymentTerms', 'DueDateDateTime', 'DateTimeString'),
    deliveryDate: ciiDate(
      transaction,
      'ApplicableHeaderTradeDelivery',
      'ActualDeliverySupplyChainEvent',
      'OccurrenceDateTime',
      'DateTimeString',
    ),
    currency,
    buyerReference: text(agreement, 'BuyerReference'),
    seller: ciiParty(at(agreement, 'SellerTradeParty')),
    buyer: ciiParty(at(agreement, 'BuyerTradeParty')),
    iban: text(
      settlement,
      'SpecifiedTradeSettlementPaymentMeans',
      'PayeePartyCreditorFinancialAccount',
      'IBANID',
    ),
    netTotal: amount(summation, 'TaxBasisTotalAmount'),
    taxTotal: taxTotal === undefined ? null : amount({ value: taxTotal }, 'value'),
    grossTotal: amount(summation, 'GrandTotalAmount'),
    payable: amount(summation, 'DuePayableAmount'),
    vat: asArray(settlement?.ApplicableTradeTax as Node | Node[] | undefined).map(tax => ({
      category: text(tax, 'CategoryCode') ?? '',
      rate: amount(tax, 'RateApplicablePercent'),
      base: amount(tax, 'BasisAmount') ?? 0,
      tax: amount(tax, 'CalculatedAmount') ?? 0,
      exemptionReason: text(tax, 'ExemptionReason'),
    })),
    lines: asArray(transaction?.IncludedSupplyChainTradeLineItem as Node | Node[] | undefined).map(
      line => ({
        name: text(line, 'SpecifiedTradeProduct', 'Name') ?? '',
        quantity: amount(line, 'SpecifiedLineTradeDelivery', 'BilledQuantity'),
        unitCode: attr(line, 'unitCode', 'SpecifiedLineTradeDelivery', 'BilledQuantity'),
        net:
          amount(
            line,
            'SpecifiedLineTradeSettlement',
            'SpecifiedTradeSettlementLineMonetarySummation',
            'LineTotalAmount',
          ) ?? 0,
        vatCategory: text(
          line,
          'SpecifiedLineTradeSettlement',
          'ApplicableTradeTax',
          'CategoryCode',
        ),
        vatRate: amount(
          line,
          'SpecifiedLineTradeSettlement',
          'ApplicableTradeTax',
          'RateApplicablePercent',
        ),
      }),
    ),
  };
}

/** The invoice in an XML document; NULL when it is not a UBL or CII invoice. */
export function parseEInvoiceXml(xml: string): EInvoice | null {
  let document: Node;
  try {
    document = parser.parse(xml) as Node;
  } catch {
    return null;
  }
  if (document.Invoice && typeof document.Invoice === 'object') {
    return parseUbl(document.Invoice as Node, false);
  }
  if (document.CreditNote && typeof document.CreditNote === 'object') {
    return parseUbl(document.CreditNote as Node, true);
  }
  if (document.CrossIndustryInvoice && typeof document.CrossIndustryInvoice === 'object') {
    return parseCii(document.CrossIndustryInvoice as Node);
  }
  return null;
}

/** The invoice XML a hybrid PDF carries as an attachment; NULL when it carries none. */
export async function embeddedInvoiceXml(pdf: Buffer): Promise<string | null> {
  try {
    return await findInvoiceAttachment(pdf);
  } catch {
    // A damaged or odd PDF is simply not an e-invoice; it goes to OCR.
    return null;
  }
}

async function findInvoiceAttachment(pdf: Buffer): Promise<string | null> {
  const document = await PDFDocument.load(pdf, {
    ignoreEncryption: true,
    updateMetadata: false,
  });
  const names = document.catalog.lookupMaybe(PDFName.of('Names'), PDFDict);
  const embedded = names?.lookupMaybe(PDFName.of('EmbeddedFiles'), PDFDict);
  if (!embedded) {
    return null;
  }
  for (const [fileName, spec] of embeddedFileSpecs(embedded)) {
    if (!EMBEDDED_NAMES.test(fileName)) {
      continue;
    }
    const files = spec.lookupMaybe(PDFName.of('EF'), PDFDict);
    const stream = files?.lookup(PDFName.of('F'));
    if (stream instanceof PDFRawStream) {
      return Buffer.from(decodePDFRawStream(stream).decode()).toString('utf8');
    }
  }
  return null;
}

type Decodable = { decodeText?: () => string } | undefined;

/** The attachment's own file name (/UF), else the key it is filed under in the name tree. */
function fileNameOf(key: unknown, spec: PDFDict): string {
  return (
    (spec.lookup(PDFName.of('UF')) as Decodable)?.decodeText?.() ||
    (key as Decodable)?.decodeText?.() ||
    ''
  );
}

/** The (name, file spec) pairs of an EmbeddedFiles name tree, nested Kids included. */
function embeddedFileSpecs(tree: PDFDict, depth = 0): Array<[string, PDFDict]> {
  if (depth > 8) {
    return [];
  }
  const pairs: Array<[string, PDFDict]> = [];
  const names = tree.lookupMaybe(PDFName.of('Names'), PDFArray);
  for (let index = 0; names && index + 1 < names.size(); index += 2) {
    const spec = names.lookupMaybe(index + 1, PDFDict);
    if (spec) {
      pairs.push([fileNameOf(names.lookup(index), spec), spec]);
    }
  }
  const kids = tree.lookupMaybe(PDFName.of('Kids'), PDFArray);
  for (let index = 0; kids && index < kids.size(); index++) {
    const kid = kids.lookupMaybe(index, PDFDict);
    if (kid) {
      pairs.push(...embeddedFileSpecs(kid, depth + 1));
    }
  }
  return pairs;
}

const looksLikeXml = (buffer: Buffer) =>
  /^\s*(<\?xml|<)/.test(
    buffer
      .subarray(0, 64)
      .toString('utf8')
      .replace(/^\uFEFF/, ''),
  );

/**
 * The e-invoice in an uploaded file: the XML itself, or the XML inside a
 * hybrid PDF. NULL for anything else, which then goes to OCR as before.
 */
export async function readEInvoice(
  file: Buffer,
  mimeType: string,
  fileName = '',
): Promise<{ invoice: EInvoice; xml: string } | null> {
  const isPdf = mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
  const xml = isPdf
    ? await embeddedInvoiceXml(file)
    : looksLikeXml(file)
      ? file.toString('utf8').replace(/^\uFEFF/, '')
      : null;
  if (!xml) {
    return null;
  }
  const invoice = parseEInvoiceXml(xml);
  return invoice ? { invoice, xml } : null;
}
