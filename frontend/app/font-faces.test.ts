// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

/**
 * Every letter the app's translations use must be drawn by the self-hosted
 * fonts. The main font once shipped its Latin file alone, and Cyrillic,
 * Polish, Czech, Turkish, Kazakh and Vietnamese letters fell back to a system
 * font mid-word. Read from the files themselves: the faces declared in
 * font-faces.ts (file and unicode-range) and each file's character map.
 *
 * Chinese, Japanese, Korean and Hindi are left out on purpose: none of the
 * families has those scripts, and the system font draws them.
 */

const APP_DIR = __dirname;
const FRONTEND_DIR = join(APP_DIR, '..');
const SYSTEM_FONT_LOCALES = new Set(['zh', 'ja', 'ko', 'hi']);
const LOCALES = [
  'ru', 'en', 'kk', 'de', 'fr', 'es', 'pt', 'tr', 'uk', 'pl', 'it', 'sk', 'nl', 'sv', 'vi', 'id',
  'da', 'nb', 'nn', 'fi', 'is', 'fo', 'cs', 'bg', 'hr', 'sr', 'sl', 'mk', 'be', 'bs', 'hsb',
];

type Range = [number, number];
interface Face {
  file: string;
  ranges: Range[];
}

/** The faces font-faces.ts declares, in their order, grouped by family. */
function declaredFamilies(): Map<string, Face[]> {
  const source = readFileSync(join(APP_DIR, 'font-faces.ts'), 'utf8');
  const families = new Map<string, Face[]>();
  for (const call of source.split('localFont({').slice(1)) {
    const file = call.match(/src: '\.\/fonts\/([^']+)'/)?.[1];
    const range = call.match(/prop: 'unicode-range',\s*value:\s*'([^']+)'/)?.[1];
    if (!(file && range)) {
      throw new Error(`a face without a file or a unicode-range: ${call.slice(0, 80)}`);
    }
    const family = file.replace(/-(latin|latin-ext|cyrillic|cyrillic-ext|vietnamese)-wght-normal\.woff2$/, '');
    const ranges = range.split(',').map(part => {
      const [start, end = start] = part.replace('U+', '').split('-');
      return [Number.parseInt(start, 16), Number.parseInt(end, 16)] as Range;
    });
    families.set(family, [...(families.get(family) ?? []), { file, ranges }]);
  }
  return families;
}

/** UIntBase128 as WOFF2 writes table lengths. */
function readBase128(view: DataView, at: { offset: number }): number {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    const byte = view.getUint8(at.offset++);
    value = value * 128 + (byte & 0x7f);
    if (!(byte & 0x80)) {
      return value;
    }
  }
  throw new Error('bad UIntBase128');
}

const GLYF = 10;
const LOCA = 11;

/**
 * The characters a WOFF2 file maps to glyphs. WOFF2 stores every table in one
 * Brotli stream; `cmap` is never transformed, so it is read as it is.
 */
