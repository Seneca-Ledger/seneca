import { readFileSync } from 'fs';
import * as path from 'path';
import { parsePdf } from '@/common/utils/pdf-text.util';

const fixture = (name: string): Buffer =>
  readFileSync(path.join(__dirname, '../../../fixtures/e-invoices/zugferd', name));

describe('parsePdf', () => {
  it('reads every page of a real PDF', async () => {
    const result = await parsePdf(fixture('EN16931_Einfach.pdf'));

    expect(result.numpages).toBe(2);
    // Pages come after a blank line each, the way the parsers expect them.
    expect(result.text.startsWith('\n\n')).toBe(true);
    expect(result.text.split('\n\n').filter(Boolean)).toHaveLength(2);
  });

  it('keeps the words of one line on one line, separated by single spaces', async () => {
    const { text } = await parsePdf(fixture('EN16931_Einfach.pdf'));
    const lines = text.split('\n').filter(Boolean);

    expect(lines.length).toBeGreaterThan(10);
    expect(lines.every(line => line === line.trim())).toBe(true);
    expect(lines.some(line => line.includes('  '))).toBe(false);
  });

  it('reads the same bytes from a Node Buffer and from a Uint8Array', async () => {
    const bytes = fixture('Facture_DOM_MINIMUM.pdf');

    const fromBuffer = await parsePdf(bytes);
    const fromArray = await parsePdf(new Uint8Array(bytes));

    expect(fromBuffer.text).toBe(fromArray.text);
    expect(fromBuffer.text.length).toBeGreaterThan(100);
  });

  it('rejects bytes that are not a PDF', async () => {
    await expect(parsePdf(Buffer.from('not a pdf'))).rejects.toThrow();
  });
});
