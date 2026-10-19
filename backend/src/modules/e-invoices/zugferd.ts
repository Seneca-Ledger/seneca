import { createHash } from 'node:crypto';
import { AFRelationship, PDFDocument, PDFHexString, PDFName } from 'pdf-lib';
import { APP_NAME } from '../../common/brand';

/**
 * Turns an invoice PDF into a ZUGFeRD / Factur-X hybrid: a PDF/A-3b whose
 * embedded XRechnung (CII) is the invoice — what the recipient's software
 * reads and what counts for VAT — while the pages stay its human-readable view
 * (BMF letter of 15 October 2025: in a hybrid the XML is binding).
 *
 * The profile is XRECHNUNG, so the attachment is named xrechnung.xml, as
 * ZUGFeRD names it for that profile, declared as the document's Alternative representation
 * and described in the XMP metadata, where PDF/A-3 needs the fx: schema
 * explained in its own extension block.
 */

/**
 * sRGB IEC 61966-2.1, compact v2 profile by Clinton Ingram (CC0,
 * github.com/saucecontrol/Compact-ICC-Profiles) — the output intent PDF/A asks
 * for, since the pages use DeviceRGB.
 */
const SRGB_ICC = Buffer.from(
  'AAAByGxjbXMCEAAAbW50clJHQiBYWVogB+IAAwAUAAkADgAdYWNzcE1TRlQAAAAAc2F3c2N0cmwAAAAAAAAAAAAAAAAAAPbWAAEAAAAA0y1oYW5knZEAPUCAsD1AdCyBnqUijgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJZGVzYwAAAPAAAABfY3BydAAAAQwAAAAMd3RwdAAAARgAAAAUclhZWgAAASwAAAAUZ1hZWgAAAUAAAAAUYlhZWgAAAVQAAAAUclRSQwAAAWgAAABgZ1RSQwAAAWgAAABgYlRSQwAAAWgAAABgZGVzYwAAAAAAAAAFdVJHQgAAAAAAAAAAAAAAAHRleHQAAAAAQ0MwAFhZWiAAAAAAAADzVAABAAAAARbJWFlaIAAAAAAAAG+gAAA48gAAA49YWVogAAAAAAAAYpYAALeJAAAY2lhZWiAAAAAAAAAkoAAAD4UAALbEY3VydgAAAAAAAAAqAAAAfAD4AZwCdQODBMkGTggSChgMYg70Ec8U9hhqHC4gQySsKWoufjPrObM/1kZXTTZUdlwXZB1shnVWfo2ILJI2nKunjLLbvpnKx9dl5Hfx+f//',
  'base64',
);

export const ZUGFERD_FILE_NAME = 'xrechnung.xml';
const FX_NAMESPACE = 'urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#';

export interface ZugferdMeta {
  /** The document title, e.g. "Invoice INV-2026-0001". */
  title: string;
  /** Stamped as creation and modification time, in both the Info dictionary and XMP. */
  date: Date;
  /** 'INVOICE' for an invoice and also for a credit note (Factur-X 1.07, 7.2.2). */
  documentType?: 'INVOICE';
}

