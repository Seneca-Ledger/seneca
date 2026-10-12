jest.mock('pdf-parse', () => jest.fn(async () => ({ text: 'parsed' })));

import pdfParse from 'pdf-parse';
import { parsePdf } from '@/common/utils/pdf-text.util';

describe('parsePdf', () => {
  it('hands pdf.js a plain Uint8Array copy, never a Node Buffer', async () => {
    const pdf = Buffer.from('%PDF-1.3');

    await expect(parsePdf(pdf)).resolves.toEqual({ text: 'parsed' });

    const passed = (pdfParse as unknown as jest.Mock).mock.calls[0][0] as Uint8Array;
    expect(Buffer.isBuffer(passed)).toBe(false);
    expect(passed).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(passed).toString()).toBe('%PDF-1.3');
  });
});
