type PdfParse = typeof import('pdf-parse');

/**
 * pdf-parse on a Buffer it can read. Its bundled pdf.js (1.10) reads the whole
 * ArrayBuffer behind the Buffer and ignores the Buffer's offset. Node 24 hands
 * out small Buffers (under 32 KB) as slices of a shared 64 KB pool, so pdf.js
 * read the pool from its start and failed with "bad XRef entry" whenever the
 * PDF did not happen to sit at offset 0. A copy owns its memory.
 */
export async function parsePdf(data: Buffer): ReturnType<PdfParse> {
  const pdfParseModule = await import('pdf-parse');
  // pdf-parse is CommonJS: with esModuleInterop the function is `default`;
  // the fallback covers a loader that hands back the export itself.
  const pdfParse = (pdfParseModule.default ?? pdfParseModule) as PdfParse;
  return pdfParse(Buffer.from(new Uint8Array(data).buffer));
}