/** The PDF with the XML embedded, as PDF/A-3b. */
export async function embedXRechnung(pdf: Buffer, xml: string, meta: ZugferdMeta): Promise<Buffer> {
  const doc = await PDFDocument.load(pdf, { updateMetadata: false });
  const context = doc.context;
  // Whole seconds: the Info dictionary has no fractions, and PDF/A wants it
  // and the XMP to say the same.
  const date = new Date(Math.floor(meta.date.getTime() / 1000) * 1000);
  const producer = APP_NAME;

  await doc.attach(Buffer.from(xml, 'utf8'), ZUGFERD_FILE_NAME, {
    mimeType: 'text/xml',
    description: 'XRechnung (EN 16931, UN/CEFACT CII)',
    creationDate: date,
    modificationDate: date,
    afRelationship: AFRelationship.Alternative,
  });

  doc.setTitle(meta.title, { showInWindowTitleBar: true });
  doc.setProducer(producer);
  doc.setCreator(producer);
  doc.setCreationDate(date);
  doc.setModificationDate(date);
  // pdfmake's own keywords and subject are not repeated in the XMP; dropped.
  const info = context.lookup(context.trailerInfo.Info);
  if (info && 'delete' in info && typeof info.delete === 'function') {
    info.delete(PDFName.of('Keywords'));
    info.delete(PDFName.of('Subject'));
    info.delete(PDFName.of('Author'));
  }

  const metadata = context.stream(xmp(meta.title, producer, date, meta.documentType ?? 'INVOICE'), {
    Type: 'Metadata',
    Subtype: 'XML',
  });
  doc.catalog.set(PDFName.of('Metadata'), context.register(metadata));

  const icc = context.flateStream(SRGB_ICC, { N: 3 });
  doc.catalog.set(
    PDFName.of('OutputIntents'),
    context.obj([
      context.obj({
        Type: 'OutputIntent',
        S: 'GTS_PDFA1',
        OutputConditionIdentifier: PDFHexString.fromText('sRGB IEC61966-2.1'),
        Info: PDFHexString.fromText('sRGB IEC61966-2.1'),
        DestOutputProfile: context.register(icc),
      }),
    ]),
  );

  // PDF/A requires a file identifier in the trailer.
  const id = PDFHexString.of(createHash('md5').update(pdf).update(xml).digest('hex'));
  context.trailerInfo.ID = context.obj([id, id]);

  return Buffer.from(await doc.save({ useObjectStreams: false }));
}

function xmp(title: string, producer: string, date: Date, documentType: string): string {
  const stamp = date.toISOString().replace(/\.\d{3}Z$/, 'Z');
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
<pdfaid:part>3</pdfaid:part>
<pdfaid:conformance>B</pdfaid:conformance>
</rdf:Description>
<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:title><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(title)}</rdf:li></rdf:Alt></dc:title>
</rdf:Description>
<rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
<pdf:Producer>${escapeXml(producer)}</pdf:Producer>
</rdf:Description>
<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
<xmp:CreatorTool>${escapeXml(producer)}</xmp:CreatorTool>
<xmp:CreateDate>${stamp}</xmp:CreateDate>
<xmp:ModifyDate>${stamp}</xmp:ModifyDate>
</rdf:Description>
<rdf:Description rdf:about="" xmlns:fx="${FX_NAMESPACE}">
<fx:DocumentType>${documentType}</fx:DocumentType>
<fx:DocumentFileName>${ZUGFERD_FILE_NAME}</fx:DocumentFileName>
<fx:Version>1.0</fx:Version>
<fx:ConformanceLevel>XRECHNUNG</fx:ConformanceLevel>
</rdf:Description>
<rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
<pdfaExtension:schemas><rdf:Bag><rdf:li rdf:parseType="Resource">
<pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
<pdfaSchema:namespaceURI>${FX_NAMESPACE}</pdfaSchema:namespaceURI>
<pdfaSchema:prefix>fx</pdfaSchema:prefix>
<pdfaSchema:property><rdf:Seq>
${fxProperty('DocumentFileName', 'The name of the embedded XML document')}
${fxProperty('DocumentType', 'The type of the hybrid document in capital letters, e.g. INVOICE or ORDER')}
${fxProperty('Version', 'The actual version of the standard applying to the embedded XML document')}
${fxProperty('ConformanceLevel', 'The conformance level of the embedded XML document')}
</rdf:Seq></pdfaSchema:property>
</rdf:li></rdf:Bag></pdfaExtension:schemas>
</rdf:Description>
</rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

function fxProperty(name: string, description: string): string {
  return `<rdf:li rdf:parseType="Resource"><pdfaProperty:name>${name}</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>${description}</pdfaProperty:description></rdf:li>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
