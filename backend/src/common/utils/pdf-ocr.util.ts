import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import type { PdfTextItem, PdfTextRow } from './pdf-parser.util';

/**
 * Reads a PDF without a text layer (a scanned or photographed statement) the
 * way pdfplumber reads one with it: every page rasterized and recognized, each
 * word with its position, grouped into rows. Positions are in PDF points, so
 * the layout reading treats both alike.
 */

const OCR_DPI = 300;
const POINTS_PER_PIXEL = 72 / OCR_DPI;
/**
 * Table rulings and margin notes printed sideways come out as stray letters
 * and dashes. A word the engine is this unsure of is dropped, and so is a
 * whole line it reads with less average confidence than a line of text gets;
 * a short date such as "Sep 7" on a good line can score as low as 40.
 */
const MIN_WORD_CONFIDENCE = 30;
const MIN_LINE_CONFIDENCE = 60;
/** What rulings read as: dashes, underscores, bars, brackets. */
const RULING_GLYPHS = /[—–_~|[\]{}<>=]/;
/** The code mailed statements print up the left margin, a letter or two at a time. */
const MARGIN_WIDTH = 50;
const MARGIN_GAP = 40;
/** Rasterizing and recognizing take seconds a page; a statement is rarely longer. */
const MAX_OCR_PAGES = 30;
const RASTERIZE_TIMEOUT_MS = 120_000;
const MAX_CACHE_ENTRIES = 10;

export interface OcrWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

export interface PdfOcrLayout {
  text: string;
  rows: PdfTextRow[];
}

const cache = new Map<string, Promise<PdfOcrLayout>>();

/**
 * Recognized words as rows: a word joins a row when its middle sits within
 * half a line of the row's, as words of one printed line do even when their
 * tops differ ("$" and "g" reach higher and lower than "a").
 */
export function ocrWordsToRows(words: OcrWord[], page: number): PdfTextRow[] {
  const rows: { middle: number; height: number; items: PdfTextItem[] }[] = [];
  const confidence = new Map<PdfTextItem, number>();
  const kept = words.filter(
    word =>
      /[\p{L}\p{N}]/u.test(word.text) &&
      !RULING_GLYPHS.test(word.text) &&
      word.confidence >= MIN_WORD_CONFIDENCE,
  );
  for (const word of [...kept].sort((a, b) => a.bbox.y0 + a.bbox.y1 - (b.bbox.y0 + b.bbox.y1))) {
    const height = (word.bbox.y1 - word.bbox.y0) * POINTS_PER_PIXEL;
    const middle = ((word.bbox.y0 + word.bbox.y1) / 2) * POINTS_PER_PIXEL;
    const item: PdfTextItem = {
      text: word.text.trim(),
      x: word.bbox.x0 * POINTS_PER_PIXEL,
      y: word.bbox.y0 * POINTS_PER_PIXEL,
      width: (word.bbox.x1 - word.bbox.x0) * POINTS_PER_PIXEL,
      height,
      page,
    };
    const row = rows.find(
      candidate => Math.abs(candidate.middle - middle) <= Math.min(candidate.height, height) / 2,
    );
    if (row) {
      row.items.push(item);
    } else {
      rows.push({ middle, height, items: [item] });
    }
    confidence.set(item, word.confidence);
  }
  return rows.flatMap(({ items }) => {
    const sorted = withoutMarginCode(items.sort((a, b) => a.x - b.x));
    const average =
      sorted.reduce((sum, item) => sum + (confidence.get(item) ?? 0), 0) / sorted.length;
    if (sorted.length === 0 || average < MIN_LINE_CONFIDENCE) {
      return [];
    }
    return {
      page,
      y: Math.min(...sorted.map(item => item.y)),
      text: sorted.map(item => item.text).join(' '),
      items: sorted,
    };
  });
}

/** A letter or two at the left edge, far from the rest of the line, is the margin code. */
function withoutMarginCode(items: PdfTextItem[]): PdfTextItem[] {
  const [first, next] = items;
  const isCode =
    first.text.length <= 2 &&
    first.x < MARGIN_WIDTH &&
    (!next || next.x - (first.x + first.width) > MARGIN_GAP);
  return isCode ? items.slice(1) : items;
}

async function rasterize(filePath: string, dir: string, lastPage: number): Promise<string[]> {
  const prefix = path.join(dir, 'page');
  await promisify(execFile)(
    'pdftoppm',
    ['-png', '-gray', '-r', String(OCR_DPI), '-l', String(lastPage), filePath, prefix],
    { timeout: RASTERIZE_TIMEOUT_MS },
  );
  const pageNumber = (name: string) => Number(name.match(/-(\d+)\.png$/)?.[1] ?? 0);
  return (await fs.promises.readdir(dir))
    .filter(name => name.endsWith('.png'))
    .sort((a, b) => pageNumber(a) - pageNumber(b))
    .map(name => path.join(dir, name));
}

async function recognize(filePath: string, lastPage: number): Promise<PdfOcrLayout> {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pdf-ocr-'));
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  try {
    const rows: PdfTextRow[] = [];
    const images = await rasterize(filePath, dir, lastPage);
    for (const [index, image] of images.entries()) {
      const { data } = await worker.recognize(image, {}, { blocks: true });
      const words = (data.blocks ?? []).flatMap(block =>
        block.paragraphs.flatMap(paragraph => paragraph.lines.flatMap(line => line.words)),
      );
      rows.push(...ocrWordsToRows(words, index + 1).sort((a, b) => a.y - b.y));
    }
    return { text: rows.map(row => row.text).join('\n'), rows };
  } finally {
    await worker.terminate();
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
}

/** The pages up to `lastPage` (all of them by default), read by OCR. */
export function ocrPdfLayout(filePath: string, lastPage = MAX_OCR_PAGES): Promise<PdfOcrLayout> {
  const key = `${filePath}#${lastPage}`;
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }
  const reading = recognize(filePath, Math.min(lastPage, MAX_OCR_PAGES));
  reading.catch(() => cache.delete(key));
  cache.set(key, reading);
  while (cache.size > MAX_CACHE_ENTRIES) {
    cache.delete(cache.keys().next().value as string);
  }
  return reading;
}

/**
 * pdfplumber's reading, or OCR's when the file has no text layer. Tables are
 * found from ruling lines and text, which OCR does not give; the layout rows
 * stand in for them.
 */
export async function withOcrFallback<T extends PdfOcrLayout>(
  filePath: string,
  read: (filePath: string) => Promise<T>,
): Promise<T> {
  const parsed = await read(filePath);
  if (parsed.text.trim()) {
    return parsed;
  }
  return { ...parsed, ...(await ocrPdfLayout(filePath)) };
}
