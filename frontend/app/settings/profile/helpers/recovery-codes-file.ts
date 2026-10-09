'use client';

import { format as formatDate } from 'date-fns';

export type RecoveryCodesFileFormat = 'pdf' | 'docx';

export type RecoveryCodesFileContent = {
  /** UI locale: picks where words may break when a line is drawn by the browser. */
  locale: string;
  title: string;
  /** Short lines under the title, e.g. the account and the generation date. */
  details: string[];
  hint: string;
  codes: string[];
};

function unwrapDefault<T>(module: unknown): T {
  return (
    typeof module === 'object' && module !== null && 'default' in module
      ? (module as { default: unknown }).default
      : module
  ) as T;
}

type PdfMakeLike = {
  createPdf(
    definition: unknown,
    tableLayouts?: unknown,
    fonts?: unknown,
    vfs?: unknown,
  ): { getBlob(callback: (blob: Blob) => void): void };
};

/**
 * What the Roboto bundled with pdfmake 0.2 draws, checked glyph by glyph against the
 * font: Latin with Vietnamese and Romanian letters, Cyrillic with Kazakh, dashes,
 * quotes, the euro sign. It has no CJK, Hangul or Devanagari.
 */
const ROBOTO_TEXT =
  /^[\u0020-\u007e\u00a0-\u017f\u01a0\u01a1\u01af\u01b0\u0218-\u021b\u0400-\u0486\u0488-\u04ff\u1ea0-\u1ef9\u2000-\u200b\u2010\u2011\u2013-\u2015\u2018-\u201e\u2020-\u2022\u2026\u20ac\u2116]*$/;

/** A4 minus pdfmake's default 40pt margins. */
const PAGE_WIDTH_PT = 515.28;
/** Canvas pixels per PDF point: ~290 dpi, sharp enough to print. */
const SCALE = 4;

type LineStyle = { fontSize: number; bold?: boolean; color?: string };

function wrapLines(ctx: CanvasRenderingContext2D, text: string, locale: string): string[] {
  const lines: string[] = [];
  let line = '';
  // Word segments also break CJK text, which has no spaces between words.
  for (const { segment } of new Intl.Segmenter(locale, { granularity: 'word' }).segment(text)) {
    if (line && ctx.measureText(line + segment).width > ctx.canvas.width) {
      lines.push(line.trimEnd());
      line = segment.trimStart();
    } else {
      line += segment;
    }
  }
  return line ? [...lines, line] : lines;
}

/**
 * Draws the text with the browser, whose fonts and shaping cover every script
 * the app ships in. The PDF gets it as an image; the codes themselves never need this.
 */
function drawText(
  text: string,
  style: LineStyle,
  locale: string,
): { image: string; width: number; height: number } {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D is not available');
  }
  const font = `${style.bold ? 600 : 400} ${style.fontSize * SCALE}px ${getComputedStyle(document.body).fontFamily}`;
  const lineHeight = style.fontSize * SCALE * 1.3;
  canvas.width = PAGE_WIDTH_PT * SCALE;
  ctx.font = font;
  const lines = wrapLines(ctx, text, locale);
  canvas.height = Math.ceil(lines.length * lineHeight);
  // Resizing the canvas resets the context state.
  ctx.font = font;
  ctx.fillStyle = style.color ?? '#000000';
  ctx.textBaseline = 'middle';
  lines.forEach((line, index) => {
    ctx.fillText(line, 0, (index + 0.5) * lineHeight);
  });
  return {
    image: canvas.toDataURL('image/png'),
    width: PAGE_WIDTH_PT,
    height: canvas.height / SCALE,
  };
}

function pdfLine(text: string, style: LineStyle, locale: string): Record<string, unknown> {
  return ROBOTO_TEXT.test(text) ? { text, ...style } : drawText(text, style, locale);
}

async function buildPdf(content: RecoveryCodesFileContent): Promise<Blob> {
  const [pdfMakeModule, vfsModule] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]);
  const pdfMake = unwrapDefault<PdfMakeLike>(pdfMakeModule);
  const { locale } = content;
  const definition = {
    info: { title: content.title },
    content: [
      { ...pdfLine(content.title, { fontSize: 18, bold: true }, locale), margin: [0, 0, 0, 6] },
      ...content.details.map(line => pdfLine(line, { fontSize: 10, color: '#555555' }, locale)),
      { ...pdfLine(content.hint, { fontSize: 11 }, locale), margin: [0, 14, 0, 14] },
      // No characterSpacing: viewers then guess spaces inside a code on copy.
      ...content.codes.map(code => ({
        text: code,
        fontSize: 15,
        margin: [0, 3, 0, 3],
      })),
    ],
  };
  return new Promise(resolve => {
    pdfMake.createPdf(definition, undefined, undefined, unwrapDefault(vfsModule)).getBlob(resolve);
  });
}

async function buildDocx(content: RecoveryCodesFileContent): Promise<Blob> {
  const { Document, HeadingLevel, Packer, Paragraph, TextRun } = await import('docx');
  const document = new Document({
    title: content.title,
    sections: [
      {
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: content.title })],
          }),
          ...content.details.map(
            line =>
              new Paragraph({
                children: [new TextRun({ text: line, color: '555555' })],
              }),
          ),
          new Paragraph({
            spacing: { before: 240, after: 240 },
            children: [new TextRun({ text: content.hint })],
          }),
          ...content.codes.map(
            code =>
              new Paragraph({
                spacing: { after: 80 },
                children: [new TextRun({ text: code, font: 'Courier New', size: 28 })],
              }),
          ),
        ],
      },
    ],
  });
  return Packer.toBlob(document);
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Builds the file in the browser: the server keeps only hashes of the codes,
 * so the plain codes must not travel back to it just to be rendered.
 */
export async function downloadRecoveryCodes(
  format: RecoveryCodesFileFormat,
  content: RecoveryCodesFileContent,
): Promise<void> {
  const blob = format === 'pdf' ? await buildPdf(content) : await buildDocx(content);
  triggerDownload(blob, `lumio-recovery-codes-${formatDate(new Date(), 'yyyy-MM-dd')}.${format}`);
}