function characterMap(path: string): Set<number> {
  const bytes = readFileSync(path);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0) !== 0x774f4632) {
    throw new Error(`${path} is not WOFF2`);
  }
  const numTables = view.getUint16(12);
  const compressedSize = view.getUint32(20);
  const at = { offset: 48 };
  let cmapStart = -1;
  let cmapLength = 0;
  let streamOffset = 0;
  for (let i = 0; i < numTables; i++) {
    const flags = view.getUint8(at.offset++);
    const tagIndex = flags & 0x3f;
    const transform = flags >> 6;
    if (tagIndex === 63) {
      at.offset += 4;
    }
    const origLength = readBase128(view, at);
    const transformed =
      tagIndex === GLYF || tagIndex === LOCA ? transform !== 3 : transform !== 0;
    const length = transformed ? readBase128(view, at) : origLength;
    if (tagIndex === 0) {
      cmapStart = streamOffset;
      cmapLength = length;
    }
    streamOffset += length;
  }
  const tables = brotliDecompressSync(bytes.subarray(at.offset, at.offset + compressedSize));
  const cmap = new DataView(tables.buffer, tables.byteOffset + cmapStart, cmapLength);

  const chars = new Set<number>();
  const subtables = cmap.getUint16(2);
  for (let i = 0; i < subtables; i++) {
    const offset = cmap.getUint32(4 + i * 8 + 4);
    const format = cmap.getUint16(offset);
    if (format === 12) {
      const groups = cmap.getUint32(offset + 12);
      for (let g = 0; g < groups; g++) {
        const start = cmap.getUint32(offset + 16 + g * 12);
        const end = cmap.getUint32(offset + 20 + g * 12);
        for (let c = start; c <= end; c++) chars.add(c);
      }
    } else if (format === 4) {
      const segments = cmap.getUint16(offset + 6) / 2;
      const ends = offset + 14;
      const starts = ends + segments * 2 + 2;
      const deltas = starts + segments * 2;
      const rangeOffsets = deltas + segments * 2;
      for (let s = 0; s < segments; s++) {
        const start = cmap.getUint16(starts + s * 2);
        const end = cmap.getUint16(ends + s * 2);
        const delta = cmap.getInt16(deltas + s * 2);
        const rangeOffset = cmap.getUint16(rangeOffsets + s * 2);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          const glyph =
            rangeOffset === 0
              ? (c + delta) & 0xffff
              : cmap.getUint16(rangeOffsets + s * 2 + rangeOffset + (c - start) * 2);
          if (glyph !== 0) chars.add(c);
        }
      }
    }
  }
  return chars;
}

function contentFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (name === 'node_modules' || name.startsWith('.')) return [];
    if (statSync(path).isDirectory()) return contentFiles(path);
    return name.endsWith('.content.ts') ? [path] : [];
  });
}

/** Each letter the translations use, with a locale that uses it. */
function lettersInUse(): Map<number, string> {
  const letters = new Map<number, string>();
  const entry = new RegExp(`\\b(${LOCALES.join('|')}):\\s*(['"\`])((?:\\\\.|(?!\\2)[^\\\\])*)\\2`, 'g');
  for (const file of contentFiles(FRONTEND_DIR)) {
    const source = readFileSync(file, 'utf8');
    for (const [, locale, , text] of source.matchAll(entry)) {
      if (SYSTEM_FONT_LOCALES.has(locale)) continue;
      for (const letter of text.match(/\p{L}/gu) ?? []) {
        const code = letter.codePointAt(0) as number;
        if (!letters.has(code)) letters.set(code, locale);
      }
    }
  }
  return letters;
}

describe('self-hosted fonts', () => {
  const families = declaredFamilies();
  const letters = lettersInUse();

  it('finds the families and the letters to check', () => {
    expect([...families.keys()].sort()).toEqual(['geist', 'geist-mono', 'nunito']);
    // Cyrillic and Latin Extended letters are among them, or the scan read nothing.
    expect(letters.has('Ж'.codePointAt(0) as number)).toBe(true);
    expect(letters.has('ł'.codePointAt(0) as number)).toBe(true);
  });

  for (const family of ['geist', 'geist-mono', 'nunito']) {
    it(`${family} draws every letter of every translation`, () => {
      const faces = (families.get(family) ?? []).map(face => ({
        ...face,
        chars: characterMap(join(APP_DIR, 'fonts', face.file)),
      }));
      const missing: string[] = [];
      for (const [code, locale] of letters) {
        // The browser takes the first face whose range claims the character.
        const face = faces.find(candidate =>
          candidate.ranges.some(([start, end]) => code >= start && code <= end),
        );
        if (!face?.chars.has(code)) {
          missing.push(`${String.fromCodePoint(code)} (${locale}, ${face?.file ?? 'no face'})`);
        }
      }
      expect(missing).toEqual([]);
    });
  }
});
