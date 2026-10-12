type PdfParse = typeof import('pdf-parse');

/**
 * pdf-parse on bytes its bundled pdf.js (1.10) reads correctly. On Node 24
 * that pdf.js mishandles a Node Buffer: depending on where the Buffer sits in
 * memory, a valid PDF fails with "bad XRef entry" (1 in 6 generated invoices
 * in a loop; never on Node 20). A plain Uint8Array copy of the same bytes is
 * read correctly every time.
 */
export async function parsePdf(data: Uint8Array): ReturnType<PdfParse> {
  const pdfParseModule = await import('pdf-parse');
  // pdf-parse is CommonJS: with esModuleInterop the function is `default`;
  // the fallback covers a loader that hands back the export itself.
  const pdfParse = (pdfParseModule.default ?? pdfParseModule) as PdfParse;
  return pdfParse(new Uint8Array(data));
}
