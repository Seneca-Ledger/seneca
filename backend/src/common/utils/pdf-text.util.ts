type PdfDocument = Awaited<ReturnType<typeof import('unpdf').getDocumentProxy>>;
type PDFPageProxy = Awaited<ReturnType<PdfDocument['getPage']>>;

export interface PdfText {
  text: string;
  numpages: number;
}

/**
 * One page as text: items on the same baseline run together, a new baseline
 * starts a new line. pdf.js reports the spaces between words as items of their
 * own (and marks the end of a run with `hasEOL`); they become one space inside
 * a line and are dropped at its edges, which is how the pdf-parse 1.x output
 * the parsers were written against reads.
 */
async function pageText(page: PDFPageProxy): Promise<string> {
  const content = await page.getTextContent();
  let text = '';
  let lastY: number | undefined;
  let gap = false;
  for (const item of content.items) {
    if (!('str' in item)) {
      continue;
    }
    if (item.str.trim() === '') {
      gap = true;
      continue;
    }
    const y = item.transform[5];
    if (lastY === undefined) {
      text += item.str;
    } else if (y === lastY) {
      text += (gap ? ' ' : '') + item.str;
    } else {
      text += `\n${item.str}`;
    }
    lastY = y;
    gap = Boolean(item.hasEOL);
  }
  return text;
}

/**
 * The text layer of a PDF, page by page (each page after a blank line).
 *
 * pdf.js gets a plain Uint8Array copy, never a Node Buffer: it takes ownership
 * of the bytes it is handed, and a Buffer is a view into Node's shared pool.
 */
export async function parsePdf(data: Uint8Array): Promise<PdfText> {
  const { getDocumentProxy } = await import('unpdf');
  const document = await getDocumentProxy(new Uint8Array(data));
  try {
    let text = '';
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      text = `${text}\n\n${await pageText(page)}`;
    }
    return { text, numpages: document.numPages };
  } finally {
    // Ends the document and its in-process worker; the proxy itself has no destroy().
    await document.loadingTask.destroy();
  }
}
