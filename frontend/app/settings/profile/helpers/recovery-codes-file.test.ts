// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { downloadRecoveryCodes, type RecoveryCodesFileContent } from './recovery-codes-file';

const codes = ['SV4EA-ZYFTP', 'F3DYA-87KRK', 'TNMFB-PCAVV'];

const content: RecoveryCodesFileContent = {
  locale: 'ru',
  title: 'Lumio — Резервные коды',
  details: ['Аккаунт: user@example.com', 'Дата создания: 26.09.2026, 12:00'],
  hint: 'Каждый код срабатывает один раз.',
  codes,
};

const chinese: RecoveryCodesFileContent = {
  locale: 'zh',
  title: 'Lumio — 恢复码',
  details: ['账户: user@example.com', 'Generated: Sep 26, 2026'],
  hint: '每个恢复码可代替身份验证器应用中的验证码使用一次。',
  codes,
};

const hindi: RecoveryCodesFileContent = {
  locale: 'hi',
  title: 'Lumio — रिकवरी कोड',
  details: ['खाता: user@example.com'],
  hint: 'हर कोड ऑथेंटिकेटर ऐप के कोड की जगह एक बार काम करता है। इस फ़ाइल को सुरक्षित जगह रखें और किसी के साथ साझा न करें।',
  codes,
};

const ONE_PIXEL_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

let saved: { blob: Blob; fileName: string } | null = null;
/** Lines the browser drew onto a canvas. */
let drawn: Array<{ text: string }> = [];

beforeEach(() => {
  saved = null;
  drawn = [];
  // jsdom has no canvas: a context that measures ~0.6em per character is enough to wrap.
  const fakeContext = function (this: HTMLCanvasElement) {
    const ctx = {
      canvas: this,
      font: '',
      fillStyle: '',
      textBaseline: '',
      measureText: (text: string) => ({
        width: text.length * Number.parseFloat(ctx.font.split(' ')[1]) * 0.6,
      }),
      fillText: (text: string) => {
        drawn.push({ text });
      },
    };
    return ctx;
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    fakeContext as unknown as HTMLCanvasElement['getContext'],
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(ONE_PIXEL_PNG);
  let lastBlob: Blob | null = null;
  URL.createObjectURL = vi.fn((blob: Blob) => {
    lastBlob = blob;
    return 'blob:recovery-codes';
  });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    saved = { blob: lastBlob as Blob, fileName: this.download };
  });
});

// jsdom's Blob has no arrayBuffer(); FileReader is the way to read it back.
function savedBytes(): Promise<Uint8Array> {
  expect(saved).not.toBeNull();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer((saved as { blob: Blob }).blob);
  });
}

async function pdfText(bytes: Uint8Array): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const page = await pdf.getPage(1);
  const text = await page.getTextContent();
  // pdfmake writes one text item per word; hasEOL marks where a line ends.
  return text.items.map(item => ('str' in item ? item.str + (item.hasEOL ? '\n' : '') : '')).join('');
}

function docxXml(bytes: Uint8Array): string {
  const zip = XLSX.CFB.read(bytes, { type: 'array' });
  const entry = XLSX.CFB.find(zip, '/word/document.xml');
  expect(entry).toBeTruthy();
  return new TextDecoder().decode(entry?.content as Uint8Array);
}

describe('downloadRecoveryCodes', () => {
  it('saves a PDF with the title, details, hint and every code as real text', async () => {
    await downloadRecoveryCodes('pdf', content);

    expect(saved?.fileName).toMatch(/^lumio-recovery-codes-\d{4}-\d{2}-\d{2}\.pdf$/);
    const text = await pdfText(await savedBytes());
    for (const line of [content.title, ...content.details, content.hint, ...content.codes]) {
      expect(text).toContain(line);
    }
    expect(drawn).toEqual([]);
  }, 30_000);

  it('draws lines Roboto has no glyphs for in the browser and keeps the codes as text', async () => {
    await downloadRecoveryCodes('pdf', chinese);

    const bytes = await savedBytes();
    // Read the raw file first: pdfjs detaches the buffer it is given.
    const raw = new TextDecoder('latin1').decode(bytes);
    const text = await pdfText(bytes);
    for (const code of codes) {
      expect(text).toContain(code);
    }
    expect(text).toContain('Generated: Sep 26, 2026');
    expect(text).not.toContain('恢复码');
    expect(drawn.map(line => line.text)).toEqual([
      chinese.title,
      '账户: user@example.com',
      chinese.hint,
    ]);
    expect(raw).toContain('/Subtype /Image');
  }, 30_000);

  it('wraps a long drawn line without losing words', async () => {
    await downloadRecoveryCodes('pdf', hindi);

    const hintLines = drawn.slice(2).map(line => line.text);
    expect(hintLines.length).toBeGreaterThan(1);
    expect(hintLines.join(' ')).toBe(hindi.hint);
  }, 30_000);

  it('saves a DOCX with the title, details, hint and every code', async () => {
    await downloadRecoveryCodes('docx', content);

    expect(saved?.fileName).toMatch(/^lumio-recovery-codes-\d{4}-\d{2}-\d{2}\.docx$/);
    const xml = docxXml(await savedBytes());
    for (const line of [content.title, ...content.details, content.hint, ...content.codes]) {
      expect(xml).toContain(line);
    }
  });

  it('names the file by the local date, not the UTC one', async () => {
    const previousTz = process.env.TZ;
    // Almaty is UTC+5: 00:30 local on the 26th is still the 25th in UTC.
    process.env.TZ = 'Asia/Almaty';
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 26, 0, 30));
    try {
      await downloadRecoveryCodes('docx', content);
    } finally {
      vi.useRealTimers();
      process.env.TZ = previousTz;
    }

    expect(saved?.fileName).toBe('lumio-recovery-codes-2026-09-26.docx');
  });
});
